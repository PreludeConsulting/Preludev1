-- Production-ready PostgreSQL schema for Prelude.
-- Requires PostgreSQL 14+. pgcrypto provides gen_random_uuid(); citext enables case-insensitive usernames/emails.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE token_status AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE match_status AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE match_participant_outcome AS ENUM ('PENDING', 'WIN', 'LOSS', 'DRAW', 'NO_CONTEST');
CREATE TYPE report_status AS ENUM ('OPEN', 'TRIAGED', 'ACTIONED', 'DISMISSED', 'CLOSED');
CREATE TYPE moderation_action_type AS ENUM ('WARNING', 'CONTENT_REMOVAL', 'TEMPORARY_SUSPENSION', 'PERMANENT_BAN', 'ACCOUNT_REINSTATEMENT', 'NOTE');
CREATE TYPE security_event_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL UNIQUE,
  email citext NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  status account_status NOT NULL DEFAULT 'ACTIVE',
  email_verified boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz(6),
  last_login_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  deleted_at timestamptz(6),
  CONSTRAINT chk_users_email_verified_at CHECK ((email_verified = false AND email_verified_at IS NULL) OR email_verified = true)
);

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_picture_url varchar(2048),
  display_name varchar(120),
  biography text,
  location varchar(160),
  birth_date date,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  matchmaking_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL UNIQUE,
  status token_status NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz(6) NOT NULL,
  used_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  request_ip inet,
  user_agent text
);

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL UNIQUE,
  status token_status NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz(6) NOT NULL,
  used_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash varchar(255) NOT NULL UNIQUE,
  status session_status NOT NULL DEFAULT 'ACTIVE',
  ip_address inet,
  user_agent text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  last_seen_at timestamptz(6),
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  token_hash varchar(255) NOT NULL UNIQUE,
  status token_status NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz(6) NOT NULL DEFAULT now(),
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  replaced_by_token_id uuid,
  ip_address inet,
  user_agent text,
  CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL
);

CREATE TABLE login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email_attempted citext,
  success boolean NOT NULL,
  failure_reason varchar(120),
  ip_address inet,
  user_agent text,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(100) NOT NULL,
  severity security_event_severity NOT NULL DEFAULT 'INFO',
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  key varchar(255) NOT NULL,
  route varchar(255) NOT NULL,
  window_start timestamptz(6) NOT NULL,
  window_seconds integer NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz(6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_rate_limit_buckets_key_route_window UNIQUE (key, route, window_start),
  CONSTRAINT chk_rate_limit_buckets_window_seconds CHECK (window_seconds > 0),
  CONSTRAINT chk_rate_limit_buckets_request_count CHECK (request_count >= 0)
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status match_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  started_at timestamptz(6),
  completed_at timestamptz(6),
  score jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_matches_timeline CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
  )
);

CREATE TABLE match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz(6) NOT NULL DEFAULT now(),
  left_at timestamptz(6),
  outcome match_participant_outcome NOT NULL DEFAULT 'PENDING',
  score numeric(12,4),
  rank integer,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_match_participants_match_user UNIQUE (match_id, user_id),
  CONSTRAINT chk_match_participants_left_after_join CHECK (left_at IS NULL OR left_at >= joined_at),
  CONSTRAINT chk_match_participants_rank CHECK (rank IS NULL OR rank > 0)
);

CREATE TABLE user_match_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matches_played integer NOT NULL DEFAULT 0,
  matches_won integer NOT NULL DEFAULT 0,
  matches_lost integer NOT NULL DEFAULT 0,
  matches_drawn integer NOT NULL DEFAULT 0,
  average_score numeric(12,4),
  highest_score numeric(12,4),
  current_streak integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_match_stats_nonnegative CHECK (
    matches_played >= 0 AND matches_won >= 0 AND matches_lost >= 0 AND matches_drawn >= 0
  ),
  CONSTRAINT chk_user_match_stats_totals CHECK (matches_won + matches_lost + matches_drawn <= matches_played)
);

CREATE TABLE match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE match_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  metric_name varchar(120) NOT NULL,
  metric_value numeric(18,6),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(120) NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  report_type varchar(100) NOT NULL,
  subject varchar(255),
  description text NOT NULL,
  status report_status NOT NULL DEFAULT 'OPEN',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  resolved_at timestamptz(6),
  CONSTRAINT chk_user_reports_resolved_after_created CHECK (resolved_at IS NULL OR resolved_at >= created_at)
);

CREATE TABLE moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  report_id uuid REFERENCES user_reports(id) ON DELETE SET NULL,
  action_type moderation_action_type NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz(6),
  ends_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chk_moderation_actions_end_after_start CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE ban_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  starts_at timestamptz(6) NOT NULL DEFAULT now(),
  ends_at timestamptz(6),
  lifted_at timestamptz(6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_ban_history_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT chk_ban_history_lifted_after_start CHECK (lifted_at IS NULL OR lifted_at >= starts_at)
);

