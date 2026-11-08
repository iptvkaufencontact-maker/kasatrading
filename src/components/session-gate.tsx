"use client";

import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import type { AppData, SessionUser } from "@/lib/types";
import { apiFetch, getToken, goToLogin } from "@/lib/client-auth";
import AppShell from "./app-shell";

/** Rendered when no session cookie reached the server: restores the session from the stored token. */
export default function SessionGate() {
  const [state, setState] = useState<{ user: SessionUser; data: AppData } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) { goToLogin(); return; }
      try {
        const me = await apiFetch("/api/auth");
        if (!me.ok) { goToLogin(); return; }
        const { user } = await me.json() as { user: SessionUser };
        const response = await apiFetch("/api/data");
        if (!response.ok) { goToLogin(); return; }
        const data = await response.json() as AppData;
        if (!cancelled) setState({ user, data });
      } catch { goToLogin(); }
    })();
    return () => { cancelled = true; };
  }, []);
  if (!state) return <div className="session-gate"><span className="brand-mark"><Leaf size={24}/></span><p>Ouverture de votre espace...</p></div>;
  return <AppShell initialData={state.data} user={state.user} authEnabled/>;
}
