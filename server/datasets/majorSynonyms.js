function normalizeMajorKey(input = "") {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[./\\_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAJOR_ALIAS_GROUPS = [
  {
    canonical: "computer science",
    aliases: ["computer science", "cs", "comp sci", "compsci", "cse", "c s", "comp science"]
  },
  {
    canonical: "computer engineering",
    aliases: ["computer engineering", "cpe", "comp eng", "computer eng"]
  },
  {
    canonical: "electrical engineering",
    aliases: ["electrical engineering", "ee", "ece", "electrical eng", "electrical and computer engineering"]
  },
  {
    canonical: "mechanical engineering",
    aliases: ["mechanical engineering", "me", "mechanical eng"]
  },
  {
    canonical: "civil engineering",
    aliases: ["civil engineering", "ce", "civil eng"]
  },
  {
    canonical: "industrial engineering",
    aliases: ["industrial engineering", "ie", "industrial eng", "operations research engineering"]
  },
  {
    canonical: "chemical engineering",
    aliases: ["chemical engineering", "che", "chem e", "cheme", "chemical eng"]
  },
  {
    canonical: "biomedical engineering",
    aliases: ["biomedical engineering", "bme", "biomed engineering", "biomedical eng"]
  },
  {
    canonical: "aerospace engineering",
    aliases: ["aerospace engineering", "aero", "aero eng", "aeronautical engineering", "astronautical engineering"]
  },
  {
    canonical: "environmental engineering",
    aliases: ["environmental engineering", "enviro engineering", "environmental eng"]
  },
  {
    canonical: "materials science",
    aliases: ["materials science", "mse", "materials science engineering", "material science", "materials engineering"]
  },
  {
    canonical: "systems engineering",
    aliases: ["systems engineering", "systems eng", "system engineering"]
  },
  {
    canonical: "engineering physics",
    aliases: ["engineering physics", "eng physics"]
  },
  {
    canonical: "engineering science",
    aliases: ["engineering science", "engineering sciences"]
  },
  {
    canonical: "engineering",
    aliases: ["engineering", "eng"]
  },

  {
    canonical: "data science",
    aliases: ["data science", "ds"]
  },
  {
    canonical: "software engineering",
    aliases: ["software engineering", "swe", "software eng"]
  },
  {
    canonical: "artificial intelligence",
    aliases: ["artificial intelligence", "ai"]
  },
  {
    canonical: "machine learning",
    aliases: ["machine learning", "ml"]
  },
  {
    canonical: "cybersecurity",
    aliases: ["cybersecurity", "cyber security", "information security", "infosec"]
  },
  {
    canonical: "information systems",
    aliases: ["information systems", "is", "mis", "management information systems"]
  },

  {
    canonical: "mathematics",
    aliases: ["mathematics", "math", "maths"]
  },
  {
    canonical: "applied mathematics",
    aliases: ["applied mathematics", "applied math"]
  },
  {
    canonical: "statistics",
    aliases: ["statistics", "stats", "stat"]
  },
  {
    canonical: "physics",
    aliases: ["physics", "phys"]
  },
  {
    canonical: "chemistry",
    aliases: ["chemistry", "chem"]
  },
  {
    canonical: "biochemistry",
    aliases: ["biochemistry", "biochem"]
  },
  {
    canonical: "materials science",
    aliases: ["materials science", "material science"]
  },
  {
    canonical: "astronomy",
    aliases: ["astronomy", "astrophysics"]
  },
  {
    canonical: "geology",
    aliases: ["geology", "earth science", "earth sciences", "geoscience", "geosciences"]
  },

  {
    canonical: "biology",
    aliases: ["biology", "bio", "biological sciences", "biological science"]
  },
  {
    canonical: "molecular biology",
    aliases: ["molecular biology", "mol bio", "molecular bio"]
  },
  {
    canonical: "neuroscience",
    aliases: ["neuroscience", "neuro"]
  },
  {
    canonical: "genetics",
    aliases: ["genetics"]
  },
  {
    canonical: "microbiology",
    aliases: ["microbiology", "microbio"]
  },
  {
    canonical: "ecology",
    aliases: ["ecology", "evolutionary biology", "ecology and evolutionary biology", "eeb"]
  },
  {
    canonical: "bioengineering",
    aliases: ["bioengineering", "bio eng", "biological engineering"]
  },
  {
    canonical: "cognitive science",
    aliases: ["cognitive science", "cogsci", "cog sci"]
  },

  {
    canonical: "economics",
    aliases: ["economics", "econ"]
  },
  {
    canonical: "political science",
    aliases: ["political science", "poli sci", "polisci", "government", "gov"]
  },
  {
    canonical: "international relations",
    aliases: ["international relations", "ir", "international affairs", "global affairs"]
  },
  {
    canonical: "public policy",
    aliases: ["public policy", "policy"]
  },
  {
    canonical: "psychology",
    aliases: ["psychology", "psych"]
  },
  {
    canonical: "sociology",
    aliases: ["sociology", "soc"]
  },
  {
    canonical: "anthropology",
    aliases: ["anthropology", "anthro"]
  },

  {
    canonical: "english",
    aliases: ["english", "english literature", "literature"]
  },
  {
    canonical: "history",
    aliases: ["history"]
  },
  {
    canonical: "philosophy",
    aliases: ["philosophy", "phil"]
  },
  {
    canonical: "linguistics",
    aliases: ["linguistics", "ling"]
  },
  {
    canonical: "classics",
    aliases: ["classics", "classical studies"]
  },
  {
    canonical: "comparative literature",
    aliases: ["comparative literature", "comp lit", "comparative lit"]
  },
  {
    canonical: "art history",
    aliases: ["art history", "history of art"]
  },

  {
    canonical: "finance",
    aliases: ["finance"]
  },
  {
    canonical: "accounting",
    aliases: ["accounting", "acct"]
  },
  {
    canonical: "marketing",
    aliases: ["marketing"]
  },
  {
    canonical: "business administration",
    aliases: ["business administration", "business", "biz admin", "business admin"]
  },
  {
    canonical: "entrepreneurship",
    aliases: ["entrepreneurship", "entrepreneurial studies"]
  },
  {
    canonical: "pre-med",
    aliases: ["pre med", "premed", "pre medicine", "pre medical"]
  },
  {
    canonical: "pre-law",
    aliases: ["pre law", "prelaw"]
  },
  {
    canonical: "public health",
    aliases: ["public health", "global health"]
  },
  {
    canonical: "nursing",
    aliases: ["nursing"]
  }
];

const MAJOR_SYNONYMS = new Map();
for (const { canonical, aliases } of MAJOR_ALIAS_GROUPS) {
  MAJOR_SYNONYMS.set(normalizeMajorKey(canonical), canonical);
  for (const alias of aliases) {
    MAJOR_SYNONYMS.set(normalizeMajorKey(alias), canonical);
  }
}

export function normalizeMajorTerm(input = "") {
  const normalized = normalizeMajorKey(input);
  if (!normalized) return "";
  return MAJOR_SYNONYMS.get(normalized) ?? normalized;
}

export function expandMajorSearchPattern(majorTerm) {
  const normalized = normalizeMajorTerm(majorTerm);
  if (!normalized) return "";
  return normalized;
}

export { normalizeMajorKey };
