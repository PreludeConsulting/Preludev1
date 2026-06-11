const mediaBase = import.meta.env.BASE_URL;

export const COLLEGE_LIST_STATUSES = [
  "Interested",
  "Researching",
  "Applying",
  "Submitted",
  "Accepted"
];

export const COLLEGE_STATUS_VARIANT = {
  Interested: "info",
  Researching: "lavender",
  Applying: "gold",
  Submitted: "muted",
  Accepted: "success"
};

export const COLLEGE_FILTER_GROUPS = [
  { id: "majors", label: "Majors" },
  { id: "location", label: "Location" },
  { id: "type", label: "Type" },
  { id: "affordability", label: "Affordability" },
  { id: "campusLife", label: "Campus Life" },
  { id: "admissions", label: "Admissions" },
  { id: "match", label: "Reach / Target / Safety" },
  { id: "tests", label: "SAT / ACT" },
  { id: "enrollment", label: "Enrollment Size" }
];

export const SORT_OPTIONS = [
  { id: "ranking", label: "Ranking" },
  { id: "acceptance", label: "Acceptance Rate" },
  { id: "tuition", label: "Tuition" },
  { id: "graduation", label: "Graduation Rate" },
  { id: "alpha", label: "Alphabetical" }
];

const MAJOR_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Biology",
  "Economics",
  "Psychology",
  "Political Science",
  "Nursing",
  "Education",
  "Communications"
];

const REGION_OPTIONS = [
  { id: "northeast", label: "Northeast" },
  { id: "south", label: "South" },
  { id: "midwest", label: "Midwest" },
  { id: "west", label: "West" },
  { id: "california", label: "California" }
];

const STATE_REGION = {
  MA: "northeast",
  CT: "northeast",
  RI: "northeast",
  NH: "northeast",
  VT: "northeast",
  ME: "northeast",
  NY: "northeast",
  NJ: "northeast",
  PA: "northeast",
  MD: "northeast",
  DC: "northeast",
  CA: "california",
  GA: "south",
  FL: "south",
  NC: "south",
  SC: "south",
  VA: "south",
  TN: "south",
  AL: "south",
  LA: "south",
  TX: "south",
  OK: "south",
  KY: "south",
  MO: "midwest",
  IL: "midwest",
  IN: "midwest",
  OH: "midwest",
  MI: "midwest",
  WI: "midwest",
  MN: "midwest",
  IA: "midwest",
  NE: "midwest",
  KS: "midwest",
  WA: "west",
  OR: "west",
  CO: "west",
  AZ: "west",
  UT: "west",
  NV: "west"
};

function logoPath(id) {
  return `${mediaBase}media/universities/${id}.png`;
}

function campusImage(id) {
  return `https://picsum.photos/seed/prelude-${id}/800/520`;
}

function tierFromRank(rank) {
  if (rank <= 20) return "reach";
  if (rank <= 50) return "target";
  return "safety";
}

function statsForRank(rank, type) {
  const isPublic = type === "Public";
  const acceptanceRate = isPublic
    ? Math.round(Math.min(78, 12 + rank * 0.62))
    : Math.round(Math.max(4, 3 + rank * 0.28));
  const graduationRate = Math.round(Math.max(62, 97 - rank * 0.22));
  const tuition = isPublic
    ? Math.round(12000 + rank * 180 + (rank > 40 ? 4000 : 0))
    : Math.round(42000 + rank * 220);
  const satMin = Math.max(980, 1540 - rank * 5);
  const satMax = Math.min(1600, satMin + 70);
  const enrollment = isPublic
    ? Math.round(8000 + rank * 420 + (rank > 60 ? 6000 : 0))
    : Math.round(2500 + rank * 95);
  return { acceptanceRate, graduationRate, tuition, satMin, satMax, enrollment };
}

