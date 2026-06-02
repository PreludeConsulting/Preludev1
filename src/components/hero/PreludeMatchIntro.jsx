import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function PreludeMatchIntro({ onStart, reducedMotion }) {
  return (
    <div className="pm-intro">
      <div className="pm-intro__top">
        <PreludePigAvatar variant="intro" animate={!reducedMotion} label="Prelude mascot" />
        <p className="pm-intro__brand">PreludeMatch</p>
      </div>

      <h2 className="pm-intro__title">Find a mentor who fits your goals.</h2>

      <p className="pm-intro__body">
        Answer a few guided questions and get matched with mentors based on your goals, interests, and
        preferred support style.
      </p>

      <button type="button" className="pm-btn pm-btn--primary pm-btn--lg pm-intro__cta" onClick={onStart}>
        Start matching
      </button>

      <p className="pm-intro__footnote">Personalized mentor matching powered by Prelude AI</p>
    </div>
  );
}
