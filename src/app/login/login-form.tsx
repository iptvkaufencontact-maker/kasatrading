"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Info, Leaf, LockKeyhole, Mail } from "lucide-react";
import { apiFetch, getToken, setToken } from "@/lib/client-auth";

export default function LoginForm({ hint }: { hint: { email: string; password: string } | null }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // A valid session may already exist in local storage (used when cookies are blocked).
    if (!getToken()) return;
    apiFetch("/api/auth").then((response) => { if (response.ok) window.location.replace("/"); else setToken(null); }).catch(() => setToken(null));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }), credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.token) setToken(data.token);
      window.location.replace("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); setLoading(false); }
  }
  return <main className="login-page"><div className="login-card"><div className="login-logo"><span className="logo-mark"><Leaf size={21}/></span><span><strong>kasa<span> trading</span></strong><small>LE GOÛT DU NATUREL</small></span></div><div className="login-illustration"/><p className="eyebrow">ESPACE COMMERCIAL</p><h1>Heureux de vous retrouver.</h1><p className="muted">Connectez-vous pour accéder à votre espace Kasa Trading.</p>{hint && <div className="login-hint"><strong><Info size={13}/> Première connexion</strong>Identifiant : <code>{hint.email}</code> · Mot de passe : <code>{hint.password}</code><br/>Pensez à modifier ce mot de passe dès votre première connexion.</div>}<form onSubmit={submit} className="form-stack"><label>Adresse e-mail<div className="input-icon"><Mail size={17}/><input type="email" name="email" required maxLength={160} defaultValue={hint?.email || ""} placeholder="vous@exemple.ma" autoComplete="email" /></div></label><label>Mot de passe<div className="input-icon"><LockKeyhole size={17}/><input type="password" name="password" required maxLength={200} placeholder="Votre mot de passe" autoComplete="current-password" /></div></label>{error && <p className="form-error">{error}</p>}<button className="button primary wide" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}<ArrowRight size={17}/></button></form><p className="login-footer">Des produits de qualité, des relations durables.</p></div></main>;
}
