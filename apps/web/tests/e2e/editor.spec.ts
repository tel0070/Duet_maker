import { expect, test } from "@playwright/test";

test("loading a sample project and generating a harmony arrangement works end to end", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();

  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await expect(page.locator('input[value="C major"]')).toBeVisible();

  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();
  await expect(page.getByTestId("score-summary")).toContainText("종합 점수");
});

test("switching styles produces a different arrangement", async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();
  const cleanPopTrack = await page.getByTestId("harmony-track-table").textContent();

  await page.getByRole("radio", { name: /Dramatic/ }).click();
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();
  const dramaticTrack = await page.getByTestId("harmony-track-table").textContent();

  // The per-note relation/reason table, not just the rounded overall score
  // (which can coincidentally match across styles) — this is what actually
  // proves the two styles picked different notes.
  expect(cleanPopTrack).not.toBe(dramaticTrack);
});

test("has no console errors while using the editor", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "minor-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();
  expect(errors).toEqual([]);
});
