import {
  BookOpen,
  CalendarCheck,
  Check,
  Compass,
  DollarSign,
  Map,
  Sparkles,
  Star,
  User,
  Users
} from "lucide-react";
import { ROADMAP_SECTIONS } from "../lib/roadmapData.js";
import { cn } from "../lib/utils.js";

const ICONS = {
  user: User,
  sparkles: Sparkles,
  map: Map,
  book: BookOpen,
  dollar: DollarSign,
  calendar: CalendarCheck,
  compass: Compass,
  users: Users,
  check: Check
};

const OFFSETS = ["offset-left", "offset-center", "offset-right"];

function ChestNode({ state }) {
  return (
    <div
      className={cn(
        "roadmap-chest",
        state === "completed" && "roadmap-chest--done",
        state === "current" && "roadmap-chest--current"
      )}
      aria-hidden="true"
    >
      <div className="roadmap-chest__lid" />
      <div className="roadmap-chest__body" />
    </div>
  );
}

function PathNode({ node, state, index }) {
  const Icon = ICONS[node.icon] ?? Sparkles;
  const offset = OFFSETS[index % 3];

  if (node.type === "chest") {
    return (
      <li className={cn("roadmap-node-wrap", offset)} key={node.id}>
        <div className="roadmap-node roadmap-node--chest" data-state={state}>
          <ChestNode state={state} />
        </div>
      </li>
    );
  }

  return (
    <li className={cn("roadmap-node-wrap", offset)} key={node.id}>
      <button
        type="button"
        className={cn("roadmap-node", state === "current" && "roadmap-node--current")}
        data-state={state}
        aria-label={`${node.title} — ${state}`}
        disabled={state === "locked"}
      >
        <span className="roadmap-node__face">
          {state === "completed" ? (
            <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Icon className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <span className="roadmap-node__rim" aria-hidden="true" />
      </button>
      {state === "current" ? (
        <div className="roadmap-stars" aria-hidden="true">
          <Star className="roadmap-star roadmap-star--on" />
          <Star className="roadmap-star" />
          <Star className="roadmap-star" />
        </div>
      ) : null}
      <p className="roadmap-node-label">{node.title}</p>
    </li>
  );
}

function nodeState(nodeId, progress, previewMode) {
  if (previewMode) {
    const order = ROADMAP_SECTIONS.flatMap((s) => s.nodes.map((n) => n.id));
    const idx = order.indexOf(nodeId);
    if (idx <= 2) return "completed";
    if (idx === 3) return "current";
    return "locked";
  }

  if (progress?.completedNodes?.includes(nodeId)) return "completed";
  if (progress?.currentNodeId === nodeId) return "current";
  return "locked";
}

export default function RoadmapPath({ progress, previewMode = false, sectionBanner }) {
  let nodeIndex = 0;

  return (
    <div className="roadmap-path">
      {ROADMAP_SECTIONS.map((section) => (
        <div className="roadmap-section" key={section.id}>
          <div className="roadmap-section-banner">
            <p className="roadmap-section-banner__meta">
              {section.sectionLabel}, {section.unitLabel}
            </p>
            <p className="roadmap-section-banner__title">{section.title}</p>
          </div>
          <ol className="roadmap-track">
            {section.nodes.map((node) => {
              const state = nodeState(node.id, progress, previewMode);
              const el = (
                <PathNode
                  node={node}
                  state={state}
                  index={nodeIndex}
                  key={node.id}
                />
              );
              nodeIndex += 1;
              return el;
            })}
          </ol>
        </div>
      ))}
      {sectionBanner ? (
        <p className="mt-4 text-center font-body text-xs text-muted-foreground">{sectionBanner}</p>
      ) : null}
    </div>
  );
}
