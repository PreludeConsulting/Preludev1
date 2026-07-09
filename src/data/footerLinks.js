/** Footer link columns — headings with vertically listed links. */
export const FOOTER_LINK_COLUMNS = [
  {
    headingKey: "sections.footer.discover",
    ariaLabelKey: "sections.footer.discoverLabel",
    links: [
      { labelKey: "sections.footer.links.how", href: "#mentorship" },
      { labelKey: "nav.links.mentors", href: "/mentors" },
      { labelKey: "sections.footer.links.pricing", href: "#pricing" }
    ]
  },
  {
    headingKey: "sections.footer.resources",
    ariaLabelKey: "sections.footer.resourcesLabel",
    links: [
      { labelKey: "sections.footer.links.parentDashboard", href: "#how-it-works" },
      { labelKey: "sections.footer.links.academicSupport", href: "#academic-support" },
      { labelKey: "sections.footer.links.preludeMatch", href: "/mentors" }
    ]
  },
  {
    headingKey: "sections.footer.support",
    ariaLabelKey: "sections.footer.supportLabel",
    links: [
      { labelKey: "sections.footer.links.contact", href: "/contact" },
      { labelKey: "sections.footer.links.bookCall", href: "/contact" },
      { labelKey: "sections.footer.links.email", href: "/contact#email-us" }
    ]
  }
];
