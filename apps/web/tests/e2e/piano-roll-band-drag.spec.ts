import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await expect(page.locator(".piano-roll-chord-band").first()).toBeVisible();
});

function firstChordRow(page: import("@playwright/test").Page) {
  return page.locator(".editor-tables-grid > div").nth(1).locator("table tbody tr").first();
}

function firstSectionRow(page: import("@playwright/test").Page) {
  return page.locator(".editor-tables-grid > div").nth(2).locator("table tbody tr").first();
}

test("dragging a chord band moves its start time, leaving duration untouched", async ({ page }) => {
  const band = page.locator(".piano-roll-chord-band").first();
  const before = await band.boundingBox();
  if (!before) throw new Error("chord band not visible");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 56, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();

  const row = firstChordRow(page);
  await expect(row.locator("input").first()).toHaveValue("2"); // startTime: 0 + 2 beats
  await expect(row.locator("input").nth(1)).toHaveValue("4"); // duration unchanged
});

test("dragging a chord band's right edge resizes its duration, leaving start time untouched", async ({ page }) => {
  const handle = page.locator(".piano-roll-band-resize-handle--chord").first();
  const before = await handle.boundingBox();
  if (!before) throw new Error("chord resize handle not visible");

  await page.mouse.move(before.x + 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 2 + 56, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();

  const row = firstChordRow(page);
  await expect(row.locator("input").first()).toHaveValue("0"); // startTime unchanged
  await expect(row.locator("input").nth(1)).toHaveValue("6"); // duration: 4 + 2 beats
});

test("dragging a section band moves its start time, shifting endTime by the same amount", async ({ page }) => {
  const band = page.locator(".piano-roll-section-band").first();
  const before = await band.boundingBox();
  if (!before) throw new Error("section band not visible");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 56, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();

  const row = firstSectionRow(page);
  await expect(row.locator("input").first()).toHaveValue("2"); // startTime: 0 + 2 beats
  await expect(row.locator("input").nth(1)).toHaveValue("6"); // endTime: 4 + 2 beats (duration preserved)
});

test("dragging a section band's right edge resizes it by extending endTime only", async ({ page }) => {
  const handle = page.locator(".piano-roll-band-resize-handle--section").first();
  const before = await handle.boundingBox();
  if (!before) throw new Error("section resize handle not visible");

  await page.mouse.move(before.x + 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 2 + 56, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();

  const row = firstSectionRow(page);
  await expect(row.locator("input").first()).toHaveValue("0"); // startTime unchanged
  await expect(row.locator("input").nth(1)).toHaveValue("6"); // endTime: 4 + 2 beats
});

test("has no console errors while dragging chord and section bands", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const chordBand = page.locator(".piano-roll-chord-band").first();
  const chordBox = await chordBand.boundingBox();
  if (!chordBox) throw new Error("chord band not visible");
  await page.mouse.move(chordBox.x + chordBox.width / 2, chordBox.y + chordBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(chordBox.x + chordBox.width / 2 + 28, chordBox.y + chordBox.height / 2, { steps: 3 });
  await page.mouse.up();

  const sectionBand = page.locator(".piano-roll-section-band").first();
  const sectionBox = await sectionBand.boundingBox();
  if (!sectionBox) throw new Error("section band not visible");
  await page.mouse.move(sectionBox.x + sectionBox.width / 2, sectionBox.y + sectionBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sectionBox.x + sectionBox.width / 2 + 28, sectionBox.y + sectionBox.height / 2, { steps: 3 });
  await page.mouse.up();

  expect(errors).toEqual([]);
});
