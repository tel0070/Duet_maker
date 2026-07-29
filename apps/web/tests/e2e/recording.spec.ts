import { expect, test } from "@playwright/test";

test("records from the (fake, sandboxed) microphone and produces a playable, downloadable clip", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();

  const startButton = page.getByRole("button", { name: "녹음 시작" });
  const stopButton = page.getByRole("button", { name: "녹음 정지", exact: true });
  const downloadButton = page.getByRole("button", { name: "녹음 파일 내보내기" });

  await expect(stopButton).toBeDisabled();
  await expect(downloadButton).toBeDisabled();

  await startButton.click();
  await expect(page.locator(".recording-status")).toHaveText("녹음 중...");
  await expect(stopButton).toBeEnabled();

  // Let the fake device actually produce a moment of audio to record.
  await page.waitForTimeout(500);
  await stopButton.click();

  await expect(page.locator(".recording-status")).toHaveText("녹음 중이 아닙니다.");
  await expect(downloadButton).toBeEnabled();
  await expect(page.locator("audio.recording-audio")).toHaveCount(1);
  const src = await page.locator("audio.recording-audio").getAttribute("src");
  expect(src).toMatch(/^blob:/);
});

test("has no console errors during a record/stop cycle", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/#editor");

  await page.getByRole("button", { name: "녹음 시작" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "녹음 정지", exact: true }).click();

  expect(errors).toEqual([]);
});
