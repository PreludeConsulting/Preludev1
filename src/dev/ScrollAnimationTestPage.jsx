import { useRef } from "react";
import {
  useScrollEnterReveal,
  useScrollScrubbedAnimation,
  useScrollStaggerReveal
} from "../lib/useAnimeScrollAnimation.js";
import "./scroll-test.css";

const STAGGER_ROWS = [
  "Discovery call scheduled",
  "Mentor matched",
  "Essay draft reviewed",
  "College list finalized",
  "Application submitted"
];

function TriggerBlock() {
  const cardRef = useRef(null);
  useScrollEnterReveal(cardRef);

  return (
    <section className="scroll-test__section">
      <div className="scroll-test__label">Block B — trigger on enter</div>
      <div ref={cardRef} className="scroll-test__card">
        <h3>Fades and slides in once</h3>
        <p>Plays a single time when it enters the viewport. It does not replay on every scroll tick.</p>
      </div>
    </section>
  );
}

function ScrubBlock() {
  const sectionRef = useRef(null);
  const boxRef = useRef(null);
  useScrollScrubbedAnimation(boxRef, sectionRef);

  return (
    <section ref={sectionRef} className="scroll-test__section scroll-test__section--tall">
      <div className="scroll-test__label">Block C — scroll-linked (scrubbed)</div>
      <div className="scroll-test__scrub-stage">
        <div ref={boxRef} className="scroll-test__scrub-box">
          Scrub
        </div>
      </div>
      <p className="scroll-test__hint">
        Progress tracks scroll position. Scroll up to reverse it.
      </p>
    </section>
  );
}

function StaggerBlock() {
  const listRef = useRef(null);
  const rowRefs = useRef([]);
  useScrollStaggerReveal(listRef, rowRefs);

  return (
    <section className="scroll-test__section">
      <div className="scroll-test__label">Block D — staggered children</div>
      <ul ref={listRef} className="scroll-test__list">
        {STAGGER_ROWS.map((row, index) => (
          <li
            key={row}
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
            className="scroll-test__row"
          >
            {row}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ScrollAnimationTestPage() {
  return (
    <div className="scroll-test">
      <header className="scroll-test__header">
        <h1>Scroll Animation Test Lab</h1>
        <p>
          Dev-only page for validating anime.js v4 scroll patterns. Toggle
          <code> prefers-reduced-motion </code>
          in DevTools (Rendering tab) to verify the reduced-motion fallback.
        </p>
      </header>

      <section className="scroll-test__section scroll-test__section--intro">
        <div className="scroll-test__label">Block A — intro</div>
        <p className="scroll-test__scroll-cue">Scroll down</p>
      </section>

      <TriggerBlock />
      <ScrubBlock />
      <StaggerBlock />

      <footer className="scroll-test__footer">End of test lab</footer>
    </div>
  );
}
