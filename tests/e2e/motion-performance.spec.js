import { expect, test } from "@playwright/test";

const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 }
];

async function sampleAnimationFrames(page, frameCount = 120) {
  return page.evaluate(async (count) => {
    const longTasks = [];
    let longTaskObserver = null;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        longTasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      longTaskObserver.observe({ type: "longtask" });
    } catch {
      // Long Task API is not available in every browser engine.
    }

    const frameTimes = [];
    let previous = null;
    await new Promise((resolve) => {
      const tick = (now) => {
        if (previous !== null) frameTimes.push(now - previous);
        previous = now;
        if (frameTimes.length >= count) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    longTaskObserver?.disconnect();

    const sorted = [...frameTimes].sort((a, b) => a - b);
    return {
      withinBudgetRate: frameTimes.filter((duration) => duration <= 17.5).length / frameTimes.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: Math.max(...frameTimes),
      longTasksOver50: longTasks.filter((duration) => duration > 50).length
    };
  }, frameCount);
}

test.describe("@performance landing motion performance", () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`stays within the frame budget at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "networkidle" });
      await page.locator(".pm-intro--cinematic").waitFor({ state: "visible" });

      const result = await sampleAnimationFrames(page);
      expect(result.longTasksOver50).toBe(0);
      expect(result.withinBudgetRate).toBeGreaterThanOrEqual(0.95);
      expect(result.p95).toBeLessThanOrEqual(17.5);
    });
  }

  test("offscreen cinematic and parent cards stop mutating", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const mutations = await page.evaluate(async () => {
      const targets = [document.querySelector(".pm-intro--cinematic"), document.querySelector(".focus-container")]
        .filter(Boolean);
      let count = 0;
      const observer = new MutationObserver((records) => {
        count += records.length;
      });
      targets.forEach((target) => observer.observe(target, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      observer.disconnect();
      return count;
    });

    expect(mutations).toBe(0);
  });
});
