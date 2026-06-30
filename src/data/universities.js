const mediaBase = import.meta.env.BASE_URL;

const FULL_ALT_NAMES = {
  ucla: "University of California, Los Angeles",
  "uc-berkeley": "University of California, Berkeley",
  "notre-dame": "University of Notre Dame",
  usc: "University of Southern California",
  unc: "University of North Carolina at Chapel Hill"
};

const PNG_LOGOS = new Set([
  "dartmouth",
  "ucla",
  "uchicago",
  "cmu",
  "princeton",
  "yale",
  "vanderbilt",
  "columbia"
]);

const LOGO_DISPLAY = {
  harvard: { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  "johns-hopkins": { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  brown: { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  cornell: { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  columbia: { "--university-logo-height": "clamp(1.95rem, 3.6vw, 2.85rem)" },
  dartmouth: { "--university-logo-max-width": "clamp(5.75rem, 12vw, 8.25rem)" },
  ucla: { "--university-logo-max-width": "clamp(7.75rem, 16vw, 11rem)" },
  uchicago: { "--university-logo-height": "clamp(1.95rem, 3.6vw, 2.85rem)" },
  vanderbilt: { "--university-logo-max-width": "clamp(5.75rem, 12vw, 8.25rem)" },
  cmu: { "--university-logo-height": "clamp(1.95rem, 3.6vw, 2.85rem)" },
  princeton: { "--university-logo-height": "clamp(1.95rem, 3.6vw, 2.85rem)" },
  yale: { "--university-logo-max-width": "clamp(5.25rem, 11vw, 7.75rem)" },
  "notre-dame": { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  georgetown: { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" },
  usc: { "--university-logo-height": "clamp(1.9rem, 3.5vw, 2.8rem)" }
};

function logoPath(id) {
  const ext = PNG_LOGOS.has(id) ? "png" : "svg";
  return `${mediaBase}media/universities/${id}.${ext}`;
}

export const UNIVERSITIES = [
  { id: "stanford", name: "Stanford University", shortName: "Stanford" },
  { id: "harvard", name: "Harvard University", shortName: "Harvard" },
  { id: "mit", name: "Massachusetts Institute of Technology", shortName: "MIT" },
  { id: "upenn", name: "University of Pennsylvania", shortName: "UPenn" },
  { id: "princeton", name: "Princeton University", shortName: "Princeton" },
  { id: "yale", name: "Yale University", shortName: "Yale" },
  { id: "columbia", name: "Columbia University", shortName: "Columbia" },
  { id: "duke", name: "Duke University", shortName: "Duke" },
  { id: "northwestern", name: "Northwestern University", shortName: "Northwestern" },
  { id: "johns-hopkins", name: "Johns Hopkins University", shortName: "Johns Hopkins" },
  { id: "brown", name: "Brown University", shortName: "Brown" },
  { id: "cornell", name: "Cornell University", shortName: "Cornell" },
  { id: "dartmouth", name: "Dartmouth College", shortName: "Dartmouth" },
  { id: "ucla", name: "UCLA", shortName: "UCLA" },
  { id: "uc-berkeley", name: "UC Berkeley", shortName: "UC Berkeley" },
  { id: "uchicago", name: "University of Chicago", shortName: "UChicago" },
  { id: "vanderbilt", name: "Vanderbilt University", shortName: "Vanderbilt" },
  { id: "rice", name: "Rice University", shortName: "Rice" },
  { id: "notre-dame", name: "Notre Dame", shortName: "Notre Dame" },
  { id: "georgetown", name: "Georgetown University", shortName: "Georgetown" },
  { id: "cmu", name: "Carnegie Mellon University", shortName: "CMU" },
  { id: "nyu", name: "New York University", shortName: "NYU" },
  { id: "usc", name: "USC", shortName: "USC" },
  { id: "michigan", name: "University of Michigan", shortName: "Michigan" },
  { id: "unc", name: "UNC Chapel Hill", shortName: "UNC" }
].map((school) => ({
  ...school,
  logo: logoPath(school.id),
  logoStyle: LOGO_DISPLAY[school.id],
  alt: `${FULL_ALT_NAMES[school.id] || school.name} logo`
}));

/** Subset shown in the dashboard mockup “My Colleges” row */
export const DASHBOARD_COLLEGES = UNIVERSITIES.filter((school) =>
  ["stanford", "harvard", "mit", "upenn", "ucla"].includes(school.id)
);