function college(rank, id, name, shortName, city, state, type, extras = {}) {
  const stats = statsForRank(rank, type);
  const majors = extras.majors || [
    MAJOR_OPTIONS[rank % MAJOR_OPTIONS.length],
    MAJOR_OPTIONS[(rank + 3) % MAJOR_OPTIONS.length]
  ];
  return {
    id,
    rank,
    name,
    shortName,
    location: `${city}, ${state === "DC" ? "District of Columbia" : `${STATE_NAMES[state] || state}`}`,
    city,
    state,
    region: STATE_REGION[state] || "south",
    type,
    ...stats,
    ...extras,
    majors,
    campusLife: extras.campusLife || (rank <= 25 ? ["Urban", "Research"] : ["Suburban", "Division I"]),
    affordability: extras.affordability || (stats.tuition > 55000 ? "premium" : stats.tuition < 20000 ? "value" : "moderate"),
    matchCategory: extras.matchCategory || tierFromRank(rank),
    image: campusImage(id),
    logo: logoPath(id)
  };
}

const STATE_NAMES = {
  MA: "Massachusetts",
  CA: "California",
  NJ: "New Jersey",
  CT: "Connecticut",
  IL: "Illinois",
  MD: "Maryland",
  NY: "New York",
  PA: "Pennsylvania",
  NC: "North Carolina",
  GA: "Georgia",
  TX: "Texas",
  MI: "Michigan",
  OH: "Ohio",
  FL: "Florida",
  WA: "Washington",
  WI: "Wisconsin",
  IN: "Indiana",
  MN: "Minnesota",
  MO: "Missouri",
  CO: "Colorado",
  AZ: "Arizona",
  OR: "Oregon",
  TN: "Tennessee",
  VA: "Virginia",
  DC: "District of Columbia",
  LA: "Louisiana",
  AL: "Alabama",
  SC: "South Carolina",
  IA: "Iowa",
  NE: "Nebraska",
  KS: "Kansas",
  OK: "Oklahoma",
  UT: "Utah",
  NV: "Nevada",
  KY: "Kentucky"
};

