import { useEffect, useState } from "react";
import { EditorPage } from "./pages/EditorPage.js";
import { LandingPage } from "./pages/LandingPage.js";

/**
 * Deliberately not react-router: the app has exactly two views today
 * (landing, editor), switched by a URL hash so a link/back-button still
 * works without adding a routing dependency. Revisit if Phase 2 grows more
 * than a couple of views.
 */
function currentView(): "landing" | "editor" {
  return window.location.hash === "#editor" ? "editor" : "landing";
}

export function Root() {
  const [view, setView] = useState(currentView());

  useEffect(() => {
    const onHashChange = () => setView(currentView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (view === "editor") {
    return (
      <>
        <a href="#" className="back-to-landing">
          ← 홈으로
        </a>
        <EditorPage />
      </>
    );
  }

  return <LandingPage />;
}
