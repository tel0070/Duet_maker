import { expect, test } from "@playwright/test";

test("재생하며 녹음 starts both guide playback and microphone recording together", async ({ page }) => {
  await page.goto("/#editor");
  // Use a sample project (not the blank-project default note, which
  // generates a rest rather than a real harmony pitch) so playback of
  // both tracks together lasts long enough to observe before it ends.
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  const playbackStatus = page.locator(".playback-status");
  const recordingStatus = page.locator(".recording-status");
  const downloadButton = page.getByRole("button", { name: "녹음 파일 내보내기" });

  await expect(playbackStatus).toHaveText("재생 중인 트랙이 없습니다.");
  await expect(recordingStatus).toHaveText("녹음 중이 아닙니다.");

  await page.getByRole("button", { name: "재생하며 녹음" }).click();

  await expect(recordingStatus).toHaveText("녹음 중...");
  await expect(playbackStatus).toHaveText("재생 중: 메인 멜로디 + 두 번째 보컬");

  await page.getByRole("button", { name: "재생·녹음 정지" }).click();

  await expect(playbackStatus).toHaveText("재생 중인 트랙이 없습니다.");
  await expect(recordingStatus).toHaveText("녹음 중이 아닙니다.");
  await expect(downloadButton).toBeEnabled();
});

test("재생하며 녹음 falls back to melody-only playback when no harmony has been generated", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();
  await page.getByRole("button", { name: "음표 추가" }).click();

  await page.getByRole("button", { name: "재생하며 녹음" }).click();

  await expect(page.locator(".recording-status")).toHaveText("녹음 중...");
  await expect(page.locator(".playback-status")).toHaveText("재생 중: 메인 멜로디");

  await page.getByRole("button", { name: "재생·녹음 정지" }).click();
});

test("has no console errors during a combined play-while-recording cycle", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  await page.getByRole("button", { name: "재생하며 녹음" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "재생·녹음 정지" }).click();

  expect(errors).toEqual([]);
});
