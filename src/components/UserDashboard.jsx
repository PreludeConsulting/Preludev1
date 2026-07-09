import { ArrowUpRight, MessageCircle, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { consumeSearchScrollTarget } from "../lib/siteSearch.js";
import { getPlan } from "../lib/plans.js";
import { PRELUDE_AI_NAME } from "../lib/preludeAi.js";
import { getNodeById } from "../lib/roadmapData.js";
import { Button } from "./ui/button.jsx";
import RoadmapPath from "./RoadmapPath.jsx";

export default function UserDashboard() {
  const { user, planDetails, openSignIn, requestPersonalizedAi } = useAuth();

  useEffect(() => {
    const target = consumeSearchScrollTarget();
    if (!target) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!user) {
    return (
      <section className="section-shell min-h-[70vh] pt-28">
        <div className="paper-card mx-auto max-w-lg rounded-[2rem] p-10 text-center">
          <h1 className="section-heading text-4xl">Your Prelude dashboard</h1>
          <p className="body-copy mt-4">Sign in to see your personalized roadmap and saved progress from Prelude AI.</p>
          <button type="button" className="prelude-btn-primary mt-6" onClick={openSignIn}>
            Sign in
          </button>
        </div>
      </section>
    );
  }

  const plan = planDetails ?? getPlan(user.plan);
  const currentNode = getNodeById(user.roadmap?.currentNodeId);
  const completed = user.roadmap?.completedNodes?.length ?? 0;

  return (
    <section className="section-shell min-h-screen pt-24 pb-16" id="dashboard">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="section-badge mb-4">Welcome back, {user.name.split(" ")[0]}</span>
          <h1 className="section-heading max-w-2xl">Your application roadmap</h1>
          <p className="body-copy mt-4 max-w-xl">
            Prelude AI updates this path as you chat — your focus, deadlines, and next steps stay saved here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="button" type="button" variant="secondary" onClick={requestPersonalizedAi}>
            <MessageCircle className="h-4 w-4" />
            Open {PRELUDE_AI_NAME}
          </Button>
          <Button href="/mentors">
            PreludeMatch
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="paper-card rounded-[2rem] p-4 md:p-8">
          <RoadmapPath
            progress={user.roadmap}
            sectionBanner="Progress syncs when you talk with Prelude AI"
          />
        </div>

        <aside className="grid gap-4 self-start">
          <div className="paper-card rounded-2xl p-5">
            <p className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</p>
            <p className="subheading mt-1 text-3xl">{plan.name}</p>
            <p className="mt-2 font-body text-sm text-muted-foreground">{plan.mentorSessions}</p>
          </div>

          <div className="paper-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="font-body text-sm font-medium">From Prelude AI</p>
            </div>
            <ul className="grid gap-2 font-body text-sm text-muted-foreground">
              {user.grade ? (
                <li>
                  <span className="text-foreground">Grade:</span> {user.grade}
                </li>
              ) : null}
              {user.focus ? (
                <li>
                  <span className="text-foreground">Focus:</span> {user.focus}
                </li>
              ) : null}
              {currentNode ? (
                <li>
                  <span className="text-foreground">Up next:</span> {currentNode.title}
                </li>
              ) : null}
              <li>
                <span className="text-foreground">Steps completed:</span> {completed}
              </li>
              {user.roadmap?.insights?.concerns?.length ? (
                <li>
                  <span className="text-foreground">Topics discussed:</span>{" "}
                  {user.roadmap.insights.concerns.slice(-3).join(", ")}
                </li>
              ) : null}
            </ul>
          </div>

          <div className="paper-card rounded-2xl p-5">
            <p className="font-body text-xs text-muted-foreground">
              Chat about essays, lists, or aid — your roadmap and profile update automatically.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
