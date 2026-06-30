# PreludeMatch mentor selection

After a student completes the PreludeMatch quiz during signup, mentor matches are calculated and the student experience follows strict count-based rules.

## Rules

| Matched mentor count | Student can select? | Continue button | Saved outcome |
| --- | --- | --- | --- |
| 0 | No | Active | `admin_review_required` |
| 1–2 | Yes (exactly one) | Disabled until selection | `student_selected` |
| 3+ | No (view only) | Active | `admin_review_required` |

Students may **only** manually select a mentor when `matched_mentor_count` is exactly 1 or 2. The frontend enforces this in `MentorMatchSelectionPanel`, and the backend re-validates on `POST /api/onboarding/mentor-selection`.

## Data model (`onboarding_progress`)

| Column | Purpose |
| --- | --- |
| `selected_mentor_id` | Student or admin chosen mentor |
| `mentor_selection_method` | `student_selected` or `admin_review_required` |
| `mentor_assignment_status` | `student_selected`, `admin_review_required`, or `admin_assigned` |
| `prelude_match_completed` | Quiz finished |
| `matched_mentor_count` | Count used for rule enforcement |
| `matched_mentor_ids` | JSON array of matched mentor user IDs |
| `admin_review_required` | Whether an admin must assign a mentor |
| `mentor_selection_timestamp` | When the student completed the selection step |

## API

### `GET /api/onboarding/mentor-selection`

Returns persisted match state for refresh-safe onboarding (requires Supabase bearer token).

### `POST /api/onboarding/mentor-selection`

Body: `{ "selectedMentorId": "uuid-or-null" }`

Validates `matched_mentor_count` server-side and rejects manipulated selections when count is 0 or ≥ 3.

### `GET /api/admin/mentor-review`

Admin-only queue of students with `admin_review_required = true`.

### `POST /api/admin/mentor-review/:studentId/assign`

Admin-only mentor assignment. Body: `{ "mentorId": "uuid" }`.

## Key files

- `shared/mentorSelectionLogic.js` — shared rule engine
- `server/onboardingMentorSelectionApi.js` — API + validation
- `src/components/onboarding/MentorMatchSelectionPanel.jsx` — result UI
- `src/components/onboarding/PreludeMatchOnboardingPage.jsx` — onboarding orchestration
- `src/dashboard/pages/admin/AdminPages.jsx` — admin review UI
- `supabase/migrations/20260630100000_mentor_selection.sql` — schema migration

## Migration

Run in Supabase SQL Editor:

```sql
-- supabase/migrations/20260630100000_mentor_selection.sql
```

## Tests

```bash
npm test
```

Coverage includes `tests/mentorSelectionLogic.test.js` and `tests/mentorMatchSelectionPanel.test.js`.
