export const PUBLIC_APP_ROUTES = Object.freeze({
  home: "/",
  plans: "/plans",
  mentors: "/mentors",
  contact: "/contact",
  signUp: "/register",
  signIn: "/login",
  forgotPassword: "/forgot-password",
  dashboard: "/dashboard",
  profile: "/profile",
  settings: "/settings"
});

export const LANDING_SECTION_TARGETS = Object.freeze({
  plans: "#pricing",
  mentorship: "#mentorship",
  roadmap: "#roadmap",
  howItWorks: "#how-it-works",
  contact: "#contact"
});

export const DASHBOARD_ROUTE_BASES = Object.freeze({
  student: "/dashboard/student",
  mentor: "/dashboard/mentor",
  parent: "/dashboard/parent",
  admin: "/dashboard/admin"
});

export const APP_ACTION_MAP = Object.freeze({
  go_home: Object.freeze({ kind: "top", target: PUBLIC_APP_ROUTES.home }),
  explore_plans: Object.freeze({ kind: "section", target: LANDING_SECTION_TARGETS.plans }),
  compare_plans: Object.freeze({ kind: "section", target: LANDING_SECTION_TARGETS.plans }),
  find_mentor: Object.freeze({ kind: "route", target: PUBLIC_APP_ROUTES.mentors }),
  mentor_matching: Object.freeze({ kind: "route", target: PUBLIC_APP_ROUTES.mentors }),
  sign_up: Object.freeze({ kind: "route", target: PUBLIC_APP_ROUTES.signUp }),
  sign_in: Object.freeze({ kind: "route", target: PUBLIC_APP_ROUTES.signIn }),
  open_dashboard: Object.freeze({ kind: "route", target: PUBLIC_APP_ROUTES.dashboard }),
  contact: Object.freeze({ kind: "section", target: LANDING_SECTION_TARGETS.contact }),
  how_it_works: Object.freeze({ kind: "section", target: LANDING_SECTION_TARGETS.howItWorks })
});
