const mediaBase = import.meta.env.BASE_URL;

export const MENTORS = [
  {
    id: "m1",
    name: "Jordan M.",
    school: "MIT",
    major: "Computer Science",
    focus: "STEM apps & essays",
    image: `${mediaBase}media/mentor-lounge.png`,
    href: "#preludematch"
  },
  {
    id: "m2",
    name: "Priya K.",
    school: "Johns Hopkins",
    major: "Pre-Med / Public Health",
    focus: "Activities & supplements",
    image: `${mediaBase}media/roadmap-dashboard.png`,
    href: "#preludematch"
  },
  {
    id: "m3",
    name: "Marcus L.",
    school: "UCLA",
    major: "Business Economics",
    focus: "College list & fit",
    image: `${mediaBase}media/impact-desk.png`,
    href: "#preludematch"
  },
  {
    id: "m4",
    name: "Sofia R.",
    school: "NYU",
    major: "Film & Media",
    focus: "Personal statement",
    image: `${mediaBase}media/mentor-lounge-loop.gif`,
    href: "#preludematch"
  },
  {
    id: "m5",
    name: "Elena V.",
    school: "Georgia Tech",
    major: "Mechanical Engineering",
    focus: "First-gen support",
    image: `${mediaBase}media/roadmap-dashboard-loop.gif`,
    href: "#preludematch"
  },
  {
    id: "m6",
    name: "Daniel T.",
    school: "UT Austin",
    major: "Finance",
    focus: "Scholarships & aid",
    image: `${mediaBase}media/impact-desk-loop.gif`,
    href: "#preludematch"
  }
];

export const SERVICES = [
  {
    id: "s1",
    title: "PreludeMatch",
    subtitle: "Mentor matching",
    description: "Pair with students at your target schools.",
    href: "#preludematch",
    icon: "users"
  },
  {
    id: "s2",
    title: "College list support",
    subtitle: "List building",
    description: "Balance safety, target, and reach with a mentor.",
    href: "#mentorship",
    icon: "compass"
  },
  {
    id: "s3",
    title: "Essay studio",
    subtitle: "Applications",
    description: "Brainstorm, structure, and refine your story.",
    href: "#how-it-works",
    icon: "book"
  },
  {
    id: "s4",
    title: "Financial guidance",
    subtitle: "Aid & scholarships",
    description: "FAFSA, scholarships, and true cost planning.",
    href: "#pricing",
    icon: "dollar"
  },
  {
    id: "s5",
    title: "Application roadmap",
    subtitle: "Timelines",
    description: "Deadlines, EA/ED/RD, and milestone tracking.",
    href: "#clarity",
    icon: "calendar"
  }
];

/** Fallback menu labels if AGENT.md cannot be parsed. */
export const QUICK_MENU = [
  { id: "start", label: "I don't know where to start" },
  { id: "colleges", label: "I need help choosing colleges" },
  { id: "essays", label: "I need help with essays" },
  { id: "aid", label: "I need scholarships or financial aid help" },
  { id: "major", label: "I need help choosing a major" },
  { id: "parent", label: "I'm a parent trying to help my student" }
];
