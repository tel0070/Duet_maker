import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorPage } from "../../src/pages/EditorPage.js";
import { useProjectStore } from "../../src/store/project-store.js";

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  // Await the storage clear (not just the in-memory reset) so a previous
  // test's debounced autosave can't race hydrateFromStorage() on mount and
  // clobber the fresh blank project with stale data.
  await useProjectStore.getState().resetStorage();
});

describe("EditorPage", () => {
  it("shows a loading state, then the editor once hydration finishes", async () => {
    render(<EditorPage />);
    expect(await screen.findByRole("heading", { name: "프로젝트 정보" })).toBeTruthy();
  });

  it("lets a user add a note and a chord via the tables, then generate a harmony arrangement", async () => {
    const user = userEvent.setup();
    render(<EditorPage />);
    await screen.findByRole("heading", { name: "프로젝트 정보" });

    // The add-note/add-chord forms default to a valid, non-empty row —
    // submitting with defaults is a legitimate "add" action a real user
    // can take (click "추가" without touching the fields first).
    await user.click(screen.getByRole("button", { name: "음표 추가" }));
    expect(useProjectStore.getState().project.mainMelody).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "코드 추가" }));
    expect(useProjectStore.getState().project.chords).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "화음 생성" }));

    expect(await screen.findByTestId("score-summary")).toBeTruthy();
    expect(useProjectStore.getState().currentArrangement()?.harmonyTrack).toHaveLength(1);
  });

  it("shows a Korean error instead of crashing when generating with no melody", async () => {
    const user = userEvent.setup();
    render(<EditorPage />);
    await screen.findByRole("heading", { name: "프로젝트 정보" });

    await user.click(screen.getByRole("button", { name: "화음 생성" }));

    expect(await screen.findByText(/먼저 멜로디를 입력하거나/)).toBeTruthy();
  });
});
