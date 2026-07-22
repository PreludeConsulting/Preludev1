import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedChatHref, sanitizeChatActions } from "../../server/lib/chatLinkSecurity.js";
import { getPreludeLink, buildVerifiedActions } from "../../server/preludeLinks.js";
import { classifyIntent } from "../../server/rag/intent.js";
import { buildPreludeBusinessAnswer, isPreludeBusinessIntent } from "../../server/rag/preludeBusiness.js";
import { createRagChatCompletion } from "../../server/chatHandler.js";

describe("Prelude route registry", () => {
  it("exposes verified routes only", () => {
    assert.equal(getPreludeLink("plans"), "#pricing");
    assert.equal(getPreludeLink("mentorMatch"), "/mentors");
    assert.equal(getPreludeLink("signUp"), "/register");
    assert.equal(getPreludeLink("consultation"), null);
    assert.equal(getPreludeLink("financialAidResources"), null);
  });

  it("builds verified actions with href", () => {
    const actions = buildVerifiedActions(["explore_plans", "find_mentor", "consultation"]);
    assert.equal(actions.length, 2);
    assert.ok(actions.every((action) => action.href));
  });
});

describe("Prelude business intents", () => {
  it("classifies website and plan questions", () => {
    assert.equal(classifyIntent("What is Prelude?").intent, "prelude_overview");
    assert.equal(classifyIntent("What is the difference between Basic and Plus?").intent, "plans_comparison");
    assert.equal(classifyIntent("Can I message a mentor?").intent, "mentor_support");
    assert.equal(classifyIntent("Do you help with FAFSA?").intent, "financial_support");
    assert.equal(classifyIntent("Where do I sign up?").intent, "sign_up");
    assert.equal(classifyIntent("Where is my dashboard?").intent, "dashboard_help");
    assert.ok(isPreludeBusinessIntent("plan_recommendation"));
  });

  it("does not classify UCLA comparison as business", () => {
    const { intent } = classifyIntent("which is better for cs UCLA or GT");
    assert.equal(intent, "school_comparison");
    assert.equal(isPreludeBusinessIntent(intent), false);
  });
});

describe("Prelude business answers", () => {
  it("answers What is Prelude with features and links", () => {
    const answer = buildPreludeBusinessAnswer({ intent: "prelude_overview", message: "What is Prelude?" });
    assert.match(answer.text, /peer-powered|mentor/i);
    assert.match(answer.text, /\[Explore Plans\]\(#pricing\)/);
    assert.ok(answer.actions.some((action) => action.href === "#pricing"));
    assert.match(answer.text, /\?/);
  });

  it("compares Basic and Plus without prices", () => {
    const answer = buildPreludeBusinessAnswer({
      intent: "plans_comparison",
      message: "What is the difference between Basic and Plus?"
    });
    assert.match(answer.text, /Basic/i);
    assert.match(answer.text, /Plus/i);
    assert.doesNotMatch(answer.text, /\$\d+/);
    assert.match(answer.text, /#pricing/);
  });

  it("explains mentor messaging by plan", () => {
    const answer = buildPreludeBusinessAnswer({
      intent: "mentor_support",
      message: "Can I message a mentor?"
    });
    assert.match(answer.text, /messaging/i);
    assert.match(answer.text, /Basic|Plus|Pro/);
    assert.ok(answer.actions.some((action) => action.href === "/mentors"));
  });

  it("answers FAFSA with trusted external link", () => {
    const answer = buildPreludeBusinessAnswer({
      intent: "financial_support",
      message: "Do you help with FAFSA?"
    });
    assert.match(answer.text, /FAFSA/i);
    assert.match(answer.text, /studentaid\.gov/);
  });

  it("provides verified sign-up route", () => {
    const answer = buildPreludeBusinessAnswer({ intent: "sign_up", message: "Where do I sign up?" });
    assert.match(answer.text, /\/register/);
    assert.ok(answer.actions.some((action) => action.href === "/register"));
  });

  it("provides dashboard guidance without dead routes", () => {
    const answer = buildPreludeBusinessAnswer({
      intent: "dashboard_help",
      message: "Where is my dashboard?"
    });
    assert.match(answer.text, /dashboard/i);
    assert.match(answer.text, /\/dashboard/);
    assert.doesNotMatch(answer.text, /#dashboard/);
    assert.doesNotMatch(answer.text, /\/book/);
  });

  it("recommends plans for essay feedback", () => {
    const answer = buildPreludeBusinessAnswer({
      intent: "plan_recommendation",
      message: "Which plan is best for essay feedback?"
    });
    assert.match(answer.text, /Plus/i);
    assert.match(answer.text, /essay/i);
    assert.doesNotMatch(answer.text, /guarantee/i);
  });
});

describe("chat integration", () => {
  it("returns business model for Prelude overview via API", async () => {
    const result = await createRagChatCompletion({
      message: "What is Prelude?",
      conversationHistory: []
    });
    assert.equal(result.model, "business");
    assert.match(result.answer, /mentor|peer/i);
    assert.ok(result.actions?.length);
  });

  it("still compares UCLA and GT for admissions questions", async () => {
    const result = await createRagChatCompletion({
      message: "which is better for cs UCLA or GT",
      conversationHistory: []
    });
    assert.notEqual(result.model, "business");
    assert.match(result.answer, /California-Los Angeles|UCLA/i);
    assert.doesNotMatch(result.answer, /University of Georgia · Athens/i);
  });
});

describe("hyperlink security", () => {
  it("allows internal and trusted external links", () => {
    assert.equal(isAllowedChatHref("#pricing"), true);
    assert.equal(isAllowedChatHref("/register"), true);
    assert.equal(isAllowedChatHref("https://studentaid.gov/"), true);
  });

  it("blocks javascript and unknown external links", () => {
    assert.equal(isAllowedChatHref("javascript:alert(1)"), false);
    assert.equal(isAllowedChatHref("https://evil.example/phish"), false);
    assert.equal(
      sanitizeChatActions([{ label: "Bad", href: "javascript:alert(1)", type: "internal" }]).length,
      0
    );
  });
});
