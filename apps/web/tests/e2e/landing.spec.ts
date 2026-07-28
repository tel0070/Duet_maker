import { expect, test } from "@playwright/test";

test("landing page loads and shows the product tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Solo-to-Duet Vocal Arranger" })).toBeVisible();
  await expect(page.getByText(/외부 서버로 전송되지/)).toBeVisible();
});

test("has no console errors on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/");
  expect(errors).toEqual([]);
});
