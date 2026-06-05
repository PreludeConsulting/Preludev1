import { useLanguage } from "../../context/LanguageContext.jsx";

const MENTOR_NODES = [
  { initials: "MP", name: "Maya", school: "Georgia Tech", major: "CS", x: 72, y: 28 },
  { initials: "SK", name: "Sam", school: "Stanford", majorKey: "business", x: 88, y: 52 },
  { initials: "AL", name: "Ava", school: "MIT", majorKey: "engineering", x: 68, y: 76 },
  { initials: "RN", name: "Riley", school: "UCLA", majorKey: "biology", x: 28, y: 72 },
  { initials: "TC", name: "Taylor", school: "UPenn", major: "CS", x: 12, y: 48 }
];

const UNIVERSITY_TAGS = ["Stanford", "Georgia Tech", "MIT", "UCLA"];
const MAJOR_TAGS = [
  { label: "CS" },
  { key: "business" },
  { key: "biology" },
  { key: "engineering" }
];

export default function NetworkGraphic() {
  const { t } = useLanguage();
  const majorLabel = (major) => major.label ?? t(`studentNetwork.graphic.majors.${major.key}`);

  return (
    <div className="sn-network-graphic" aria-hidden="true">
      <p className="sn-network-graphic__label">{t("studentNetwork.graphic.label")}</p>

      <div className="sn-network-graphic__canvas">
        <svg className="sn-network-graphic__lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sn-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(267 86% 48% / 0.45)" />
              <stop offset="100%" stopColor="hsl(267 86% 48% / 0.12)" />
            </linearGradient>
          </defs>
          {MENTOR_NODES.map((node) => (
            <line
              key={node.initials}
              x1="50"
              y1="50"
              x2={node.x}
              y2={node.y}
              stroke="url(#sn-line-grad)"
              strokeWidth="0.6"
              strokeDasharray="2 2"
            />
          ))}
          <circle cx="50" cy="50" r="3.5" fill="hsl(267 86% 48% / 0.2)" />
        </svg>

        <div className="sn-network-graphic__hub">
          <span className="sn-network-graphic__hub-avatar">JL</span>
          <span className="sn-network-graphic__hub-name">{t("studentNetwork.graphic.you")}</span>
          <span className="sn-network-graphic__hub-meta">{t("studentNetwork.graphic.student")}</span>
        </div>

        {MENTOR_NODES.map((node) => (
          <div
            key={node.initials}
            className="sn-network-graphic__node"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className="sn-network-graphic__node-avatar">{node.initials}</span>
            <div className="sn-network-graphic__node-card">
              <strong>{node.name}</strong>
              <span>{node.school}</span>
              <span className="sn-network-graphic__node-major">
                {node.major ?? t(`studentNetwork.graphic.majors.${node.majorKey}`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="sn-network-graphic__tags">
        <div className="sn-network-graphic__tag-group">
          {UNIVERSITY_TAGS.map((tag) => (
            <span className="sn-network-graphic__tag sn-network-graphic__tag--school" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="sn-network-graphic__tag-group">
          {MAJOR_TAGS.map((tag) => (
            <span className="sn-network-graphic__tag sn-network-graphic__tag--major" key={tag.label ?? tag.key}>
              {majorLabel(tag)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
