"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, KeyRound, Leaf, LayoutDashboard, LogOut, Menu, Package, Plus, Settings2, ShieldAlert, UsersRound, X } from "lucide-react";
import type { AppData, Order, SessionUser } from "@/lib/types";
import Dashboard from "./dashboard";
import { CatalogueView, ClientsView, type NewOrderOptions } from "./clients-catalogue";
import { type AdminTab, AdminView, OrdersView } from "./orders-admin";
import OrderWorkflow from "./order-workflow";
import { initials, type Mutate } from "./shared";
import { apiFetch, goToLogin, setToken } from "@/lib/client-auth";

type View = "dashboard" | "clients" | "catalogue" | "commandes" | "administration";
type Flow = { editing?: Order | null; clientId?: number; productId?: number };
const nav: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { view: "clients", label: "Clients", icon: UsersRound },
  { view: "catalogue", label: "Catalogue", icon: Package },
  { view: "commandes", label: "Commandes", icon: ClipboardList },
];
const labels: Record<View, string> = { dashboard: "Tableau de bord", clients: "Clients", catalogue: "Catalogue", commandes: "Commandes", administration: "Administration" };
function isView(value: string | null): value is View { return !!value && ["dashboard", "clients", "catalogue", "commandes", "administration"].includes(value); }

