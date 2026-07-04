import { useRef } from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { useSetPieceAnimation } from "../../lib/useAnimeScrollAnimation.js";
import { mountHeroSetPiece } from "../../lib/animeScrollSetPieces.js";
import TypingPhrase from "./TypingPhrase.jsx";

export function useHeroMotionRefs() {
  return useRef({
    headlineLines: [],
    subcopy: null,
    formWrap: null,
    note: null,
    visual: null,
    section: null
  });
}

export function HeroMotionController({ heroRefs, children }) {
  useSetPieceAnimation(mountHeroSetPiece, heroRefs);
  return children;
}

export function HeroHeadline({ heroRefs }) {
  const reducedMotion = useReducedMotion();
  const { t } = useLanguage();
  const [lineOne, lineTwo] = t("hero.headline");
  const typingPrefix = t("hero.typingPrefix");
  const typingPhrases = t("hero.typingPhrases");
  const staticPhrase = typingPhrases?.[0] || "";

  const setLineRef = (index) => (node) => {
    if (!heroRefs?.current || !node) return;
    heroRefs.current.headlineLines[index] = node;
  };

  if (reducedMotion) {
    return (
      <h1 className="shopify-hero__headline">
        <span className="shopify-hero__headline-line">{lineOne}</span>
        {lineTwo ? <span className="shopify-hero__headline-line">{lineTwo}</span> : null}
        <span className="shopify-hero__typing-line shopify-hero__headline-line">
          {typingPrefix ? <span>{typingPrefix}&nbsp;</span> : null}
          <TypingPhrase phrases={typingPhrases} staticPhrase={staticPhrase} />
        </span>
      </h1>
    );
  }

  return (
    <h1 className="shopify-hero__headline">
      <span ref={setLineRef(0)} className="shopify-hero__headline-line block">
        {lineOne}
      </span>
      {lineTwo ? (
        <span ref={setLineRef(1)} className="shopify-hero__headline-line block">
          {lineTwo}
        </span>
      ) : null}
      <span ref={setLineRef(lineTwo ? 2 : 1)} className="shopify-hero__typing-line block">
        {typingPrefix ? <span>{typingPrefix}&nbsp;</span> : null}
        <TypingPhrase phrases={typingPhrases} staticPhrase={staticPhrase} />
      </span>
    </h1>
  );
}

export function HeroVisualAnimation({ children, heroRefs }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return <div className="shopify-hero__visual">{children}</div>;
  }

  return (
    <div
      ref={(node) => {
        if (heroRefs?.current) heroRefs.current.visual = node;
      }}
      className="shopify-hero__visual"
    >
      {children}
    </div>
  );
}

export function HeroSubcopy({ children, heroRefs }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <p className="shopify-hero__subcopy">{children}</p>;

  return (
    <p
      ref={(node) => {
        if (heroRefs?.current) heroRefs.current.subcopy = node;
      }}
      className="shopify-hero__subcopy"
    >
      {children}
    </p>
  );
}

export function HeroFormAnimation({ children, heroRefs }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return children;

  return (
    <div
      ref={(node) => {
        if (heroRefs?.current) heroRefs.current.formWrap = node;
      }}
      className="shopify-hero__form-wrap"
    >
      {children}
    </div>
  );
}

export function HeroNote({ children, heroRefs }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <p className="shopify-hero__note">{children}</p>;

  return (
    <p
      ref={(node) => {
        if (heroRefs?.current) heroRefs.current.note = node;
      }}
      className="shopify-hero__note"
    >
      {children}
    </p>
  );
}
