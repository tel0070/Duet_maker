import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await expect(page.locator(".piano-roll-note--melody").first()).toBeVisible();
});

function firstNoteRow(page: import("@playwright/test").Page) {
  return page.locator(".editor-tables-grid table tbody tr").first();
}

test("dragging a note moves it in time and pitch", async ({ page }) => {
  const note = page.locator(".piano-roll-note--melody").first();
  const before = await note.boundingBox();
  if (!before) throw new Error("note not visible");

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 56, before.y + before.height / 2 - 20, { steps: 5 });
  await page.mouse.up();

  const row = firstNoteRow(page);
  await expect(row.locator("input").first()).toHaveValue("66"); // pitch: 64 + 2 semitones
  await expect(row.locator("input").nth(1)).toHaveValue("2"); // startTime: 0 + 2 beats
});

test("dragging a note's right edge resizes its duration", async ({ page }) => {
  const handle = page.locator(".piano-roll-resize-handle").first();
  const before = await handle.boundingBox();
  if (!before) throw new Error("resize handle not visible");

  await page.mouse.move(before.x + 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 2 + 56, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(firstNoteRow(page).locator("input").nth(2)).toHaveValue("4"); // duration: 2 + 2 beats
});

test("a plain click (no movement) selects the note instead of moving it", async ({ page }) => {
  const note = page.locator(".piano-roll-note--melody").first();
  const before = await note.boundingBox();
  if (!before) throw new Error("note not visible");

  await note.click();

  const row = firstNoteRow(page);
  await expect(row.locator("input").nth(1)).toHaveValue("0"); // startTime unchanged
  await expect(page.locator(".piano-roll-note--selected")).toHaveCount(1);
});

test("double-clicking empty space adds a new note", async ({ page }) => {
  const rowCountBefore = await page.locator(".editor-tables-grid table tbody tr").count();
  const svgBox = await page.locator(".piano-roll-scroll svg").boundingBox();
  if (!svgBox) throw new Error("piano roll not visible");

  await page.mouse.dblclick(svgBox.x + 400, svgBox.y + 150);

  await expect(page.locator(".editor-tables-grid table tbody tr")).toHaveCount(rowCountBefore + 1);
});

test("selecting a note and pressing Delete removes it", async ({ page }) => {
  const rowCountBefore = await page.locator(".editor-tables-grid table tbody tr").count();
  const note = page.locator(".piano-roll-note--melody").first();
  await note.click();
  await expect(page.locator(".piano-roll-note--selected")).toHaveCount(1);

  await note.press("Delete");

  await expect(page.locator(".editor-tables-grid table tbody tr")).toHaveCount(rowCountBefore - 1);
});