/** THE-inspired US ranking order (MIT through Georgia State University). */
export const EXPLORE_COLLEGES = [
  college(1, "mit", "Massachusetts Institute of Technology", "MIT", "Cambridge", "MA", "Private", {
    acceptanceRate: 4,
    graduationRate: 94,
    tuition: 59750,
    satMin: 1520,
    satMax: 1580,
    enrollment: 4657,
    majors: ["Computer Science", "Engineering", "Physics"]
  }),
  college(2, "stanford", "Stanford University", "Stanford", "Stanford", "CA", "Private", {
    acceptanceRate: 4,
    graduationRate: 96,
    tuition: 62484,
    satMin: 1500,
    satMax: 1570,
    enrollment: 7761,
    majors: ["Computer Science", "Engineering", "Economics"]
  }),
  college(3, "princeton", "Princeton University", "Princeton", "Princeton", "NJ", "Private", {
    acceptanceRate: 6,
    graduationRate: 97,
    tuition: 59710,
    satMin: 1500,
    satMax: 1560,
    enrollment: 5604
  }),
  college(4, "harvard", "Harvard University", "Harvard", "Cambridge", "MA", "Private", {
    acceptanceRate: 3,
    graduationRate: 97,
    tuition: 59076,
    satMin: 1490,
    satMax: 1580,
    enrollment: 7240
  }),
  college(5, "caltech", "California Institute of Technology", "Caltech", "Pasadena", "CA", "Private", {
    acceptanceRate: 3,
    graduationRate: 92,
    tuition: 63402,
    satMin: 1530,
    satMax: 1580,
    enrollment: 987,
    id: "caltech"
  }),
  college(6, "uc-berkeley", "University of California, Berkeley", "UC Berkeley", "Berkeley", "CA", "Public", {
    acceptanceRate: 11,
    graduationRate: 93,
    tuition: 15860,
    satMin: 1330,
    satMax: 1530,
    enrollment: 32143
  }),
  college(7, "yale", "Yale University", "Yale", "New Haven", "CT", "Private", {
    acceptanceRate: 5,
    graduationRate: 96,
    tuition: 64700,
    satMin: 1480,
    satMax: 1570,
    enrollment: 6536
  }),
  college(8, "columbia", "Columbia University", "Columbia", "New York", "NY", "Private", {
    acceptanceRate: 4,
    graduationRate: 95,
    tuition: 68400,
    satMin: 1490,
    satMax: 1570,
    enrollment: 9089
  }),
  college(9, "ucla", "University of California, Los Angeles", "UCLA", "Los Angeles", "CA", "Public", {
    acceptanceRate: 9,
    graduationRate: 92,
    tuition: 14604,
    satMin: 1290,
    satMax: 1510,
    enrollment: 32879
  }),
  college(10, "uchicago", "University of Chicago", "UChicago", "Chicago", "IL", "Private", {
    acceptanceRate: 5,
    graduationRate: 94,
    tuition: 65619,
    satMin: 1510,
    satMax: 1570,
    enrollment: 7526
  }),
  college(11, "upenn", "University of Pennsylvania", "UPenn", "Philadelphia", "PA", "Private", {
    acceptanceRate: 6,
    graduationRate: 96,
    tuition: 63452,
    satMin: 1480,
    satMax: 1570,
    enrollment: 10643
  }),
  college(12, "johns-hopkins", "Johns Hopkins University", "Johns Hopkins", "Baltimore", "MD", "Private", {
    acceptanceRate: 7,
    graduationRate: 94,
    tuition: 62840,
    satMin: 1500,
    satMax: 1570,
    enrollment: 6044
  }),
  college(13, "cornell", "Cornell University", "Cornell", "Ithaca", "NY", "Private", {
    acceptanceRate: 7,
    graduationRate: 95,
    tuition: 65204,
    satMin: 1470,
    satMax: 1560,
    enrollment: 15735
  }),
  college(14, "duke", "Duke University", "Duke", "Durham", "NC", "Private", {
    acceptanceRate: 6,
    graduationRate: 96,
    tuition: 63450,
    satMin: 1490,
    satMax: 1570,
    enrollment: 6889
  }),
  college(15, "northwestern", "Northwestern University", "Northwestern", "Evanston", "IL", "Private", {
    acceptanceRate: 7,
    graduationRate: 95,
    tuition: 64992,
    satMin: 1470,
    satMax: 1560,
    enrollment: 8947
  }),
  college(16, "michigan", "University of Michigan", "Michigan", "Ann Arbor", "MI", "Public", {
    acceptanceRate: 18,
    graduationRate: 93,
    tuition: 17348,
    satMin: 1340,
    satMax: 1530,
    enrollment: 32282
  }),
  college(17, "cmu", "Carnegie Mellon University", "CMU", "Pittsburgh", "PA", "Private", {
    acceptanceRate: 11,
    graduationRate: 92,
    tuition: 63272,
    satMin: 1480,
    satMax: 1560,
    enrollment: 7229
  }),
  college(18, "nyu", "New York University", "NYU", "New York", "NY", "Private", {
    acceptanceRate: 12,
    graduationRate: 87,
    tuition: 60438,
    satMin: 1370,
    satMax: 1530,
    enrollment: 29123
  }),
  college(19, "uw", "University of Washington", "UW", "Seattle", "WA", "Public", {}),
  college(20, "ucsd", "University of California, San Diego", "UC San Diego", "La Jolla", "CA", "Public", {}),
  college(21, "georgia-tech", "Georgia Institute of Technology", "Georgia Tech", "Atlanta", "GA", "Public", {
    acceptanceRate: 16,
    graduationRate: 92,
    tuition: 12682,
    satMin: 1370,
    satMax: 1530,
    enrollment: 18489,
    majors: ["Computer Science", "Engineering", "Business"]
  }),
  college(22, "ut-austin", "University of Texas at Austin", "UT Austin", "Austin", "TX", "Public", {}),
  college(23, "wisconsin", "University of Wisconsin–Madison", "Wisconsin", "Madison", "WI", "Public", {}),
  college(24, "uiuc", "University of Illinois Urbana-Champaign", "UIUC", "Champaign", "IL", "Public", {}),
  college(25, "unc", "University of North Carolina at Chapel Hill", "UNC", "Chapel Hill", "NC", "Public", {
    acceptanceRate: 17,
    graduationRate: 91,
    tuition: 9005,
    satMin: 1320,
    satMax: 1500,
    enrollment: 20118
  }),
  college(26, "bu", "Boston University", "BU", "Boston", "MA", "Private", {}),
  college(27, "usc", "University of Southern California", "USC", "Los Angeles", "CA", "Private", {}),
  college(28, "uc-davis", "University of California, Davis", "UC Davis", "Davis", "CA", "Public", {}),
  college(29, "uci", "University of California, Irvine", "UC Irvine", "Irvine", "CA", "Public", {}),
  college(30, "purdue", "Purdue University", "Purdue", "West Lafayette", "IN", "Public", {}),
  college(31, "rice", "Rice University", "Rice", "Houston", "TX", "Private", {}),
  college(32, "vanderbilt", "Vanderbilt University", "Vanderbilt", "Nashville", "TN", "Private", {}),
  college(33, "brown", "Brown University", "Brown", "Providence", "RI", "Private", {}),
  college(34, "dartmouth", "Dartmouth College", "Dartmouth", "Hanover", "NH", "Private", {}),
  college(35, "georgetown", "Georgetown University", "Georgetown", "Washington", "DC", "Private", {}),
  college(36, "uva", "University of Virginia", "UVA", "Charlottesville", "VA", "Public", {}),
  college(37, "uf", "University of Florida", "Florida", "Gainesville", "FL", "Public", {}),
  college(38, "ohio-state", "Ohio State University", "Ohio State", "Columbus", "OH", "Public", {}),
  college(39, "penn-state", "Pennsylvania State University", "Penn State", "University Park", "PA", "Public", {}),
  college(40, "umd", "University of Maryland", "Maryland", "College Park", "MD", "Public", {}),
  college(41, "asu", "Arizona State University", "ASU", "Tempe", "AZ", "Public", {}),
  college(42, "msu", "Michigan State University", "Michigan State", "East Lansing", "MI", "Public", {}),
  college(43, "indiana", "Indiana University Bloomington", "Indiana", "Bloomington", "IN", "Public", {}),
  college(44, "minnesota", "University of Minnesota", "Minnesota", "Minneapolis", "MN", "Public", {}),
  college(45, "tamu", "Texas A&M University", "Texas A&M", "College Station", "TX", "Public", {}),
  college(46, "pitt", "University of Pittsburgh", "Pitt", "Pittsburgh", "PA", "Public", {}),
  college(47, "rutgers", "Rutgers University", "Rutgers", "New Brunswick", "NJ", "Public", {}),
  college(48, "colorado", "University of Colorado Boulder", "Colorado", "Boulder", "CO", "Public", {}),
  college(49, "arizona", "University of Arizona", "Arizona", "Tucson", "AZ", "Public", {}),
  college(50, "fsu", "Florida State University", "Florida State", "Tallahassee", "FL", "Public", {}),
  college(51, "iowa", "University of Iowa", "Iowa", "Iowa City", "IA", "Public", {}),
  college(52, "virginia-tech", "Virginia Tech", "Virginia Tech", "Blacksburg", "VA", "Public", {}),
  college(53, "nc-state", "North Carolina State University", "NC State", "Raleigh", "NC", "Public", {}),
  college(54, "miami", "University of Miami", "Miami", "Coral Gables", "FL", "Private", {}),
  college(55, "uconn", "University of Connecticut", "UConn", "Storrs", "CT", "Public", {}),
  college(56, "oregon", "University of Oregon", "Oregon", "Eugene", "OR", "Public", {}),
  college(57, "kansas", "University of Kansas", "Kansas", "Lawrence", "KS", "Public", {}),
  college(58, "tennessee", "University of Tennessee", "Tennessee", "Knoxville", "TN", "Public", {}),
  college(59, "auburn", "Auburn University", "Auburn", "Auburn", "AL", "Public", {}),
  college(60, "clemson", "Clemson University", "Clemson", "Clemson", "SC", "Public", {}),
  college(61, "rochester", "University of Rochester", "Rochester", "Rochester", "NY", "Private", {}),
  college(62, "brandeis", "Brandeis University", "Brandeis", "Waltham", "MA", "Private", {}),
  college(63, "wake-forest", "Wake Forest University", "Wake Forest", "Winston-Salem", "NC", "Private", {}),
  college(64, "case-western", "Case Western Reserve University", "Case Western", "Cleveland", "OH", "Private", {}),
  college(65, "tufts", "Tufts University", "Tufts", "Medford", "MA", "Private", {}),
  college(66, "boston-college", "Boston College", "Boston College", "Chestnut Hill", "MA", "Private", {}),
  college(67, "tulane", "Tulane University", "Tulane", "New Orleans", "LA", "Private", {}),
  college(68, "rpi", "Rensselaer Polytechnic Institute", "RPI", "Troy", "NY", "Private", {}),
  college(69, "lehigh", "Lehigh University", "Lehigh", "Bethlehem", "PA", "Private", {}),
  college(70, "pepperdine", "Pepperdine University", "Pepperdine", "Malibu", "CA", "Private", {}),
  college(71, "syracuse", "Syracuse University", "Syracuse", "Syracuse", "NY", "Private", {}),
  college(72, "drexel", "Drexel University", "Drexel", "Philadelphia", "PA", "Private", {}),
  college(73, "temple", "Temple University", "Temple", "Philadelphia", "PA", "Public", {}),
  college(74, "gwu", "George Washington University", "GWU", "Washington", "DC", "Private", {}),
  college(75, "american", "American University", "American", "Washington", "DC", "Private", {}),
  college(76, "fiu", "Florida International University", "FIU", "Miami", "FL", "Public", {}),
  college(77, "sdsu", "San Diego State University", "SDSU", "San Diego", "CA", "Public", {}),
  college(78, "utah", "University of Utah", "Utah", "Salt Lake City", "UT", "Public", {}),
  college(79, "oregon-state", "Oregon State University", "Oregon State", "Corvallis", "OR", "Public", {}),
  college(80, "kansas-state", "Kansas State University", "Kansas State", "Manhattan", "KS", "Public", {}),
  college(81, "missouri", "University of Missouri", "Missouri", "Columbia", "MO", "Public", {}),
  college(82, "louisville", "University of Louisville", "Louisville", "Louisville", "KY", "Public", {}),
  college(83, "nebraska", "University of Nebraska–Lincoln", "Nebraska", "Lincoln", "NE", "Public", {}),
  college(84, "oklahoma", "University of Oklahoma", "Oklahoma", "Norman", "OK", "Public", {}),
  college(85, "georgia-state", "Georgia State University", "Georgia State", "Atlanta", "GA", "Public", {
    acceptanceRate: 67,
    graduationRate: 54,
    tuition: 9710,
    satMin: 990,
    satMax: 1180,
    enrollment: 27434,
    matchCategory: "safety",
    affordability: "value",
    majors: ["Business", "Nursing", "Computer Science"]
  })
];

