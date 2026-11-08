"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ClipboardList, Eye, EyeOff, Package, Plus, ShoppingBag, UsersRound, WalletCards } from "lucide-react";
import type { AppData, Order } from "@/lib/types";
import { initials, money, shortDate, StatusBadge } from "./shared";

type Props = { data: AppData; navigate: (view: string) => void; newOrder: () => void; openOrder: (id: number) => void };

type Period = "all" | "today" | "7d" | "30d" | "month" | "year" | "custom";
const periodOptions: { value: Period; label: string }[] = [
  { value: "all", label: "Toutes les périodes" },
  { value: "today", label: "Aujourd’hui" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "month", label: "Ce mois-ci" },
  { value: "year", label: "Cette année" },
  { value: "custom", label: "Période personnalisée" },
];

function presetRange(period: Period): { start: Date | null; end: Date | null } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (period) {
    case "today": return { start: startOfDay, end: endOfDay };
    case "7d": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), end: endOfDay };
    case "30d": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), end: endOfDay };
    case "month": return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay };
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay };
    default: return { start: null, end: null };
  }
}

export default function Dashboard({ data, navigate, newOrder, openOrder }: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const [masked, setMasked] = useState(true);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const range = useMemo(() => period !== "custom" ? presetRange(period) : { start: from ? new Date(`${from}T00:00:00`) : null, end: to ? new Date(`${to}T23:59:59.999`) : null }, [period, from, to]);
  const orders = useMemo(() => data.orders.filter((order) => { const date = new Date(order.createdAt); if (range.start && date < range.start) return false; if (range.end && date > range.end) return false; return true; }), [data.orders, range]);
  const active = orders.filter((order) => order.status !== "cancelled");
  const today = new Date().toDateString();
  const todayOrders = data.orders.filter((order) => new Date(order.createdAt).toDateString() === today).length;
  const totalSales = active.reduce((sum, order) => sum + Number(order.total), 0);
  const pending = orders.filter((order) => order.status === "pending").length;
  const salesByProduct = active.flatMap((order) => order.items).reduce<Record<number, number>>((acc, item) => { if (item.productId) acc[item.productId] = (acc[item.productId] || 0) + item.totalSachets; return acc; }, {});
  const popular = [...data.products].sort((a, b) => (salesByProduct[b.id] || 0) - (salesByProduct[a.id] || 0)).slice(0, 4);
  const stats = [
    { label: "Ventes totales", value: money(totalSales, 0), detail: "Hors commandes annulées", icon: WalletCards, tone: "sage" },
    { label: "Commandes", value: String(orders.length).padStart(2, "0"), detail: `${pending} en attente de confirmation`, icon: ShoppingBag, tone: "peach" },
    { label: "Commandes aujourd’hui", value: String(todayOrders).padStart(2, "0"), detail: "Créées aujourd’hui", icon: ClipboardList, tone: "lavender" },
    { label: "Clients", value: String(data.clients.length).padStart(2, "0"), detail: "Dans votre portefeuille", icon: UsersRound, tone: "yellow" },
  ];
  return <div className="dashboard page-content">
    <div className="page-heading dashboard-heading"><div><div className="heading-overline"><span/> VOTRE ESPACE COMMERCIAL</div><h1>Tableau de bord</h1><p>Bienvenue ! Voici un aperçu de votre activité.</p></div><button className="button primary new-order-button" onClick={newOrder}><Plus size={19}/> Nouvelle commande</button></div>
    <div className="section-heading overview-heading"><div><h2>Vue d’ensemble</h2><p>Votre activité en un coup d’œil</p></div><div className="period-filter"><button type="button" className="mask-toggle" onClick={() => setMasked((value) => !value)} aria-pressed={masked} aria-label={masked ? "Afficher les chiffres" : "Masquer les chiffres"} title={masked ? "Afficher les chiffres" : "Masquer les chiffres"}>{masked ? <Eye size={18}/> : <EyeOff size={18}/>}</button><label className="period-select"><CalendarDays size={15}/><select aria-label="Période" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{period === "custom" && <div className="date-filter"><input type="date" aria-label="À partir du" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)}/><span>→</span><input type="date" aria-label="Jusqu’au" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}/></div>}</div></div>
    <section className={`stats-grid${masked ? " masked" : ""}`}>{stats.map((stat) => <div className="stat-card" key={stat.label}><div className="stat-top"><span className={`stat-icon ${stat.tone}`}><stat.icon size={20} strokeWidth={1.8}/></span><ArrowUpRight size={16} className="stat-arrow"/></div><div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value}</div><div className="stat-detail"><span/> {stat.detail}</div></div>)}</section>
    <div className="dashboard-lower"><section className="panel recent-panel"><div className="panel-header"><div><h2>Commandes récentes</h2><p>Suivez vos dernières commandes</p></div><button className="text-link" onClick={() => navigate("commandes")}>Voir tout <ArrowRight size={15}/></button></div><div className="table-scroll"><table className="data-table recent-table"><thead><tr><th>COMMANDE</th><th>CLIENT</th><th>DATE</th><th>MONTANT</th><th>STATUT</th><th></th></tr></thead><tbody>{orders.slice(0, 5).map((order, index) => <tr key={order.id} onClick={() => openOrder(order.id)} className="clickable-row"><td><span className="order-number">#{order.orderNumber}</span></td><td><div className="table-client"><span className={`avatar avatar-${index % 5}`}>{initials(order.clientName)}</span><span><strong>{order.clientName}</strong><small>{order.clientCity}</small></span></div></td><td className="table-muted">{shortDate(order.createdAt)}</td><td className="table-money">{money(order.total)}</td><td><StatusBadge status={order.status}/></td><td><ArrowUpRight className="row-arrow" size={16}/></td></tr>)}</tbody></table>{!orders.length && <div className="table-empty">{data.orders.length ? "Aucune commande sur cette période." : <>Aucune commande pour le moment. <button onClick={newOrder}>Créer une commande</button></>}</div>}</div></section>
      <section className="panel popular-panel"><div className="panel-header"><div><h2>Produits populaires</h2><p>Les favoris de vos clients</p></div><button className="round-link" onClick={() => navigate("catalogue")} aria-label="Voir le catalogue"><ArrowUpRight size={17}/></button></div><div className="popular-list">{popular.map((product, index) => <button className="popular-item" key={product.id} onClick={() => navigate("catalogue")}><span className="popular-rank">0{index + 1}</span><span className="popular-img">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <Package size={22}/>}</span><span className="popular-info"><strong>{product.name}</strong><small>{product.categoryName}</small></span><span className="popular-price">{money(product.defaultSachetPrice)}<small>/ sachet</small></span></button>)}</div><button className="catalogue-link" onClick={() => navigate("catalogue")}>Explorer le catalogue <ArrowRight size={15}/></button></section></div>
  </div>;
}