export default function AppShell({ initialData, user, authEnabled = false }: { initialData: AppData; user: SessionUser; authEnabled?: boolean }) {
  const [data, setData] = useState(initialData); const [view, setView] = useState<View>("dashboard");
  const [flow, setFlow] = useState<Flow | null>(null); const [focusOrderId, setFocusOrderId] = useState<number | null>(null);
  const [menu, setMenu] = useState(false); const [toast, setToast] = useState("");
  const [adminRequest, setAdminRequest] = useState<{ tab: AdminTab; n: number }>({ tab: "products", n: 0 });
  const [mustChange, setMustChange] = useState(user.mustChangePassword);
  useEffect(() => { const read = () => { const value = new URLSearchParams(window.location.search).get("view"); setView(isView(value) ? value : "dashboard"); }; read(); window.addEventListener("popstate", read); return () => window.removeEventListener("popstate", read); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3000); return () => clearTimeout(timer); }, [toast]);
  const navigate = useCallback((next: string) => { if (!isView(next)) return; setView(next); setMenu(false); const url = next === "dashboard" ? "/" : `/?view=${next}`; window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const mutate: Mutate = async (entity, action, payload) => {
    const response = await apiFetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, action, payload }) });
    const result = await response.json();
    if (response.status === 401) { goToLogin(); throw new Error("Connexion requise."); }
    if (!response.ok) throw new Error(result.error || "Une erreur est survenue.");
    const fresh = await apiFetch("/api/data");
    if (!fresh.ok) throw new Error("Enregistré, mais impossible d’actualiser les données.");
    setData(await fresh.json());
    if (entity === "account") setMustChange(false);
    setToast(entity === "account" ? "Mot de passe modifié avec succès." : action === "delete" ? "Élément supprimé avec succès." : "Modifications enregistrées avec succès.");
    return result;
  };
  function newOrder(options: NewOrderOptions = {}) { setFlow({ clientId: options.clientId, productId: options.productId }); }
  function openOrder(id: number) { setFocusOrderId(id); navigate("commandes"); }
  function editOrder(order: Order) { setFocusOrderId(null); setFlow({ editing: order }); }
  function openAccount() { setAdminRequest((previous) => ({ tab: "account", n: previous.n + 1 })); setMenu(false); navigate("administration"); }
  async function signOut() { try { await apiFetch("/api/auth", { method: "DELETE" }); } finally { setToken(null); window.location.replace("/login"); } }
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const roleLabel = !authEnabled ? "Kasa Trading" : user.role === "admin" ? "Administrateur" : "Commercial"; const userInitials = authEnabled ? initials(user.name || user.email) : "KT";
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => navigate("dashboard")} aria-label="Kasa Trading, accueil"><span className="brand-mark"><Leaf size={25} strokeWidth={1.6}/></span><span className="brand-word"><strong>kasa<span> trading</span></strong><small>LE GOÛT DU NATUREL</small></span></button><div className="sidebar-divider"/><div className="nav-caption">ESPACE DE TRAVAIL</div><nav className="side-nav">{nav.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><item.icon size={19} strokeWidth={1.8}/><span>{item.label}</span>{view === item.view && <i/>}</button>)}</nav><div className="nav-caption manage-caption">GESTION</div><nav className="side-nav"><button className={view === "administration" ? "active" : ""} onClick={() => navigate("administration")}><Settings2 size={19} strokeWidth={1.8}/><span>Administration</span>{view === "administration" && <i/>}</button></nav><button className="sidebar-new" onClick={() => newOrder()}><span><Plus size={18}/></span> Nouvelle commande <ArrowRight size={15}/></button><div className="sidebar-bottom"><div className="sidebar-note"><div className="sidebar-note-icon"><Leaf size={19}/></div><strong>Naturellement proches.</strong><p>À vos côtés, à chaque étape de votre activité.</p></div><div className="sidebar-user"><span className="user-avatar">{userInitials}</span><span><strong>{user.name}</strong><small>{roleLabel}</small></span>{authEnabled && <button className="sidebar-logout" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={15}/></button>}</div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><span className="mobile-logo"><Leaf size={19}/> <strong>kasa trading</strong></span><div className="breadcrumb"><span>ESPACE COMMERCIAL</span><i/> <strong>{labels[view]}</strong></div></div><div className="topbar-right"><div className="date-display"><CalendarDays size={16}/><span>{date}</span></div><div className="topbar-line"/><div className="user-menu-wrap"><button className="top-user" onClick={() => setMenu(!menu)} aria-label="Menu du compte"><span className="top-avatar">{userInitials}</span><span className="top-user-info"><strong>{user.name}</strong><small>{roleLabel}</small></span><ChevronDown size={15}/></button>{menu && <div className="user-dropdown"><div><strong>{user.name}</strong><small>{authEnabled ? user.email : "Accès direct, sans connexion"}</small></div>{authEnabled && <button onClick={openAccount}><KeyRound size={16}/> Mon compte</button>}<button onClick={() => navigate("administration")}><Settings2 size={16}/> Administration</button>{authEnabled && <button onClick={signOut}><LogOut size={16}/> Se déconnecter</button>}</div>}</div><button className="mobile-plus" onClick={() => newOrder()} aria-label="Nouvelle commande"><Plus size={21}/></button></div></header>
      {authEnabled && mustChange && <div className="security-banner"><ShieldAlert size={17}/><span>Vous utilisez encore le mot de passe initial. Pensez à le modifier pour sécuriser votre compte.</span><button onClick={openAccount}>Modifier maintenant</button></div>}
      <main>{view === "dashboard" && <Dashboard data={data} navigate={navigate} newOrder={() => newOrder()} openOrder={openOrder}/>} {view === "clients" && <ClientsView data={data} mutate={mutate} newOrder={newOrder} openOrder={openOrder}/>} {view === "catalogue" && <CatalogueView data={data} mutate={mutate} newOrder={newOrder}/>} {view === "commandes" && <OrdersView data={data} mutate={mutate} newOrder={() => newOrder()} editOrder={editOrder} initialOrderId={focusOrderId}/>} {view === "administration" && <AdminView data={data} mutate={mutate} navigate={navigate} user={user} authEnabled={authEnabled} initialTab={adminRequest.tab} tabRequest={adminRequest.n}/>}</main>
    </div><nav className="mobile-nav" aria-label="Navigation principale">{nav.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><item.icon size={20}/><span>{item.view === "dashboard" ? "Accueil" : item.label}</span></button>)}<button className={view === "administration" ? "active" : ""} onClick={() => navigate("administration")}><Menu size={20}/><span>Menu</span></button></nav>
    {flow && <OrderWorkflow key={`${flow.editing?.id || "new"}-${flow.clientId || ""}-${flow.productId || ""}`} data={data} mutate={mutate} editing={flow.editing} initialClientId={flow.clientId} initialProductId={flow.productId} onClose={() => setFlow(null)} onFinish={(id) => { setFlow(null); openOrder(id); }}/>} {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={() => setToast("")} aria-label="Fermer"><X size={15}/></button></div>}</div>;
}
