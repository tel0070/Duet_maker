import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LandingPage } from "../../src/pages/LandingPage.js";

afterEach(() => {
  cleanup();
});

describe("LandingPage", () => {
  it("renders the product tagline", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/높은 화음, 낮은 화음, 유니즌, 대선율과 주고받기/),
    ).toBeTruthy();
  });

  it("shows the browser-only privacy notice", () => {
    render(<LandingPage />);
    expect(screen.getByText(/외부 서버로 전송되지/)).toBeTruthy();
  });

  it("links to the GitHub repository", () => {
    render(<LandingPage />);
    const link = screen.getByRole("link", { name: /GitHub 저장소/ });
    expect(link.getAttribute("href")).toBe("https://github.com/tel0070/Duet_maker");
  });

  it("links to the editor via the hash route, not a dead button", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("link", { name: /편곡 시작하기/ });
    expect(cta.getAttribute("href")).toBe("#editor");
  });

  it("does not render a clickable call-to-action for an unimplemented feature", () => {
    render(<LandingPage />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });
});
