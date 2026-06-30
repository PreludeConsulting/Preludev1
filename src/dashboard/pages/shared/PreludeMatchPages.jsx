import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Search, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getMentorCatalog, requestMentorMatch, saveMatchDecision } from "../../../lib/preludeMatchService.js";
import { dashboardPathForRole, myMentorsPathForRole, studentRoute } from "../../../lib/onboardingRoutes.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  DashboardPageHeader,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SectionCard
} from "../../components/ui/index.jsx";
import PreludeMentorCard from "../../../components/hero/PreludeMentorCard.jsx";
import PreludeConstellation from "../../components/product/PreludeConstellation.jsx";

const EXPERTISE_FILTERS = ["CS strategy", "Essays", "STEM", "College list", "Financial aid", "Accountability"];

export function PreludeMatchBrowsePage() {
  const { user, refreshUser } = useAuth();
  const { refresh } = useDashboardData();
  const [query, setQuery] = useState("");
  const [college, setCollege] = useState("");
  const [major, setMajor] = useState("");
  const [expertise, setExpertise] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [matchedMentorId, setMatchedMentorId] = useState(null);

  const mentors = getMentorCatalog();
  const colleges = [...new Set(mentors.map((m) => m.school || m.university).filter(Boolean))];
  const majors = [...new Set(mentors.map((m) => m.major).filter(Boolean))];

  const filtered = useMemo(() => {
    return mentors.filter((m) => {
      const hay = `${m.name} ${m.school} ${m.major} ${(m.tags || []).join(" ")}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (college && (m.school || m.university) !== college) return false;
      if (major && m.major !== major) return false;
      if (expertise && !(m.tags || []).some((t) => t.toLowerCase().includes(expertise.toLowerCase()))) return false;
      return true;
    });
  }, [mentors, query, college, major, expertise]);

  async function handleSelect(mentorId) {
    setLoadingId(mentorId);
    setMessage("");
    setMatchedMentorId(null);
    try {
      if (user?.authProvider === "supabase") {
        const { error: err } = await requestMentorMatch(user.id, mentorId);
        if (err) throw new Error(err);
        const { error: decisionErr } = await saveMatchDecision(user.id, {
          decision: "accepted",
          mentorId
        });
        if (decisionErr) throw new Error(decisionErr);
        await refreshUser();
        await refresh();
        setMessage("Mentor saved to your account.");
        setMatchedMentorId(mentorId);
      } else {
        setMessage("Demo mode — mentor selection preview only.");
        setMatchedMentorId(mentorId);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoadingId(null);
    }
  }

  function clearFilters() {
    setQuery("");
    setCollege("");
    setMajor("");
    setExpertise("");
  }

  const hasFilters = query || college || major || expertise;

  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Prelude Match"
        subtitle="Browse mentor profiles and find the best fit for your goals."
        actions={
          <Link to={myMentorsPathForRole(user?.role)} className="dash-btn dash-btn--secondary dash-btn--sm">
            My Mentors
          </Link>
        }
      />
      <PreludeConstellation
        variant="mentor"
        value={loadingId ? 5 : message ? 6 : 3}
        total={6}
        active={Boolean(loadingId || message)}
        className="pm-browse-constellation"
        label={message || "Mentor preferences ready to connect"}
      />

      <SectionCard className="dash-panel">
        <div className="pm-browse-filters">
          <label className="pm-browse-filters__search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, school, or major…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select value={college} onChange={(e) => setCollege(e.target.value)} aria-label="Filter by college">
            <option value="">All colleges</option>
            {colleges.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={major} onChange={(e) => setMajor(e.target.value)} aria-label="Filter by major">
            <option value="">All majors</option>
            {majors.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={expertise} onChange={(e) => setExpertise(e.target.value)} aria-label="Filter by expertise">
            <option value="">All expertise</option>
            {EXPERTISE_FILTERS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {hasFilters ? (
            <SecondaryButton type="button" className="dash-btn--sm" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear filters
            </SecondaryButton>
          ) : null}
        </div>
      </SectionCard>

      {message ? (
        <div className="dash-callout pm-browse-complete" role={matchedMentorId ? "status" : undefined}>
          <p>{message}</p>
          {matchedMentorId ? (
            <PrimaryButton as={Link} to={dashboardPathForRole(user?.role)} className="dash-btn--sm">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Complete
            </PrimaryButton>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No mentors match your filters"
          description="Try clearing filters or broadening your search."
          action={<PrimaryButton type="button" className="dash-btn--sm" onClick={clearFilters}>Clear filters</PrimaryButton>}
        />
      ) : (
        <div className="pm-browse-grid">
          {filtered.map((mentor) => (
            <div key={mentor.id} className="pm-browse-card">
              <PreludeMentorCard mentor={mentor} />
              <div className="pm-browse-card__actions">
                <Link to={studentRoute("mentor")} className="dash-btn dash-btn--secondary dash-btn--sm">View Details</Link>
                <PrimaryButton
                  type="button"
                  className="dash-btn--sm"
                  disabled={loadingId === mentor.id || matchedMentorId === mentor.id}
                  onClick={() => handleSelect(mentor.id)}
                >
                  {loadingId === mentor.id ? "Saving…" : matchedMentorId === mentor.id ? "Matched" : "Select Mentor"}
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="dash-demo-note">Demo mentor catalog for development. Replace with live mentor records when the network is connected.</p>
    </div>
  );
}
