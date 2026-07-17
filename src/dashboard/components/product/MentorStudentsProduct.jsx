import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, Search, Users } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { listMentorActivities } from "../../../lib/mentorActivitiesApi.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { EmptyState } from "../ui/index.jsx";
import { AssignActivityModal } from "./MentorActivitiesPanel.jsx";
import MentorStudentDirectoryCard from "./MentorStudentDirectoryCard.jsx";

const PAGE_SIZE = 4;

const GRADE_OPTIONS = [
  { value: "", label: "All grades" },
  { value: "9", label: "9th grade" },
  { value: "10", label: "10th grade" },
  { value: "11", label: "11th grade" },
  { value: "12", label: "12th grade" }
];

const SORT_OPTIONS = [
  { value: "name", label: "Sort by name" },
  { value: "deadlines", label: "Sort by deadlines" }
];

function normalizeGrade(grade) {
  const match = String(grade || "").match(/(\d+)/);
  return match ? match[1] : "";
}

function MentorStudentsPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <nav className="dash-mentor-directory-pagination" aria-label="Students pagination">
      <button
        type="button"
        className="dash-mentor-directory-pagination__btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((item, index) =>
        item === "…" ? (
          <span key={`ellipsis-${index}`} className="dash-mentor-directory-pagination__ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={page === item ? "dash-mentor-directory-pagination__btn dash-mentor-directory-pagination__btn--active" : "dash-mentor-directory-pagination__btn"}
            onClick={() => onPageChange(item)}
            aria-current={page === item ? "page" : undefined}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        className="dash-mentor-directory-pagination__btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}

export default function MentorStudentsProduct() {
  const { user } = useAuth();
  const { students, summaryCards } = useDashboardData();
  const [activityStudents, setActivityStudents] = useState([]);
  const [assignStudent, setAssignStudent] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [gradeFilter, setGradeFilter] = useState("");
  const [page, setPage] = useState(1);

  const rosterStudents = useMemo(() => (
    students.length ? students : activityStudents.map((student) => ({
      ...student,
      grade: student.grade || "",
      major: "",
      gamification: { streak: 0 },
      profileCompletion: 0,
      upcomingDeadlines: 0,
      nextDeadline: "TBD"
    }))
  ), [students, activityStudents]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...rosterStudents]
      .filter((student) => {
        if (!normalizedQuery) return true;
        return (
          student.name.toLowerCase().includes(normalizedQuery)
          || student.major?.toLowerCase().includes(normalizedQuery)
          || student.grade?.toLowerCase().includes(normalizedQuery)
        );
      })
      .filter((student) => !gradeFilter || normalizeGrade(student.grade) === gradeFilter)
      .sort((a, b) => {
        if (sort === "deadlines") {
          return (b.upcomingDeadlines ?? 0) - (a.upcomingDeadlines ?? 0);
        }
        return a.name.localeCompare(b.name);
      });
  }, [rosterStudents, query, gradeFilter, sort]);

  useEffect(() => {
    let cancelled = false;
    listMentorActivities(undefined, user).then((data) => {
      if (!cancelled) setActivityStudents(data.students || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.email]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const pageStudents = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, sort, gradeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const studentCount = summaryCards?.students ?? rosterStudents.length;
  const deadlinesThisWeek = summaryCards?.upcomingDeadlines
    ?? rosterStudents.reduce((sum, student) => sum + (student.upcomingDeadlines ?? 0), 0);

  return (
    <div className="dash-page dash-page--mentor-students">
      <section className="dash-mentor-directory-hero" aria-labelledby="mentor-students-heading">
        <div className="dash-mentor-directory-hero__title-row">
          <span className="dash-mentor-directory-hero__icon" aria-hidden="true">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 id="mentor-students-heading" className="dash-mentor-directory-hero__title">
              Students
            </h1>
            <p className="dash-mentor-directory-hero__subtitle">
              View student progress, upcoming deadlines, and profile activity.
            </p>
          </div>
        </div>

        <div className="dash-mentor-metrics dash-mentor-directory-hero__metrics">
          <article className="dash-mentor-metrics__item">
            <span className="dash-mentor-metrics__icon" aria-hidden="true">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="dash-mentor-metrics__value">{studentCount} Students</p>
              <p className="dash-mentor-metrics__label">Across all grades</p>
            </div>
          </article>
          <article className="dash-mentor-metrics__item">
            <span className="dash-mentor-metrics__icon" aria-hidden="true">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <p className="dash-mentor-metrics__value">{deadlinesThisWeek} Deadlines This Week</p>
              <p className="dash-mentor-metrics__label">Across your students</p>
            </div>
          </article>
        </div>
      </section>

      <div className="dash-mentor-directory-divider" role="separator" aria-hidden="true" />

      <div className="dash-mentor-directory-filters">
        <label className="dash-mentor-directory-filters__search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            className="dash-mentor-directory-filters__search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students…"
          />
        </label>

        <label className="dash-mentor-directory-filters__select">
          <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
            {GRADE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </label>

        <label className="dash-mentor-directory-filters__select">
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </label>
      </div>

      <div className="dash-mentor-directory-body">
        <div className="dash-mentor-directory-grid">
          {pageStudents.map((student) => (
            <MentorStudentDirectoryCard key={student.id} student={student} basePath={MENTOR_DASHBOARD_BASE} onAssign={setAssignStudent} />
          ))}
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No students match your filters"
            description="Try a different name, grade, or sort option."
          />
        ) : null}

        <MentorStudentsPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <AssignActivityModal
        open={Boolean(assignStudent)}
        onClose={() => setAssignStudent(null)}
        students={rosterStudents}
        presetStudentId={assignStudent?.id || ""}
        user={user}
      />
    </div>
  );
}
