import { expect, test } from "@playwright/test";

test("editing a blank project saves it and lists it under 최근 프로젝트", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();
  await expect(page.getByText("저장된 프로젝트가 없습니다.")).toBeVisible();

  await page.getByRole("button", { name: "음표 추가" }).click();
  // Autosave is debounced 500ms, then the list refreshes.
  await expect(page.locator(".project-list-item")).toHaveCount(1, { timeout: 3000 });
  await expect(page.locator(".project-list-name")).toHaveText("새 프로젝트");
  await expect(page.getByRole("button", { name: "현재 열림" })).toBeVisible();
});

test("새 프로젝트 starts a new blank project without deleting the previous one", async ({ page }) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1, { timeout: 3000 });

  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(2, { timeout: 3000 });
});

test("여는 project switches the editor to that project's data, and deleting it removes it from the list", async ({
  page,
}) => {
  await page.goto("/#editor");

  // Project A: rename it and add a note.
  await page.getByRole("textbox", { name: "이름" }).fill("프로젝트 A");
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1, { timeout: 3000 });

  // Project B: start fresh, rename it differently.
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByRole("textbox", { name: "이름" }).fill("프로젝트 B");
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(2, { timeout: 3000 });

  // Switch back to A via the list.
  const rowA = page.locator(".project-list-item", { hasText: "프로젝트 A" });
  await rowA.getByRole("button", { name: "열기" }).click();
  await expect(page.getByRole("textbox", { name: "이름" })).toHaveValue("프로젝트 A");

  // Delete B (accept the confirm dialog) and confirm it's gone from the list.
  page.once("dialog", (dialog) => dialog.accept());
  const rowB = page.locator(".project-list-item", { hasText: "프로젝트 B" });
  await rowB.getByRole("button", { name: "삭제" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1);
  await expect(page.locator(".project-list-item", { hasText: "프로젝트 B" })).toHaveCount(0);
});

test("deleting the currently-open project switches the editor to a fresh blank project", async ({ page }) => {
  await page.goto("/#editor");
  await page.getByRole("textbox", { name: "이름" }).fill("지울 프로젝트");
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1, { timeout: 3000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".project-list-item").getByRole("button", { name: "삭제" }).click();

  await expect(page.locator(".project-list-item")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "이름" })).toHaveValue("새 프로젝트");
});

test("has no console errors while switching and deleting projects", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/#editor");
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1, { timeout: 3000 });

  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByRole("button", { name: "음표 추가" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(2, { timeout: 3000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".project-list-item").first().getByRole("button", { name: "삭제" }).click();
  await expect(page.locator(".project-list-item")).toHaveCount(1);

  expect(errors).toEqual([]);
});
