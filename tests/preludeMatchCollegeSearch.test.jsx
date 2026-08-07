/** @vitest-environment happy-dom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreludeCollegeSearch from "../src/components/hero/PreludeCollegeSearch.jsx";
import PreludeMatchQuestionFlow from "../src/components/hero/PreludeMatchQuestionFlow.jsx";
import {
  EXPLORE_COLLEGES,
  STILL_EXPLORING_LABEL,
  filterColleges,
  isValidMatchCollegeAnswer,
  normalizeMatchCollegeAnswers,
  searchExploreColleges
} from "../src/dashboard/data/collegeExploreData.js";
import { canAdvanceQuestion } from "../src/lib/preludeMatchLogic.js";
import { PRELUDE_MATCH_QUESTIONS } from "../src/data/preludeMatchQuestions.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const collegeQuestion = PRELUDE_MATCH_QUESTIONS.find((question) => question.id === "colleges");

let roots = [];

function mount(element) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  act(() => {
    root.render(element);
  });
  return host;
}

function setInputValue(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function keyDown(element, key, options = {}) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...options }));
  });
}

afterEach(() => {
  for (const entry of roots.splice(0)) {
    act(() => entry.root.unmount());
    entry.host.remove();
  }
});

describe("shared Explore Colleges source", () => {
  it("uses the same 85 colleges as the dashboard Explore list", () => {
    expect(EXPLORE_COLLEGES).toHaveLength(85);
    expect(filterColleges(EXPLORE_COLLEGES, {}, "")).toHaveLength(85);
    expect(EXPLORE_COLLEGES[0].id).toBe("mit");
    expect(EXPLORE_COLLEGES.at(-1).id).toBe("georgia-state");
  });

  it("searches by college name, city, state, and abbreviation", () => {
    expect(searchExploreColleges("Harvard").some((college) => college.id === "harvard")).toBe(true);
    expect(searchExploreColleges("Cambridge").some((college) => college.city === "Cambridge")).toBe(true);
    expect(searchExploreColleges("MA").some((college) => college.state === "MA")).toBe(true);
    expect(searchExploreColleges("MIT").some((college) => college.id === "mit")).toBe(true);
  });

  it("rejects arbitrary custom schools and resolves saved explore ids", () => {
    expect(normalizeMatchCollegeAnswers(["ha", "not-a-school"])).toEqual([]);
    expect(isValidMatchCollegeAnswer(["ha"])).toBe(false);
    expect(normalizeMatchCollegeAnswers(["harvard"])[0]).toMatchObject({
      id: "harvard",
      name: "Harvard University",
      city: "Cambridge",
      state: "MA"
    });
    expect(normalizeMatchCollegeAnswers([STILL_EXPLORING_LABEL])).toEqual([STILL_EXPLORING_LABEL]);
  });
});

describe("PreludeCollegeSearch UI", () => {
  it("renders the explore label and Search colleges... placeholder", () => {
    const host = mount(<PreludeCollegeSearch selected={[]} onChange={() => {}} reducedMotion />);
    expect(host.textContent).toContain("Search U.S. colleges and universities");
    expect(host.textContent).not.toContain("Start typing a school");
    const input = host.querySelector(".pm-colleges__input");
    expect(input?.getAttribute("placeholder")).toBe("Search colleges...");
    expect(input?.className).toContain("pm-colleges__input");
  });

  it("shows structured results and supports select, duplicate prevention, and remove", () => {
    const onChange = vi.fn();
    const host = mount(<PreludeCollegeSearch selected={[]} onChange={onChange} reducedMotion />);
    const input = host.querySelector(".pm-colleges__input");

    setInputValue(input, "Harvard");
    const option = [...host.querySelectorAll(".pm-colleges__option")].find((node) =>
      node.textContent.includes("Harvard University")
    );
    expect(option).toBeTruthy();
    expect(option.querySelector(".pm-colleges__name")?.textContent).toBe("Harvard University");
    expect(option.querySelector(".pm-colleges__location")?.textContent).toBe("Cambridge, MA");
    expect(host.textContent).not.toContain("Use a school that is not in the list");

    click(option);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "harvard", name: "Harvard University" })
    ]);
    expect(host.querySelector(".pm-colleges__dropdown")).toBeNull();

    act(() => {
      roots[0].root.render(
        <PreludeCollegeSearch
          selected={[{ id: "harvard", name: "Harvard University", city: "Cambridge", state: "MA" }]}
          onChange={onChange}
          reducedMotion
        />
      );
    });

    const selectedHost = roots[0].host;
    expect(selectedHost.textContent).toContain("Harvard University");
    setInputValue(selectedHost.querySelector(".pm-colleges__input"), "Harvard");
    expect(
      [...selectedHost.querySelectorAll(".pm-colleges__option")].some((node) =>
        node.textContent.includes("Harvard University")
      )
    ).toBe(false);

    const remove = selectedHost.querySelector('button[aria-label="Remove Harvard University"]');
    click(remove);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("supports keyboard selection and closes after outside click", () => {
    const onChange = vi.fn();
    const host = mount(
      <div>
        <button type="button" id="outside">
          Outside
        </button>
        <PreludeCollegeSearch selected={[]} onChange={onChange} reducedMotion />
      </div>
    );
    const input = host.querySelector(".pm-colleges__input");
    setInputValue(input, "Stanford");
    expect(host.querySelector(".pm-colleges__dropdown")).toBeTruthy();

    keyDown(input, "ArrowDown");
    keyDown(input, "Enter");
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "stanford", name: "Stanford University" })
    ]);

    setInputValue(input, "Yale");
    expect(host.querySelector(".pm-colleges__dropdown")).toBeTruthy();
    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    // Click outside via the outside button target
    const outside = host.querySelector("#outside");
    act(() => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(host.querySelector(".pm-colleges__dropdown")).toBeNull();
  });

  it("shows No colleges found for unmatched queries and never offers custom add", () => {
    const host = mount(<PreludeCollegeSearch selected={[]} onChange={() => {}} reducedMotion />);
    setInputValue(host.querySelector(".pm-colleges__input"), "zzzznotacollege");
    expect(host.textContent).toContain("No colleges found.");
    expect(host.textContent).not.toMatch(/Add "/);
  });

  it("clears selected colleges when Still exploring is chosen", () => {
    const onChange = vi.fn();
    const host = mount(
      <PreludeCollegeSearch
        selected={[{ id: "harvard", name: "Harvard University", city: "Cambridge", state: "MA" }]}
        onChange={onChange}
        reducedMotion
      />
    );
    const still = [...host.querySelectorAll("button")].find((button) =>
      button.textContent.includes(STILL_EXPLORING_LABEL)
    );
    click(still);
    expect(onChange).toHaveBeenCalledWith([STILL_EXPLORING_LABEL]);
  });

  it("clears Still exploring when a college is selected", () => {
    const onChange = vi.fn();
    const host = mount(
      <PreludeCollegeSearch selected={[STILL_EXPLORING_LABEL]} onChange={onChange} reducedMotion />
    );
    setInputValue(host.querySelector(".pm-colleges__input"), "MIT");
    const option = [...host.querySelectorAll(".pm-colleges__option")].find((node) =>
      node.textContent.includes("Massachusetts Institute of Technology")
    );
    click(option);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "mit" })]);
  });

  it("rehydrates saved selections when returning to the step", () => {
    const host = mount(
      <PreludeCollegeSearch
        selected={[{ id: "princeton", name: "Princeton University", city: "Princeton", state: "NJ" }]}
        onChange={() => {}}
        reducedMotion
      />
    );
    expect(host.textContent).toContain("Princeton University");
    expect(host.querySelector('button[aria-label="Remove Princeton University"]')).toBeTruthy();
  });

  it("uses a stacked full-width layout without the old overlapping helper copy", () => {
    const host = mount(<PreludeCollegeSearch selected={[]} onChange={() => {}} reducedMotion />);
    const root = host.querySelector(".pm-colleges");
    const label = host.querySelector(".pm-colleges__label");
    const field = host.querySelector(".pm-colleges__field");
    const input = host.querySelector(".pm-colleges__input");
    expect(root).toBeTruthy();
    expect(label?.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field?.contains(input)).toBe(true);
    expect(input?.getAttribute("placeholder")).toBe("Search colleges...");
    expect(host.textContent).not.toContain("Start typing a school");
    expect([...root.children].some((child) => child === label)).toBe(true);
  });
});

describe("Continue validation for college-search", () => {
  it("requires a valid explore college or Still exploring", () => {
    expect(canAdvanceQuestion(collegeQuestion, undefined)).toBe(false);
    expect(canAdvanceQuestion(collegeQuestion, [])).toBe(false);
    expect(canAdvanceQuestion(collegeQuestion, ["ha"])).toBe(false);
    expect(
      canAdvanceQuestion(collegeQuestion, [
        { id: "harvard", name: "Harvard University", city: "Cambridge", state: "MA" }
      ])
    ).toBe(true);
    expect(canAdvanceQuestion(collegeQuestion, [STILL_EXPLORING_LABEL])).toBe(true);
  });

  it("disables and enables the Continue button from the Match flow", () => {
    const host = mount(
      <PreludeMatchQuestionFlow
        question={collegeQuestion}
        progress={10}
        answers={{}}
        onAnswer={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
        onSkip={() => {}}
        pigMotion="idle"
        reducedMotion
        canGoBack={false}
        isLast={false}
      />
    );
    expect(host.querySelector(".pm-btn--primary")?.disabled).toBe(true);

    act(() => {
      roots[0].root.render(
        <PreludeMatchQuestionFlow
          question={collegeQuestion}
          progress={10}
          answers={{ colleges: [STILL_EXPLORING_LABEL] }}
          onAnswer={() => {}}
          onBack={() => {}}
          onContinue={() => {}}
          onSkip={() => {}}
          pigMotion="idle"
          reducedMotion
          canGoBack={false}
          isLast={false}
        />
      );
    });
    expect(roots[0].host.querySelector(".pm-btn--primary")?.disabled).toBe(false);

    act(() => {
      roots[0].root.render(
        <PreludeMatchQuestionFlow
          question={collegeQuestion}
          progress={10}
          answers={{
            colleges: [{ id: "yale", name: "Yale University", city: "New Haven", state: "CT" }]
          }}
          onAnswer={() => {}}
          onBack={() => {}}
          onContinue={() => {}}
          onSkip={() => {}}
          pigMotion="idle"
          reducedMotion
          canGoBack={false}
          isLast={false}
        />
      );
    });
    expect(roots[0].host.querySelector(".pm-btn--primary")?.disabled).toBe(false);
  });
});
