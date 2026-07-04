import { useLanguage } from "../context/LanguageContext.jsx";
import { UNIVERSITIES } from "../data/universities.js";
import UniversityLogo from "./UniversityLogo.jsx";
import ScrollReveal from "./motion/ScrollReveal.jsx";

function MarqueeLogo({ school }) {
  return <UniversityLogo school={school} className="university-marquee__logo" loading="eager" />;
}

function UniversityGroup({ ariaHidden = false }) {
  return (
    <div className="university-marquee__group" aria-hidden={ariaHidden || undefined}>
      {UNIVERSITIES.map((school) => (
        <MarqueeLogo school={school} key={`${ariaHidden ? "dup-" : ""}${school.id}`} />
      ))}
    </div>
  );
}

export default function UniversityCarousel() {
  const { t } = useLanguage();

  return (
    <section id="partners" data-section-nav="partners" className="university-marquee" aria-labelledby="university-marquee-heading">
      <div className="university-marquee__header">
        <ScrollReveal as="h2" className="university-marquee__heading" id="university-marquee-heading">
          {t("carousel.heading")}
        </ScrollReveal>
      </div>
      <div className="university-marquee__viewport">
        <div className="university-marquee__track">
          <UniversityGroup />
          <UniversityGroup ariaHidden />
        </div>
      </div>
    </section>
  );
}
