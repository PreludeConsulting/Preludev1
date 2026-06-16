/** Footer link columns — headings with vertically listed links. */
export const FOOTER_LINK_COLUMNS = [
  {
    headingKey: "sections.footer.discover",
    ariaLabelKey: "sections.footer.discoverLabel",
    links: [
      { labelKey: "sections.footer.links.how", href: "#mentorship" },
      { labelKey: "sections.footer.links.mentorship", href: "#mentorship" },
      { labelKey: "nav.links.mentors", href: "/mentors" },
      { labelKey: "sections.footer.links.pricing", href: "#pricing" }
    ]
  },
  {
    headingKey: "sections.footer.about",
    ariaLabelKey: "sections.footer.aboutLabel",
    links: [
      { labelKey: "nav.links.about", href: "#home" },
      { labelKey: "nav.links.mentoringClarity", href: "#mentorship" }
    ]
  },
  {
    headingKey: "sections.footer.admissions",
    ariaLabelKey: "sections.footer.admissionsLabel",
    links: [
      { labelKey: "nav.links.admissions", href: "#admissions-counseling" },
      { labelKey: "nav.links.dashboard", href: "/dashboard" }
    ]
  }
];