export const INITIAL_SAVED_COLLEGES = [
  { collegeId: "stanford", status: "Researching" },
  { collegeId: "georgia-tech", status: "Applying" },
  { collegeId: "ucla", status: "Interested" },
  { collegeId: "michigan", status: "Interested" }
];

export const FILTER_OPTION_SETS = {
  majors: MAJOR_OPTIONS.map((m) => ({ id: m, label: m })),
  location: REGION_OPTIONS,
  type: [
    { id: "Public", label: "Public" },
    { id: "Private", label: "Private" }
  ],
  affordability: [
    { id: "value", label: "Under $20k" },
    { id: "moderate", label: "$20k–$45k" },
    { id: "premium", label: "Over $45k" }
  ],
  campusLife: [
    { id: "Urban", label: "Urban campus" },
    { id: "Suburban", label: "Suburban campus" },
    { id: "Research", label: "Research university" },
    { id: "Division I", label: "Division I athletics" }
  ],
  admissions: [
    { id: "ultra", label: "Under 10%" },
    { id: "selective", label: "10%–25%" },
    { id: "moderate", label: "25%–50%" },
    { id: "open", label: "Over 50%" }
  ],
  match: [
    { id: "reach", label: "Reach" },
    { id: "target", label: "Target" },
    { id: "safety", label: "Safety" }
  ],
  tests: [
    { id: "1500", label: "SAT 1500+" },
    { id: "1400", label: "SAT 1400–1490" },
    { id: "1300", label: "SAT 1300–1390" },
    { id: "1200", label: "SAT under 1300" }
  ],
  enrollment: [
    { id: "small", label: "Under 8,000" },
    { id: "medium", label: "8,000–20,000" },
    { id: "large", label: "Over 20,000" }
  ]
};

