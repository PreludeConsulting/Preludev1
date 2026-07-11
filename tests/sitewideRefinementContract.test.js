import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("sitewide refinement contracts", () => {
  it("contains the animated university marquee within the viewport", () => {
    const css = read("src/index.css");
    const viewportRule = css.match(/\.university-marquee__viewport\s*\{([\s\S]*?)\}/)?.[1] || "";
    expect(viewportRule).toMatch(/contain:\s*[^;]*inline-size/);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toMatch(/@media \(max-width: 539px\)[\s\S]*\.shopify-hero__typing-line\s*\{[^}]*max-width:\s*100%/);
  });

  it("uses Prelude typography and shared elevation tokens in the dashboard shell", () => {
    const css = read("src/dashboard/dashboard.css");
    expect(css).toMatch(/--dash-font-sans:\s*"Barlow"/);
    expect(css).not.toContain("box-shadow: 0 6px 24px rgb(35 39 48 / 0.06)");
  });

  it("lazy-loads the heavy dashboard and public application routes", () => {
    const source = read("src/main.jsx");
    expect(source).toMatch(/lazy\(\(\) => import\("\.\/dashboard\/DashboardRouter\.jsx"\)\)/);
    expect(source).toMatch(/lazy\(\(\) => import\("\.\/components\/MentorsPage\.jsx"\)\)/);
    expect(source).toMatch(/lazy\(\(\) => import\("\.\/components\/ContactPage\.jsx"\)\)/);
    expect(source).toContain('lazyNamed(() => import("./components/AuthPages.jsx"), "LoginPage")');
    expect(source).toContain('lazyNamed(() => import("./components/PlanSelectionPage.jsx"), "PlansPage")');
    expect(source).toContain('lazy(() => import("./components/onboarding/PreludeMatchOnboardingPage.jsx"))');
    expect(source).toContain("RouteLoadingFallback");

    const dashboard = read("src/dashboard/DashboardRouter.jsx");
    expect(dashboard).toContain('lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentOverview")');
    expect(dashboard).toContain('lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorOverview")');
    expect(dashboard).toContain('lazyNamed(() => import("./pages/parent/ParentPages.jsx"), "ParentOverview")');
  });

  it("documents every required route family in the QA checklist", () => {
    const checklist = read("docs/qa/sitewide-refinement-checklist.md");
    for (const family of ["Public", "Authentication", "Onboarding", "Student", "Mentor", "Parent"]) {
      expect(checklist).toContain(`## ${family}`);
    }
    for (const width of ["1440", "1024", "768", "390"]) expect(checklist).toContain(width);
  });

  it("does not present unavailable integrations or billing as unfinished product copy", () => {
    const settings = read("src/dashboard/lib/settingsExperience.js");
    const translations = read("src/lib/translations.js");
    expect(settings).not.toContain('actionLabel: integrations.googleCalendar?.connected ? "Disconnect" : available ? "Connect Google Calendar" : "Coming soon"');
    expect(settings).not.toContain('actionLabel: integrations.zoom?.connected ? "Disconnect" : available ? "Connect Zoom Account" : "Coming soon"');
    expect(translations).not.toContain("Paid subscriptions are coming soon.");
  });
});
