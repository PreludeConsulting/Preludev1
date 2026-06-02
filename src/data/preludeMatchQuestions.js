/**
 * Adaptive PreludeMatch questionnaire configuration.
 * @typedef {Object} PreludeMatchShowWhen
 * @property {string} [questionId]
 * @property {string[]} [includesAny]
 * @property {string} [equals]
 * @property {number} [minNumber]
 * @property {boolean} [hasCollegeSelection]
 *
 * @typedef {Object} PreludeMatchQuestion
 * @property {string} id
 * @property {'single-select'|'multi-select'|'open-response'|'college-search'|'scale'} type
 * @property {string} question
 * @property {string} [helperText]
 * @property {string[]} [options]
 * @property {number} [maxChoices]
 * @property {boolean} [required]
 * @property {PreludeMatchShowWhen} [showWhen]
 * @property {{ min: number; max: number; lowLabel?: string; highLabel?: string }} [scale]
 */

/** @type {PreludeMatchQuestion[]} */
export const PRELUDE_MATCH_QUESTIONS = [
  {
    id: "grade",
    type: "single-select",
    question: "What grade are you currently in?",
    required: true,
    options: [
      "9th grade",
      "10th grade",
      "11th grade",
      "12th grade",
      "Gap year",
      "College student exploring transfer options",
      "Parent or guardian"
    ]
  },
  {
    id: "processStage",
    type: "multi-select",
    question: "Where are you in the college-planning process?",
    helperText: "Choose every option that currently applies.",
    required: true,
    options: [
      "Just starting to explore",
      "Building my college list",
      "Planning extracurriculars and academics",
      "Preparing for applications",
      "Writing essays",
      "Submitting applications",
      "Comparing admissions offers",
      "Exploring financial aid and scholarships",
      "I am not sure where to begin"
    ]
  },
  {
    id: "helpAreas",
    type: "multi-select",
    question: "What would you most like help with?",
    helperText: "Choose up to four.",
    maxChoices: 4,
    required: true,
    options: [
      "Choosing colleges",
      "Application strategy",
      "Extracurricular planning",
      "Academic profile review",
      "Essay brainstorming",
      "Essay editing",
      "Scholarships",
      "Financial aid",
      "Organization and deadlines",
      "Interview preparation",
      "Comparing offers",
      "I am not sure yet"
    ]
  },
  {
    id: "academicInterests",
    type: "multi-select",
    question: "Which academic areas interest you?",
    helperText: "Choose any that apply.",
    required: true,
    options: [
      "Computer science",
      "Engineering",
      "Business",
      "Economics",
      "Pre-med",
      "Health sciences",
      "Natural sciences",
      "Mathematics",
      "Humanities",
      "Social sciences",
      "Arts and design",
      "Undecided or exploring"
    ]
  },
  {
    id: "colleges",
    type: "college-search",
    question: "Which colleges and universities are currently on your radar?",
    helperText: "Search for and select any schools you are considering.",
    required: true
  },
  {
    id: "mentorQualities",
    type: "multi-select",
    question: "What qualities matter most in a mentor?",
    helperText: "Choose up to four.",
    maxChoices: 4,
    required: true,
    options: [
      "Attended a school I am considering",
      "Similar academic interest",
      "Similar background or experience",
      "Structured step-by-step guidance",
      "Accountability and check-ins",
      "Encouraging and easy to talk to",
      "Essay-writing experience",
      "Financial-aid knowledge",
      "Competitive-admissions experience",
      "Helps me explore options"
    ]
  },
  {
    id: "structureScale",
    type: "scale",
    question: "How much structure would you like from your mentor?",
    required: true,
    scale: {
      min: 1,
      max: 5,
      lowLabel: "Flexible and conversational",
      highLabel: "Highly structured and deadline-focused"
    }
  },
  {
    id: "biggestQuestion",
    type: "open-response",
    question: "What is your biggest admissions question right now?",
    helperText: "A short response is enough.",
    required: false,
    placeholder:
      "For example: I am not sure whether my extracurricular profile is strong enough for engineering programs."
  },
  {
    id: "accomplishFirst",
    type: "multi-select",
    question: "What would you like to accomplish first?",
    helperText: "Choose up to three.",
    maxChoices: 3,
    required: true,
    options: [
      "Create an admissions roadmap",
      "Build my college list",
      "Review my academic profile",
      "Strengthen my extracurricular plan",
      "Brainstorm my personal statement",
      "Review an essay draft",
      "Search for scholarships",
      "Understand financial aid",
      "Prepare for a deadline",
      "Compare college offers"
    ]
  },
  {
    id: "essayStage",
    type: "multi-select",
    question: "Where are you in the essay process?",
    helperText: "Choose any that apply.",
    required: true,
    showWhen: {
      anyIncludes: [
        { questionId: "helpAreas", values: ["Essay brainstorming", "Essay editing"] },
        { questionId: "accomplishFirst", values: ["Brainstorm my personal statement", "Review an essay draft"] }
      ]
    },
    options: [
      "I have not started",
      "I have a few ideas",
      "I have an outline",
      "I have a rough draft",
      "I want feedback on a polished draft",
      "I need help choosing an essay topic",
      "I want help making my writing more personal"
    ]
  },
  {
    id: "financialGuidance",
    type: "multi-select",
    question: "What financial guidance would help most?",
    required: true,
    showWhen: {
      anyIncludes: [
        {
          questionId: "helpAreas",
          values: ["Scholarships", "Financial aid"]
        },
        {
          questionId: "accomplishFirst",
          values: ["Search for scholarships", "Understand financial aid"]
        }
      ]
    },
    options: [
      "Finding scholarships",
      "Understanding FAFSA",
      "Comparing net cost",
      "Understanding merit aid",
      "Reviewing aid offers",
      "Building an affordable college list",
      "I am not sure yet"
    ]
  },
  {
    id: "stemGuidance",
    type: "multi-select",
    question: "What type of STEM guidance are you seeking?",
    required: true,
    showWhen: {
      questionId: "academicInterests",
      includesAny: ["Computer science", "Engineering", "Mathematics", "Natural sciences"]
    },
    options: [
      "Choosing STEM programs",
      "Presenting technical projects",
      "Strengthening extracurriculars",
      "Research opportunities",
      "Selective admissions",
      "Career exploration"
    ]
  },
  {
    id: "exploratorySupport",
    type: "multi-select",
    question: "What kind of exploratory support would help?",
    required: true,
    showWhen: {
      anyIncludes: [
        { questionId: "academicInterests", values: ["Undecided or exploring"] },
        { questionId: "processStage", values: ["I am not sure where to begin"] },
        { questionId: "helpAreas", values: ["I am not sure yet"] }
      ]
    },
    options: [
      "Learning about possible majors",
      "Comparing career paths",
      "Identifying schools with flexible programs",
      "Building a broad college list",
      "Creating a starting roadmap",
      "Talking through my interests"
    ]
  },
  {
    id: "schoolSpecificSupport",
    type: "multi-select",
    question: "What kind of school-specific support would help?",
    required: true,
    showWhen: { questionId: "colleges", hasCollegeSelection: true },
    options: [
      "A mentor connected to one of my target schools",
      "Comparing similar colleges",
      "Understanding campus culture",
      "Learning about academic opportunities",
      "Evaluating admissions fit",
      "Comparing affordability"
    ]
  },
  {
    id: "deadlineTiming",
    type: "single-select",
    question: "How soon is your next important deadline?",
    required: true,
    showWhen: {
      anyIncludes: [
        { questionId: "accomplishFirst", values: ["Prepare for a deadline"] },
        { questionId: "processStage", values: ["Preparing for applications", "Writing essays", "Submitting applications"] }
      ]
    },
    options: [
      "Within 2 weeks",
      "Within 1 month",
      "Within 2 to 3 months",
      "More than 3 months away",
      "I am not sure"
    ]
  },
  {
    id: "accountabilityNeeds",
    type: "multi-select",
    question: "What kind of accountability would help?",
    required: true,
    showWhen: {
      anyOf: [
        {
          anyIncludes: [
            { questionId: "helpAreas", values: ["Organization and deadlines", "Accountability and check-ins"] }
          ]
        },
        {
          anyIncludes: [{ questionId: "mentorQualities", values: ["Accountability and check-ins"] }]
        },
        { minNumber: { questionId: "structureScale", value: 4 } }
      ]
    },
    options: [
      "Weekly check-ins",
      "Action items after meetings",
      "Deadline reminders",
      "Progress tracking",
      "Breaking tasks into smaller steps",
      "Encouragement when I fall behind"
    ]
  },
  {
    id: "backgroundPreference",
    type: "open-response",
    question: "Is there an experience or perspective you value in a mentor?",
    helperText: "Optional. Share only what you are comfortable sharing.",
    required: false,
    showWhen: {
      questionId: "mentorQualities",
      includesAny: ["Similar background or experience"]
    },
    placeholder:
      "For example: first-generation experience, transfer experience, balancing school and work, or applying from a small high school."
  },
  {
    id: "parentSupport",
    type: "multi-select",
    question: "What would you like support with?",
    required: true,
    showWhen: { questionId: "grade", equals: "Parent or guardian" },
    options: [
      "Admissions timeline",
      "Building a balanced school list",
      "Financial aid",
      "Helping my student stay organized",
      "Finding a relatable mentor",
      "Comparing offers"
    ]
  }
];
