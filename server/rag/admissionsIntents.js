export const ADMISSIONS_INTENT_CATEGORIES = {
  COLLEGE_SEARCH: "college_search",
  SCHOOL_FACT: "school_fact",
  SCHOOL_COMPARISON: "school_comparison",
  ADMISSIONS_COMPETITIVENESS: "admissions_competitiveness",
  SAT_ACT: "sat_act",
  GPA_ACADEMICS: "gpa_academics",
  EXTRACURRICULARS: "extracurriculars",
  CS_PROJECTS: "cs_projects",
  SUMMER_PROGRAMS: "summer_programs",
  SCHOLARSHIPS: "scholarships",
  FINANCIAL_AID: "financial_aid",
  ESSAYS: "essays",
  ACTIVITIES_LIST: "activities_list",
  APPLICATION_STRATEGY: "application_strategy",
  MAJOR_CAREER: "major_career",
  SCHOOL_FIT: "school_fit",
  PARENT: "parent",
  MENTOR_MATCH: "mentor_match",
  INTERNATIONAL: "international",
  TRANSFER: "transfer",
  WAITLIST_DEFERRAL: "waitlist_deferral",
  COLLEGE_CHOICE: "college_choice",
  COMMON_APP_HELP: "common_app_help",
  RECOMMENDATIONS: "recommendations",
  INTERVIEWS: "interviews",
  SPECIAL_APPLICANT: "special_applicant",
  PLANNING: "planning",
  ADMISSIONS_EDUCATION: "admissions_education",
  GENERAL: "general_admissions"
};

export const KNOWLEDGE_SOURCE_MAP = {
  [ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.SCHOOL_COMPARISON]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.SAT_ACT]: ["sat_report", "act_report", "university"],
  [ADMISSIONS_INTENT_CATEGORIES.GPA_ACADEMICS]: [],
  [ADMISSIONS_INTENT_CATEGORIES.EXTRACURRICULARS]: ["extracurricular"],
  [ADMISSIONS_INTENT_CATEGORIES.CS_PROJECTS]: ["cs_project"],
  [ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS]: ["summer_program"],
  [ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS]: ["scholarship"],
  [ADMISSIONS_INTENT_CATEGORIES.FINANCIAL_AID]: ["university", "financial_aid"],
  [ADMISSIONS_INTENT_CATEGORIES.ESSAYS]: ["essays"],
  [ADMISSIONS_INTENT_CATEGORIES.ACTIVITIES_LIST]: ["extracurricular"],
  [ADMISSIONS_INTENT_CATEGORIES.APPLICATION_STRATEGY]: [],
  [ADMISSIONS_INTENT_CATEGORIES.MAJOR_CAREER]: ["careers"],
  [ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FIT]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.PARENT]: [],
  [ADMISSIONS_INTENT_CATEGORIES.MENTOR_MATCH]: [],
  [ADMISSIONS_INTENT_CATEGORIES.INTERNATIONAL]: [],
  [ADMISSIONS_INTENT_CATEGORIES.TRANSFER]: [],
  [ADMISSIONS_INTENT_CATEGORIES.WAITLIST_DEFERRAL]: [],
  [ADMISSIONS_INTENT_CATEGORIES.COLLEGE_CHOICE]: ["university"],
  [ADMISSIONS_INTENT_CATEGORIES.COMMON_APP_HELP]: [],
  [ADMISSIONS_INTENT_CATEGORIES.RECOMMENDATIONS]: [],
  [ADMISSIONS_INTENT_CATEGORIES.INTERVIEWS]: [],
  [ADMISSIONS_INTENT_CATEGORIES.SPECIAL_APPLICANT]: [],
  [ADMISSIONS_INTENT_CATEGORIES.PLANNING]: [],
  [ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_EDUCATION]: [],
  [ADMISSIONS_INTENT_CATEGORIES.GENERAL]: []
};

