import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/App.js";

afterEach(() => {
  cleanup();
});

describe("App (landing page)", () => {
  it("renders the product tagline", () => {
    render(<App />);
    expect(
      screen.getByText(/높은 화음, 낮은 화음, 유니즌, 대선율과 주고받기/),
    ).toBeTruthy();
  });

  it("shows the browser-only privacy notice", () => {
    render(<App />);
    expect(screen.getByText(/외부 서버로 전송되지/)).toBeTruthy();
  });

  it("links to the GitHub repository", () => {
    render(<App />);
    const link = screen.getByRole("link", { name: /GitHub 저장소/ });
    expect(link.getAttribute("href")).toBe("https://github.com/tel0070/Duet_maker");
  });

  it("does not render a clickable call-to-action for an unimplemented feature", () => {
    render(<App />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });
});
