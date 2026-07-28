import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Root } from "../../src/Root.js";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

beforeEach(() => {
  window.location.hash = "";
});

describe("Root", () => {
  it("shows the landing page by default", () => {
    render(<Root />);
    expect(screen.getByRole("heading", { name: "Solo-to-Duet Vocal Arranger" })).toBeTruthy();
  });

  it("shows the editor when the hash is #editor", async () => {
    window.location.hash = "#editor";
    render(<Root />);
    expect(await screen.findByRole("heading", { name: "프로젝트 정보" })).toBeTruthy();
  });
});