export const INTENT_RULES = [
  {
    category: ADMISSIONS_INTENT_CATEGORIES.MENTOR_MATCH,
    patterns: [/\b(find a mentor|match me|preludematch|mentor match|talk to a mentor|brown mentor|essay help from mentor)\b/i],
    priority: 10
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.WAITLIST_DEFERRAL,
    patterns: [/\b(waitlisted?|deferred|loci|letter of continued interest|appeal|rejection)\b/i],
    priority: 9
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SCHOOL_COMPARISON,
    patterns: [/\b(compare|versus|vs\.?|better than|which is better)\b.{0,40}\b(college|school|university)\b/i, /\bcompare\b.+\b(and|vs\.?|versus)\b/i],
    priority: 8
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS,
    patterns: [/\b(scholarship|merit aid|award amount|scholarships due)\b/i],
    priority: 8
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS,
    patterns: [/\b(summer program|pre-college|rsi|yygs|summer camp)\b/i],
    priority: 8
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.CS_PROJECTS,
    patterns: [/\b(cs project|coding project|computer science project|github project|portfolio project)\b/i],
    priority: 8
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.EXTRACURRICULARS,
    patterns: [/\b(extracurricular|activity profile|leadership role|club|volunteer|improve my activities)\b/i],
    priority: 7
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SAT_ACT,
    patterns: [/\b(sat|act|psat|test optional|retake the sat|retake the act|submit my score)\b/i],
    priority: 7
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS,
    patterns: [/\b(can i get in|will i get in|my chances|do i have a shot|competitive for|good enough for|profile good enough)\b/i],
    priority: 7
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT,
    patterns: [/\b(average sat|sat average|admission rate|acceptance rate|tuition|how much does|where is|located)\b/i],
    priority: 7
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH,
    patterns: [/\b(college list|build.{0,20}list|reach.{0,20}target|safety schools?|what colleges|schools should i apply|colleges fit)\b/i, /\b(find|recommend|suggest).{0,30}\b(college|school|universit)/i],
    priority: 6
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.FINANCIAL_AID,
    patterns: [/\b(fafsa|css profile|financial aid|net price|grants? and loans?|work-study|pay for college|afford college)\b/i],
    priority: 6
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.ESSAYS,
    patterns: [/\b(essay|personal statement|common app essay|supplement|why us essay|brainstorm.{0,20}essay|review my essay)\b/i],
    priority: 6
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.ACTIVITIES_LIST,
    patterns: [/\b(activities section|common app activities|brag sheet|describe my activit|resume for college)\b/i],
    priority: 6
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.APPLICATION_STRATEGY,
    patterns: [/\b(early decision|early action|regular decision|rolling admission|application timeline|what should.{0,20}do this month|how many colleges should i apply)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.GPA_ACADEMICS,
    patterns: [/\b(gpa|ap class|course rigor|junior year classes|drop an ap|academic profile)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.MAJOR_CAREER,
    patterns: [/\b(what major|choose a major|major should i|pre-med|career with|major in)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.PARENT,
    patterns: [/\b(my son|my daughter|my kid|as a parent|help my child|parents? should)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.INTERNATIONAL,
    patterns: [/\b(international student|toefl|ielts|visa|study abroad applicant)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.TRANSFER,
    patterns: [/\b(transfer college|transfer admissions|apply as a transfer)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.COMMON_APP_HELP,
    patterns: [/\b(common app|ferpa waiver|invite recommender|honors section|additional information section)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.RECOMMENDATIONS,
    patterns: [/\b(recommendation letter|rec letter|who should i ask|teacher recommendation|counselor rec)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.INTERVIEWS,
    patterns: [/\b(college interview|mock interview|tell me about yourself|interviewer ask)\b/i],
    priority: 5
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FIT,
    patterns: [/\b(small college|big university|urban or rural|liberal arts college|campus visit|school culture|type of college fits)\b/i],
    priority: 4
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.PLANNING,
    patterns: [/\b(what should i do next|make me a plan|overwhelmed|checklist|what should i do this week)\b/i],
    priority: 4
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_EDUCATION,
    patterns: [/\b(holistic admissions|demonstrated interest|what is a safety school|need-blind|yield|test optional mean)\b/i],
    priority: 3
  },
  {
    category: ADMISSIONS_INTENT_CATEGORIES.SPECIAL_APPLICANT,
    patterns: [/\b(recruited athlete|portfolio|first-gen|low-income student|homeschool|gap year|community college pathway|accommodations)\b/i],
    priority: 3
  }
];

export const PROFILE_REQUIREMENTS = {
  [ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH]: ["gpa", "sat_or_act", "major", "location_or_budget"],
  [ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS]: ["grade_level", "interests"],
  [ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS]: ["gpa", "sat_or_act", "activities"],
  [ADMISSIONS_INTENT_CATEGORIES.SAT_ACT]: ["sat_or_act"],
  [ADMISSIONS_INTENT_CATEGORIES.EXTRACURRICULARS]: ["interests_or_major"],
  [ADMISSIONS_INTENT_CATEGORIES.CS_PROJECTS]: ["skill_level"],
  [ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS]: ["interests", "grade_level"],
  [ADMISSIONS_INTENT_CATEGORIES.ESSAYS]: ["essay_stage"]
};
