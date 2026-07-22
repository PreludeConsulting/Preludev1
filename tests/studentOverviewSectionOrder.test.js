import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("student overview section order", () => {
  it("keeps mentor activities in the summary stack without profile strength", () => {
    const component = read("src/dashboard/components/product/StudentOverviewProduct.jsx");
    const cards = read("src/dashboard/components/product/PrepDashboardCards.jsx");
    const activitiesIndex = component.indexOf('<StudentMentorActivities className="dash-product-split__mentor-activities"');
    const cardsIndex = component.indexOf("<PrepDashboardCards");

    expect(activitiesIndex).toBeGreaterThan(-1);
    expect(activitiesIndex).toBeLessThan(cardsIndex);
    expect(component).not.toContain("AcademicProgressCard");
    expect(cards).not.toContain("Profile strength");
    expect(cards).not.toContain("Academic Progress");
  });

  it("makes the assigned-activities panel span the summary grid", () => {
    const styles = read("src/dashboard/dashboard-product.css");

    expect(styles).toMatch(/\.dash-product-split__mentor-activities\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
    expect(styles).toMatch(/\.dash-product-split--prep \.dash-product-split__mentor-activities\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1/);
  });
});
