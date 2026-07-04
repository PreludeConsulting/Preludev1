import { useRef } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSetPieceAnimation } from "../lib/useAnimeScrollAnimation.js";
import { mountStudentNetworkSetPiece } from "../lib/animeScrollSetPieces.js";
import AnimatedChatDemo from "./student-network/AnimatedChatDemo.jsx";
import NetworkGraphic from "./student-network/NetworkGraphic.jsx";

export default function StudentNetworkSection() {
  const { t } = useLanguage();

  const setPieceRefs = useRef({
    section: null,
    headline: null,
    panelEls: []
  });

  useSetPieceAnimation(mountStudentNetworkSetPiece, setPieceRefs);

  return (
    <section
      id="admissions-counseling"
      data-section-nav="admissions-counseling"
      className="student-network-section"
      aria-labelledby="student-network-heading"
      ref={(node) => {
        setPieceRefs.current.section = node;
      }}
    >
      <div className="student-network-section__inner">
        <div className="student-network-section__intro">
          <h2
            id="student-network-heading"
            className="student-network-section__headline"
            ref={(node) => {
              setPieceRefs.current.headline = node;
            }}
          >
            {t("studentNetwork.headline")}
          </h2>
        </div>

        <div className="student-network-section__panels">
          <div
            className="student-network-panel student-network-panel--network"
            ref={(node) => {
              setPieceRefs.current.panelEls[0] = node;
            }}
          >
            <h3 className="student-network-panel__title">{t("studentNetwork.insightTitle")}</h3>
            <p className="student-network-panel__caption">
              {t("studentNetwork.insightDescription")}
            </p>
            <NetworkGraphic />
          </div>

          <div
            className="student-network-panel student-network-panel--chat"
            ref={(node) => {
              setPieceRefs.current.panelEls[1] = node;
            }}
          >
            <h3 className="student-network-panel__title">
              {t("studentNetwork.helpTitle")}
            </h3>
            <AnimatedChatDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
