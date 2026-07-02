function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="dash-ai-rec-card__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function UniversityCard({ record }) {
  const meta = record.metadata ?? {};
  return (
    <article className="dash-ai-rec-card dash-ai-rec-card--university">
      <h4 className="dash-ai-rec-card__title">{record.title}</h4>
      <dl className="dash-ai-rec-card__grid">
        <Field label="Location" value={meta.city && meta.state ? `${meta.city}, ${meta.state}` : null} />
        <Field
          label="Admission rate"
          value={meta.admissionRate != null ? `${(meta.admissionRate * 100).toFixed(1)}%` : null}
        />
        <Field label="SAT average" value={meta.satAverage != null ? String(meta.satAverage) : null} />
        <Field
          label="Total cost"
          value={meta.totalCost != null ? `$${Math.round(meta.totalCost).toLocaleString("en-US")}` : null}
        />
        <Field
          label="In-state tuition"
          value={meta.tuitionInState != null ? `$${Math.round(meta.tuitionInState).toLocaleString("en-US")}` : null}
        />
        <Field
          label="Out-of-state tuition"
          value={meta.tuitionOutOfState != null ? `$${Math.round(meta.tuitionOutOfState).toLocaleString("en-US")}` : null}
        />
        <Field label="Fit" value={meta.fitCategory ? `${meta.fitCategory} school` : null} />
      </dl>
      <p className="dash-ai-rec-card__source">Prelude University Database</p>
    </article>
  );
}

function ScholarshipCard({ record }) {
  const meta = record.metadata ?? {};
  return (
    <article className="dash-ai-rec-card dash-ai-rec-card--scholarship">
      <h4 className="dash-ai-rec-card__title">{record.title}</h4>
      <dl className="dash-ai-rec-card__grid">
        <Field label="Organization" value={meta.organization} />
        <Field label="Award amount" value={meta.awardAmount} />
        <Field label="Eligibility" value={meta.eligibility} />
        <Field label="Deadline month" value={meta.deadlineMonth} />
      </dl>
      <p className="dash-ai-rec-card__source">Prelude Scholarship Database</p>
    </article>
  );
}

function SummerProgramCard({ record }) {
  const meta = record.metadata ?? {};
  return (
    <article className="dash-ai-rec-card dash-ai-rec-card--summer">
      <h4 className="dash-ai-rec-card__title">{record.title}</h4>
      <dl className="dash-ai-rec-card__grid">
        <Field label="Institution" value={meta.institution} />
        <Field label="Subject" value={meta.subject} />
        <Field label="Selectivity" value={meta.selectivity} />
        <Field label="Cost" value={meta.costRange} />
      </dl>
      <p className="dash-ai-rec-card__source">Prelude Summer Program Database</p>
    </article>
  );
}

function ExtracurricularCard({ record }) {
  const meta = record.metadata ?? {};
  return (
    <article className="dash-ai-rec-card dash-ai-rec-card--activity">
      <h4 className="dash-ai-rec-card__title">{record.title}</h4>
      <dl className="dash-ai-rec-card__grid">
        <Field label="Category" value={meta.category} />
        <Field label="Leadership roles" value={meta.leadershipRoles} />
        <Field label="Skills developed" value={meta.skillsDeveloped} />
      </dl>
      <p className="dash-ai-rec-card__source">Prelude Extracurricular Database</p>
    </article>
  );
}

function CsProjectCard({ record }) {
  const meta = record.metadata ?? {};
  return (
    <article className="dash-ai-rec-card dash-ai-rec-card--cs">
      <h4 className="dash-ai-rec-card__title">{record.title}</h4>
      <dl className="dash-ai-rec-card__grid">
        <Field label="Project type" value={meta.projectType} />
        <Field label="Difficulty" value={meta.difficulty} />
        <Field label="Impact level" value={meta.impactLevel} />
      </dl>
      <p className="dash-ai-rec-card__source">Prelude CS Project Database</p>
    </article>
  );
}

function RecommendationCard({ record }) {
  switch (record.sourceType) {
    case "university":
      return <UniversityCard record={record} />;
    case "scholarship":
      return <ScholarshipCard record={record} />;
    case "summer_program":
      return <SummerProgramCard record={record} />;
    case "extracurricular":
      return <ExtracurricularCard record={record} />;
    case "cs_project":
      return <CsProjectCard record={record} />;
    default:
      return null;
  }
}

export default function DashboardRecommendationCards({ records = [] }) {
  const dashboardRecords = records.filter((record) =>
    ["university", "scholarship", "summer_program", "extracurricular", "cs_project"].includes(record.sourceType)
  );

  if (!dashboardRecords.length) return null;

  return (
    <div className="dash-ai-rec-cards" aria-label="Prelude database recommendations">
      {dashboardRecords.slice(0, 6).map((record) => (
        <RecommendationCard key={record.id ?? record.title} record={record} />
      ))}
    </div>
  );
}
