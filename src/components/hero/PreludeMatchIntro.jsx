import { useLanguage } from "../../context/LanguageContext.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function PreludeMatchIntro({ onStart, reducedMotion }) {
  const { t } = useLanguage();
  return (
    <div className="pm-intro">
      <div className="pm-intro__top">
        <PreludePigAvatar variant="intro" animate={!reducedMotion} label="Prelude mascot" />
        <p className="pm-intro__brand">{t("match.intro.eyebrow")}</p>
      </div>

      <h2 className="pm-intro__title">{t("match.intro.title")}</h2>

      <p className="pm-intro__body">{t("match.intro.body")}</p>

      <button type="button" className="pm-btn pm-btn--primary pm-btn--lg pm-intro__cta" onClick={onStart}>
        {t("match.intro.cta")}
      </button>

      <p className="pm-intro__footnote">{t("match.intro.footnote")}</p>
    </div>
  );
}