CREATE TABLE system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type varchar(120) NOT NULL,
  severity security_event_severity NOT NULL DEFAULT 'INFO',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

-- Core lookup, history, and timeline indexes.
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX idx_user_profiles_location ON user_profiles(location);
CREATE INDEX idx_password_reset_tokens_user_status_expires ON password_reset_tokens(user_id, status, expires_at);
CREATE INDEX idx_email_verification_tokens_user_status_expires ON email_verification_tokens(user_id, status, expires_at);
CREATE INDEX idx_sessions_user_status_expires ON sessions(user_id, status, expires_at);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_refresh_tokens_user_status_expires ON refresh_tokens(user_id, status, expires_at);
CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX idx_login_history_user_created ON login_history(user_id, created_at DESC);
CREATE INDEX idx_login_history_email_created ON login_history(email_attempted, created_at DESC);
CREATE INDEX idx_login_history_ip_created ON login_history(ip_address, created_at DESC);
CREATE INDEX idx_security_events_user_created ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type_created ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_severity_created ON security_events(severity, created_at DESC);
CREATE INDEX idx_rate_limit_buckets_user_route_window ON rate_limit_buckets(user_id, route, window_start DESC);
CREATE INDEX idx_rate_limit_buckets_blocked_until ON rate_limit_buckets(blocked_until);
CREATE INDEX idx_matches_status_created ON matches(status, created_at DESC);
CREATE INDEX idx_matches_completed_at ON matches(completed_at DESC);
CREATE INDEX idx_match_participants_user_joined ON match_participants(user_id, joined_at DESC);
CREATE INDEX idx_match_participants_match_outcome ON match_participants(match_id, outcome);
CREATE INDEX idx_user_match_stats_matches_played ON user_match_stats(matches_played DESC);
CREATE INDEX idx_user_match_stats_average_score ON user_match_stats(average_score DESC);
CREATE INDEX idx_match_events_match_created ON match_events(match_id, created_at DESC);
CREATE INDEX idx_match_events_type_created ON match_events(event_type, created_at DESC);
CREATE INDEX idx_match_analytics_match_metric_recorded ON match_analytics(match_id, metric_name, recorded_at DESC);
CREATE INDEX idx_match_analytics_metric_recorded ON match_analytics(metric_name, recorded_at DESC);
CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX idx_user_reports_status_created ON user_reports(status, created_at DESC);
CREATE INDEX idx_user_reports_target_created ON user_reports(target_user_id, created_at DESC);
CREATE INDEX idx_user_reports_reporter_created ON user_reports(reporter_user_id, created_at DESC);
CREATE INDEX idx_moderation_actions_target_created ON moderation_actions(target_user_id, created_at DESC);
CREATE INDEX idx_moderation_actions_actor_created ON moderation_actions(actor_user_id, created_at DESC);
CREATE INDEX idx_moderation_actions_report_id ON moderation_actions(report_id);
CREATE INDEX idx_admin_notes_target_created ON admin_notes(target_user_id, created_at DESC);
CREATE INDEX idx_admin_notes_author_created ON admin_notes(author_user_id, created_at DESC);
CREATE INDEX idx_ban_history_user_starts ON ban_history(user_id, starts_at DESC);
CREATE INDEX idx_ban_history_ends_at ON ban_history(ends_at);
CREATE INDEX idx_system_events_type_created ON system_events(event_type, created_at DESC);
CREATE INDEX idx_system_events_severity_created ON system_events(severity, created_at DESC);

-- JSONB indexes for preference filtering, match metadata queries, analytics dimensions, and audit/search tooling.
CREATE INDEX idx_user_profiles_social_links_gin ON user_profiles USING gin (social_links);
CREATE INDEX idx_user_profiles_preferences_gin ON user_profiles USING gin (preferences);
CREATE INDEX idx_user_profiles_matchmaking_preferences_gin ON user_profiles USING gin (matchmaking_preferences);
CREATE INDEX idx_user_profiles_privacy_settings_gin ON user_profiles USING gin (privacy_settings);
CREATE INDEX idx_matches_metadata_gin ON matches USING gin (metadata);
CREATE INDEX idx_match_participants_performance_gin ON match_participants USING gin (performance);
CREATE INDEX idx_match_analytics_dimensions_gin ON match_analytics USING gin (dimensions);
CREATE INDEX idx_security_events_metadata_gin ON security_events USING gin (metadata);
CREATE INDEX idx_audit_logs_metadata_gin ON audit_logs USING gin (metadata);
