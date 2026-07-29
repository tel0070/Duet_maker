import { expect, test } from "@playwright/test";

test("play/stop toggles the playback status and the stop button's enabled state", async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  const status = page.locator(".playback-status");
  const stopButton = page.getByRole("button", { name: "정지", exact: true });
  await expect(status).toHaveText("재생 중인 트랙이 없습니다.");
  await expect(stopButton).toBeDisabled();

  await page.getByRole("button", { name: "메인 멜로디만 재생" }).click();
  await expect(status).toHaveText("재생 중: 메인 멜로디");
  await expect(stopButton).toBeEnabled();

  await stopButton.click();
  await expect(status).toHaveText("재생 중인 트랙이 없습니다.");
  await expect(stopButton).toBeDisabled();
});

test("playing both tracks together shows the combined status", async ({ page }) => {
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "c-g-am-f-pop-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  await page.getByRole("button", { name: "함께 재생" }).click();
  await expect(page.locator(".playback-status")).toHaveText("재생 중: 메인 멜로디 + 두 번째 보컬");
});

test("playback status resets on its own once a short note finishes playing", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();
  // Blank project's default add-note/add-chord forms produce a valid,
  // short (1 beat @ 100 BPM = 0.6s) note — enough to prove auto-stop
  // fires without the test needing to wait out a full song.
  await page.getByRole("button", { name: "음표 추가" }).click();
  await page.getByRole("button", { name: "코드 추가" }).click();
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  await page.getByRole("button", { name: "메인 멜로디만 재생" }).click();
  await expect(page.locator(".playback-status")).toHaveText("재생 중: 메인 멜로디");
  await expect(page.locator(".playback-status")).toHaveText("재생 중인 트랙이 없습니다.", { timeout: 3000 });
});

test("has no console errors during a play/stop cycle", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/#editor");
  await page.selectOption("#sample-select", "minor-ballad");
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  await page.getByRole("button", { name: "함께 재생" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "정지", exact: true }).click();

  expect(errors).toEqual([]);
});

test("A-B loop keeps replaying past the point a one-shot would have auto-stopped", async ({ page }) => {
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();
  // Blank project's default note is 1 beat @ 100 BPM = 0.6s; a one-shot
  // play auto-stops shortly after that (see the auto-stop test above).
  await page.getByRole("button", { name: "음표 추가" }).click();
  await page.getByRole("button", { name: "코드 추가" }).click();
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  const status = page.locator(".playback-status");
  const startBeatInput = page.getByLabel("시작(비트)");
  const endBeatInput = page.getByLabel("끝(비트)");

  await expect(startBeatInput).toBeDisabled();
  await page.getByLabel("구간 반복 (A-B 루프)").check();
  await expect(startBeatInput).toBeEnabled();
  await expect(startBeatInput).toHaveValue("0");
  await expect(endBeatInput).toHaveValue("4");

  await page.getByRole("button", { name: "메인 멜로디만 재생" }).click();
  await expect(status).toHaveText("재생 중: 메인 멜로디 (구간 반복: 0~4비트)");

  // A one-shot of this 1-beat note would have auto-stopped around 0.75s in.
  // Wait well past that and confirm the loop is still actively playing.
  await page.waitForTimeout(1500);
  await expect(status).toHaveText("재생 중: 메인 멜로디 (구간 반복: 0~4비트)");

  await page.getByRole("button", { name: "정지", exact: true }).click();
  await expect(status).toHaveText("재생 중인 트랙이 없습니다.");
});

test("count-in delays playback and does not prevent eventual auto-stop", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/#editor");
  await expect(page.getByRole("heading", { name: "프로젝트 정보" })).toBeVisible();
  await page.getByRole("button", { name: "음표 추가" }).click();
  await page.getByRole("button", { name: "코드 추가" }).click();
  await page.getByRole("button", { name: "화음 생성" }).click();
  await expect(page.getByTestId("score-summary")).toBeVisible();

  await page.getByLabel("카운트인 (4비트)").check();
  await page.getByRole("button", { name: "메인 멜로디만 재생" }).click();
  await expect(page.locator(".playback-status")).toHaveText("재생 중: 메인 멜로디");

  // Count-in (4 beats @ 100 BPM = 2.4s) plus the 0.6s note plus buffer.
  await expect(page.locator(".playback-status")).toHaveText("재생 중인 트랙이 없습니다.", { timeout: 5000 });
  expect(errors).toEqual([]);
});
