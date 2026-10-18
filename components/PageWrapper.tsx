"use client";
import { useEffect, useState } from "react";
import { ChoosePath } from "./ChoosePath";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasPath, setHasPath] = useState(false);

  useEffect(() => {
    // Check if they already chose anonymous or signup
    const path = localStorage.getItem("wd_path_chosen");
    if (path) {
      setHasPath(true);
    }
    setReady(true);
  }, []);

  // Wait until we check localStorage (prevents flashing)
  if (!ready) return <div className="min-h-screen bg-paper" />;

  // If they haven't chosen, show the gate
  if (!hasPath) {
    return <ChoosePath onChooseAnonymous={() => setHasPath(true)} />;
  }

  // Once chosen, show the app
  return <>{children}</>;
}
