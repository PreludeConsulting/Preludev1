import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildVerifiedActions,
  joinMarkdownLinks,
  preludeMarkdownLink
} from "../preludeLinks.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const businessKnowledgePath = path.join(
  repoRoot,
  "prelude_dataset_kit/knowledge/PRELUDE_BUSINESS_KNOWLEDGE.md"
);

export const PRELUDE_BUSINESS_INTENTS = new Set([
  "prelude_overview",
  "plans_comparison",
  "plan_recommendation",
  "mentor_support",
  "mentor_matching",
  "website_navigation",
  "financial_support",
  "platform_features",
  "consultation",
  "sign_up",
  "sign_in",
  "dashboard_help"
]);

export function isPreludeBusinessIntent(intent) {
  return PRELUDE_BUSINESS_INTENTS.has(intent);
}

export function loadPreludeBusinessKnowledge() {
  try {
    return fs.readFileSync(businessKnowledgePath, "utf8").trim();
  } catch {
    return "";
  }
}

function linkLine(actionIds) {
  const parts = actionIds.map((id) => {
    const action = buildVerifiedActions([id])[0];
    return action ? preludeMarkdownLink(action.label, id) : null;
  });
  return joinMarkdownLinks(parts);
}

export function buildPreludeBusinessAnswer({ intent, message = "", profile = null }) {
  const planName = profile?.planName ?? profile?.plan ?? null;
  const planNote = planName ? ` You are on the **${planName}** plan.` : "";

  switch (intent) {
    case "prelude_overview":
      return {
        text: [
          "Prelude is a **peer-powered college-guidance platform**. It connects high school students with **current college mentors** and combines that support with planning tools, financial-aid guidance, and application roadmaps.",
          "",
          "You can use Prelude to:",
          "- organize your application process",
          "- connect with a mentor through PreludeMatch",
          "- get essay and college-list guidance",
          "- track milestones on your roadmap",
          "- explore financial-aid and scholarship support",
          "",
          linkLine(["explore_plans", "find_mentor"]),
          "",
          "What kind of support are you looking for right now — mentorship, essays, college lists, or financial aid?"
        ].join("\n"),
        actions: buildVerifiedActions(["explore_plans", "find_mentor"])
      };

    case "plans_comparison": {
      const comparesPro =
        /\bpro\b/i.test(message) && /\b(basic|plus|essay)\b/i.test(message);
      const mentionsEssay =
        /\bessay\b|\bapplication\s*&?\s*essay\b|\bwritten\s+feedback\b|\breview\s+credit/i.test(message);
      const mentionsBasic = /\bbasic\b/i.test(message);

      if (comparesPro && /\bplus\b/i.test(message)) {
        return {
          text: [
            "## Plus vs. Pro",
            "",
            "**Plus** is a strong fit when you want **ongoing monthly mentorship** with **2 live flexible 1-on-1 sessions** per month and full mentor-network messaging.",
            "",
            "**Pro** adds higher-touch live support: **4 live flexible sessions** per month, priority messaging, comprehensive application strategy, live essay and activities guidance, and final readiness planning.",
            "",
            "### Main difference",
            "Both are **live monthly mentorship** plans — neither includes monthly async written essay-review credits. Pro is for students who want **more frequent, personalized live mentor guidance**.",
            "",
            linkLine(["compare_plans"]),
            "",
            "How often would you want to meet with a mentor?"
          ].join("\n"),
          actions: buildVerifiedActions(["compare_plans"])
        };
      }

      if (mentionsEssay || (!mentionsBasic && !/\bplus\b/i.test(message) && !/\bpro\b/i.test(message))) {
        return {
          text: [
            "## Essay Support vs. monthly live plans",
            "",
            "**Application & Essay Support** is a **one-time** purchase of review credits (3, 6, or 10) for **async written feedback** on personal statements and college supplemental essays.",
            "",
            "**Plus** and **Pro** are **monthly subscriptions** focused on **live flexible sessions** — Plus includes 2 per month; Pro includes 4 — plus mentor messaging and strategy. They do **not** include monthly async written essay-review credits.",
            "",
            "### Main difference",
            "Choose Essay Support for **written-only feedback**. Choose Plus or Pro for **ongoing live mentorship**.",
            "",
            linkLine(["compare_plans"]),
            "",
            "Do you want async written reviews, live sessions, or both?"
          ].join("\n"),
          actions: buildVerifiedActions(["compare_plans"])
        };
      }

      if (mentionsBasic) {
        return {
          text: [
            "## Plans overview",
            "",
            "**Basic** is a **legacy plan** for existing subscribers only — it is **not available for new purchases**.",
            "",
            "New students can choose:",
            "- **Application & Essay Support** — one-time async written review credits",
            "- **Plus** — monthly live mentorship with 2 flexible sessions",
            "- **Pro** — monthly live mentorship with 4 flexible sessions and higher-touch strategy",
            "",
            linkLine(["compare_plans"]),
            "",
            "Are you looking for written essay feedback or ongoing live sessions?"
          ].join("\n"),
          actions: buildVerifiedActions(["compare_plans"])
        };
      }

      return {
        text: [
          "## Plus vs. Pro",
          "",
          "**Plus** is a strong fit when you want **ongoing monthly mentorship** with **2 live flexible 1-on-1 sessions** per month and full mentor-network messaging.",
          "",
          "**Pro** adds higher-touch live support: **4 live flexible sessions** per month, priority messaging, comprehensive application strategy, live essay guidance, and final readiness planning.",
          "",
          "Neither Plus nor Pro includes monthly async written essay-review credits — those come from **Application & Essay Support** (one-time).",
          "",
          linkLine(["compare_plans"]),
          "",
          "How often would you want to meet with a mentor?"
        ].join("\n"),
        actions: buildVerifiedActions(["compare_plans"])
      };
    }

    case "plan_recommendation": {
      const wantsEssay = /\bessay|writing|personal statement|supplement/i.test(message);
      const wantsFrequent = /\bweekly|often|a lot|hands-on|high.?touch/i.test(message);

      if (wantsEssay && !wantsFrequent) {
        return {
          text: [
            "For **async written application feedback**, choose **Application & Essay Support** — a **one-time** purchase of review credits (3, 6, or 10) for detailed written feedback on personal statements and college supplemental essays.",
            "",
            "**Plus** and **Pro** are monthly **live flexible session** plans (2 and 4 sessions per month). They do **not** include monthly written essay-review credits; use sessions for live essay guidance instead, or add Essay Support separately.",
            "",
            linkLine(["compare_plans"]),
            "",
            "Do you want async written reviews, live sessions, or both?"
          ].join("\n"),
          actions: buildVerifiedActions(["compare_plans"])
        };
      }

      return {
        text: [
          "**Application & Essay Support** fits if you mainly want **one-time async written essay reviews** (no monthly subscription).",
          "",
          "**Plus** is a stronger fit if you want **ongoing live mentorship** with **2 flexible 1-on-1 sessions** per month.",
          "",
          "**Pro** makes more sense when you want a **high-touch live experience** with **4 sessions** per month, priority messaging, and deeper live application strategy.",
          "",
          "**Basic** is legacy-only and not sold to new customers.",
          "",
          "Prelude AI is the **same assistant on every plan** — products differ in live sessions and human support, not AI quality.",
          "",
          linkLine(["compare_plans"]),
          "",
          "How often do you think you would want to meet with a mentor?"
        ].join("\n"),
        actions: buildVerifiedActions(["compare_plans"])
      };
    }

    case "mentor_support":
      return {
        text: [
          "Yes. Depending on what you purchase, you can access **mentor messaging** and live sessions.",
          "",
          "- **Application & Essay Support** is one-time **async written** feedback only (no live session credits).",
          "- **Plus** includes full mentor-network messaging and **2 live flexible 1-on-1 sessions** per month (no monthly async essay-review credits).",
          "- **Pro** includes everything in Plus with **4 live flexible sessions**, priority messaging, and higher-touch live application strategy.",
          "- **Basic** is legacy-only for existing subscribers and is not available for new purchases.",
          "",
          linkLine(["find_mentor", "explore_plans"]),
          "",
          "Are you already matched with a mentor, or still exploring schools and majors?"
        ].join("\n"),
        actions: buildVerifiedActions(["find_mentor", "explore_plans"])
      };

    case "mentor_matching":
      return {
        text: [
          "**PreludeMatch** helps you connect with mentors based on target schools, intended major, activities, and application goals.",
          "",
          "Start the matching flow on the site to share your interests and background. Prelude does not guarantee a specific mentor until matching is complete.",
          "",
          linkLine(["find_mentor", "how_it_works"]),
          "",
          "Do you already have target schools in mind?"
        ].join("\n"),
        actions: buildVerifiedActions(["find_mentor", "how_it_works"])
      };

    case "financial_support":
      return {
        text: [
          "Yes. Prelude can help with **financial-aid planning** at a general level, including FAFSA and CSS Profile basics, scholarship organization, and cost comparisons.",
          "",
          "Plan features also include financial-aid resources; deeper affordability strategy is strongest with mentor support on **Plus** or **Pro**.",
          "",
          "For official requirements and deadlines, confirm details on [Federal Student Aid](https://studentaid.gov/).",
          "",
          linkLine(["explore_plans", "find_mentor"]),
          "",
          "Are you mainly trying to understand FAFSA timing, scholarships, or comparing college costs?"
        ].join("\n"),
        actions: buildVerifiedActions(["explore_plans", "find_mentor"])
      };

    case "platform_features":
      return {
        text: [
          "Prelude’s platform is built to keep applications organized — with a central dashboard, deadline tracking, essay-prompt organization, roadmap tasks, and progress tracking.",
          "",
          "Some capabilities are still rolling out on the website. If a specific tool is not visible in your account yet, it may be part of Prelude’s planned platform experience.",
          "",
          linkLine(["open_dashboard", "explore_plans"]),
          "",
          "Which would help you most right now — deadlines, essays, or mentor sessions?"
        ].join("\n"),
        actions: buildVerifiedActions(["open_dashboard", "explore_plans"])
      };

    case "consultation":
      return {
        text: [
          "Prelude does not list a separate consultation booking page on the current website.",
          "",
          "The closest next steps are to **explore plans**, start **PreludeMatch**, or use **Get Started** in the footer to reach the team.",
          "",
          linkLine(["explore_plans", "find_mentor", "contact"]),
          "",
          "Would you like help choosing a plan or finding a mentor first?"
        ].join("\n"),
        actions: buildVerifiedActions(["explore_plans", "find_mentor", "contact"])
      };

    case "sign_up":
      return {
        text: [
          "You can create a free account to get started with Prelude.",
          "",
          linkLine(["sign_up"]),
          "",
          "After you sign up, you can open your dashboard and explore PreludeMatch."
        ].join("\n"),
        actions: buildVerifiedActions(["sign_up"])
      };

    case "sign_in":
      return {
        text: [
          "Sign in to access your plan, dashboard tools, and mentor benefits.",
          "",
          linkLine(["sign_in"]),
          "",
          "Need to create an account instead? Use the sign-up option on the same screen."
        ].join("\n"),
        actions: buildVerifiedActions(["sign_in"])
      };

    case "dashboard_help":
      return {
        text: [
          `Your dashboard is where you can track progress and access Prelude tools.${planNote}`,
          "",
          "If you are signed in, open the in-app dashboard. If not, sign in first — the dashboard unlocks after authentication.",
          "",
          linkLine(["open_dashboard", "sign_in"]),
          "",
          "Are you trying to view your roadmap, messages, or plan details?"
        ].join("\n"),
        actions: buildVerifiedActions(["open_dashboard", "sign_in"])
      };

    case "website_navigation": {
      const lower = message.toLowerCase();
      if (/\bpric|plan|subscription\b/.test(lower)) {
        return buildPreludeBusinessAnswer({ intent: "plans_comparison", message, profile });
      }
      if (/\bmentor|match\b/.test(lower)) {
        return buildPreludeBusinessAnswer({ intent: "mentor_matching", message, profile });
      }
      return {
        text: [
          "Here are the main places on the Prelude site:",
          "",
          `- **Plans:** ${preludeMarkdownLink("Explore Plans", "explore_plans")}`,
          `- **Mentor matching:** ${preludeMarkdownLink("PreludeMatch", "find_mentor")}`,
          `- **How it works:** ${preludeMarkdownLink("How It Works", "how_it_works")}`,
          `- **Dashboard:** ${preludeMarkdownLink("Open Dashboard", "open_dashboard")} (sign in if needed)`,
          "",
          "What are you trying to do on the site?"
        ].join("\n"),
        actions: buildVerifiedActions(["explore_plans", "find_mentor", "how_it_works"])
      };
    }

    default:
      return null;
  }
}