export function formatTuition(value) {
  return `$${value.toLocaleString()}`;
}

export function formatAcceptance(value) {
  return `${value}% Acceptance Rate`;
}

export function formatGraduation(value) {
  return `${value}% Graduation Rate`;
}

export function formatSatRange(min, max) {
  return `${min}–${max} SAT`;
}

export function formatEnrollment(value) {
  return `${value.toLocaleString()} Undergraduates`;
}

export function collegeById(id) {
  return EXPLORE_COLLEGES.find((c) => c.id === id);
}

export function filterColleges(colleges, filters, searchQuery) {
  const query = searchQuery.trim().toLowerCase();
  return colleges.filter((school) => {
    if (query && !school.name.toLowerCase().includes(query) && !school.city.toLowerCase().includes(query)) {
      return false;
    }

    if (filters.majors?.length && !filters.majors.some((m) => school.majors.includes(m))) return false;
    if (filters.location?.length && !filters.location.includes(school.region)) return false;
    if (filters.type?.length && !filters.type.includes(school.type)) return false;
    if (filters.affordability?.length && !filters.affordability.includes(school.affordability)) return false;
    if (filters.campusLife?.length && !filters.campusLife.some((tag) => school.campusLife.includes(tag))) return false;

    if (filters.admissions?.length) {
      const band =
        school.acceptanceRate < 10
          ? "ultra"
          : school.acceptanceRate <= 25
            ? "selective"
            : school.acceptanceRate <= 50
              ? "moderate"
              : "open";
      if (!filters.admissions.includes(band)) return false;
    }

    if (filters.match?.length && !filters.match.includes(school.matchCategory)) return false;

    if (filters.tests?.length) {
      const satBand =
        school.satMin >= 1500 ? "1500" : school.satMin >= 1400 ? "1400" : school.satMin >= 1300 ? "1300" : "1200";
      if (!filters.tests.includes(satBand)) return false;
    }

    if (filters.enrollment?.length) {
      const size = school.enrollment < 8000 ? "small" : school.enrollment <= 20000 ? "medium" : "large";
      if (!filters.enrollment.includes(size)) return false;
    }

    return true;
  });
}

