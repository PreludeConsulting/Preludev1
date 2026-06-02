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
  return (
    <section className="university-marquee" aria-labelledby="university-marquee-heading">
      <div className="university-marquee__header">
        <h2 id="university-marquee-heading" className="university-marquee__heading">
          Mentorship from students at top universities
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
