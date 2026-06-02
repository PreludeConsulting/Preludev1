const mediaBase = import.meta.env.BASE_URL;

function logoPath(id, ext) {
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
  logo: logoPath(school.id, "svg"),
  logoFallback: logoPath(school.id, "png"),
  alt: `${school.name} logo`
}));

/** Subset shown in the dashboard mockup “My Colleges” row */
export const DASHBOARD_COLLEGES = UNIVERSITIES.filter((school) =>
  ["stanford", "harvard", "mit", "upenn", "ucla"].includes(school.id)
);