export function sortColleges(colleges, sortId) {
  const list = [...colleges];
  switch (sortId) {
    case "acceptance":
      return list.sort((a, b) => a.acceptanceRate - b.acceptanceRate);
    case "tuition":
      return list.sort((a, b) => a.tuition - b.tuition);
    case "graduation":
      return list.sort((a, b) => b.graduationRate - a.graduationRate);
    case "alpha":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "ranking":
    default:
      return list.sort((a, b) => a.rank - b.rank);
  }
}

export function matchCollegesWithProfile(answers) {
  const {
    major = "",
    location = "",
    type = "",
    size = "",
    budget = "",
    matchPreference = ""
  } = answers;

  const scored = EXPLORE_COLLEGES.map((school) => {
    let score = 100 - school.rank * 0.4;

    if (major && school.majors.some((m) => m.toLowerCase().includes(major.toLowerCase()))) score += 18;
    if (location && school.region === location) score += 14;
    if (type && school.type === type) score += 10;
    if (matchPreference && school.matchCategory === matchPreference) score += 12;

    if (size === "small" && school.enrollment < 8000) score += 8;
    if (size === "medium" && school.enrollment >= 8000 && school.enrollment <= 20000) score += 8;
    if (size === "large" && school.enrollment > 20000) score += 8;

    if (budget === "value" && school.affordability === "value") score += 10;
    if (budget === "moderate" && school.affordability === "moderate") score += 8;
    if (budget === "premium" && school.affordability === "premium") score += 6;

    return { school, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.school);
}
