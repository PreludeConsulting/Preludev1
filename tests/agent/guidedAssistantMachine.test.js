import { describe, expect, it } from "vitest";
import {
  createGuidedAssistantSnapshot,
  getGuidedAssistantView,
  routeGuidedAssistantText,
  transitionGuidedAssistant
} from "../../src/lib/guidedAssistantMachine.js";

describe("guided assistant finite-state machine", () => {
  it("starts on the main menu", () => {
    const view = getGuidedAssistantView(createGuidedAssistantSnapshot());
    expect(view.id).toBe("main_menu");
    expect(view.message).toBe("Hi, I’m Prelude Guide. What would you like help with today?");
    expect(view.choices.map((choice) => choice.id)).toContain("essays");
    expect(view.choices.find((choice) => choice.id === "find_mentor")?.action).toEqual({ type: "navigate", href: "#preludematch" });
  });

  it("runs the essay flow using predefined choices", () => {
    let snapshot = createGuidedAssistantSnapshot();
    snapshot = transitionGuidedAssistant(snapshot, { type: "CHOOSE", choiceId: "essays" });
    expect(snapshot.state).toBe("essay_start");
    snapshot = transitionGuidedAssistant(snapshot, { type: "CHOOSE", choiceId: "essay_brainstorm" });
    expect(snapshot.state).toBe("essay_brainstorm");
    expect(getGuidedAssistantView(snapshot).message).toMatch(/mentor/i);
    expect(getGuidedAssistantView(snapshot).choices[0].action).toEqual({ type: "navigate", href: "#preludematch" });
  });

  it("offers every mentor-focused essay pathway", () => {
    const essay = transitionGuidedAssistant(createGuidedAssistantSnapshot(), { type: "CHOOSE", choiceId: "essays" });
    const view = getGuidedAssistantView(essay);
    expect(view.choices.map((choice) => choice.label)).toEqual([
      "I need a topic",
      "I have an outline",
      "I have a draft",
      "I need supplemental essay help",
      "Find an essay mentor"
    ]);

    for (const choiceId of ["essay_brainstorm", "essay_outline", "essay_draft", "essay_supplemental"]) {
      const path = transitionGuidedAssistant(essay, { type: "CHOOSE", choiceId });
      const pathView = getGuidedAssistantView(path);
      expect(pathView.message).toMatch(/mentor/i);
      expect(pathView.choices[0].action).toEqual({ type: "navigate", href: "#preludematch" });
    }
    const supplemental = transitionGuidedAssistant(essay, { type: "CHOOSE", choiceId: "essay_supplemental" });
    expect(getGuidedAssistantView(supplemental).choices[0].label).toBe("Work on supplementals with a mentor");
  });

  it("uses the revised main-menu labels", () => {
    const labels = getGuidedAssistantView(createGuidedAssistantSnapshot()).choices.map((choice) => choice.label);
    expect(labels).toContain("College List Help");
    expect(labels).toContain("Financial Aid & Scholarships");
    expect(labels).toContain("Application Deadlines");
    expect(labels).toContain("Major & Career Exploration");
    expect(labels).toContain("Parent Support");
  });

  it("routes a close typo and falls back to the menu when unclear", () => {
    expect(routeGuidedAssistantText("I need esssay help")).toBe("essay_start");
    const snapshot = transitionGuidedAssistant(createGuidedAssistantSnapshot(), { type: "TEXT", value: "purple clouds" });
    expect(snapshot.state).toBe("main_menu");
    expect(snapshot.fallback).toBe(true);
  });

  it("supports back, main menu, and find mentor globally", () => {
    const menu = createGuidedAssistantSnapshot();
    const essay = transitionGuidedAssistant(menu, { type: "CHOOSE", choiceId: "essays" });
    expect(transitionGuidedAssistant(essay, { type: "BACK" }).state).toBe("main_menu");
    expect(transitionGuidedAssistant(essay, { type: "MAIN_MENU" }).state).toBe("main_menu");
    expect(transitionGuidedAssistant(essay, { type: "FIND_MENTOR" }).action).toEqual({ type: "navigate", href: "#preludematch" });
  });

  it("provides official resources before optional mentor support", () => {
    const resourceStates = {
      college_fit: "https://collegescorecard.ed.gov/",
      college_cost: "https://collegescorecard.ed.gov/",
      college_balance: "https://collegescorecard.ed.gov/",
      aid_fafsa: "https://studentaid.gov/h/apply-for-aid/fafsa",
      aid_scholarships: "https://bigfuture.collegeboard.org/scholarship-search",
      aid_offers: "https://studentaid.gov/articles/evaluating-financial-aid-offers/",
      deadline_rounds: "https://www.commonapp.org/explore/",
      deadline_plan: "https://www.commonapp.org/explore/",
      major_explore: "https://www.bls.gov/ooh/",
      major_compare: "https://www.bls.gov/ooh/"
    };

    for (const [state, href] of Object.entries(resourceStates)) {
      const view = getGuidedAssistantView({ state, history: [], fallback: false });
      expect(view.choices[0].action).toEqual({ type: "external", href });
      expect(view.choices.some((choice) => choice.action?.href === "#preludematch")).toBe(true);
    }

    const fafsa = { state: "aid_fafsa", history: [], fallback: false };
    expect(transitionGuidedAssistant(fafsa, { type: "CHOOSE", choiceId: "fafsa_resource" }).action).toEqual({
      type: "external",
      href: resourceStates.aid_fafsa
    });
  });
});
