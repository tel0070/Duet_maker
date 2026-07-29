import { expect, test } from "@playwright/test";

test("regenerate button is disabled until a full generation exists for a blank project", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();

  // A blank project starts with no arrangement for any style yet.
  const regenerateButtons = page.locator('button[aria-label$="구간만 다시 생성"]');
  await expect(regenerateButtons.first()).toBeDisabled();
});

test("regenerating a section works without error once an arrangement exists", async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await expect(page.locator(".piano-roll-note--melody").first()).toBeVisible();

  // The sample project ships with a pre-generated arrangement for every
  // style, so the regenerate buttons are already enabled here.
  const regenerateButtons = page.locator('button[aria-label$="구간만 다시 생성"]');
  await expect(regenerateButtons.first()).toBeEnabled();

  // Click the second section's regenerate button (verse, in this sample) —
  // the harmony-core-level guarantee that OTHER sections stay untouched is
  // covered by packages/harmony-core/tests/regenerate-section.test.ts; this
  // just proves the button is wired to the store and doesn't error.
  await regenerateButtons.nth(1).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();
  await expect(page.getByTestId("harmony-track-table")).toBeVisible();
});
