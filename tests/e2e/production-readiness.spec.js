import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/plans",
  "/mentors",
  "/contact",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/this-route-does-not-exist"
];

test.describe("public route reliability", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without console errors or dead anchors`, async ({ page }) => {
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      expect(await page.locator('a[href=""], a[href="#"], a[href="#home"]').count()).toBe(0);
      expect(errors).toEqual([]);
    });
  }
});

test("plan badges use the shared Plus and Pro meanings", async ({ page }) => {
  await page.goto("/plans", { waitUntil: "networkidle" });
  await expect(page.getByText("Most Popular", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Best Value", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Most Value|Best Deal|Recommended/, { exact: true })).toHaveCount(0);
});

test("landing top navigation keeps a clean URL", async ({ page }) => {
  await page.goto("/#pricing", { waitUntil: "networkidle" });
  const logoLink = page.locator("a").filter({ has: page.locator('img[alt*="Prelude"]') }).first();
  if (await logoLink.count()) await logoLink.click();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile public pages do not create horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile geometry check");
  for (const route of ["/", "/plans", "/mentors", "/contact", "/register"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
