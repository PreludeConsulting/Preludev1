import { useLanguage } from "../context/LanguageContext.jsx";
import { UNIVERSITIES } from "../data/universities.js";
import UniversityLogo from "./UniversityLogo.jsx";

function MarqueeLogo({ school }) {
  return <UniversityLogo school={school} className="university-marquee__logo" />;
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
    <section className="university-marquee" aria-labelledby="university-marquee-heading">
      <div className="university-marquee__header">
        <h2 id="university-marquee-heading" className="university-marquee__heading">
          {t("carousel.heading")}
        </h2>
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
