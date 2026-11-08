"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ClipboardCheck, Minus, Package, Pencil, Plus, RotateCcw, Search, ShoppingBasket, Store, Trash2, UserPlus, X } from "lucide-react";
import type { AppData, CartItem, Order, Product } from "@/lib/types";
import { LIMITS, lineTotalCents, packingLabel, plural, taxCentsFromHt, taxRateLabel, toCents, totalSachetsOf } from "@/lib/packaging";
import { ClientForm, CURRENCY, initials, money, type Mutate, PriceDelta, shortDate } from "./shared";

type Props = { data: AppData; mutate: Mutate; onClose: () => void; onFinish: (id: number) => void; editing?: Order | null; initialProductId?: number | null; initialClientId?: number | null };
/** A cart line enriched with the packaging/catalogue reference and all derived amounts (integer cents). */
type Line = CartItem & { product: Product; perCarton: number; defaultPrice: string; defaultCents: number; priceCents: number; totalSachets: number; taxRateBps: number | null; totalCents: number; taxCents: number; totalTtcCents: number };

function clampInt(value: number, max: number) { return Math.max(0, Math.min(max, Math.trunc(value))); }

/** Large touch-friendly integer stepper (cartons, sachets). */
function IntControl({ value, label, max, onChange }: { value: number; label: string; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  function commit() {
    const parsed = parseInt(draft.replace(/\D/g, ""), 10);
    if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
    const next = clampInt(parsed, max); onChange(next); setDraft(String(next));
  }
  return <div className="int-control"><button type="button" onClick={() => onChange(clampInt(value - 1, max))} aria-label={`Diminuer ${label}`}><Minus size={17}/></button><input aria-label={label} type="text" inputMode="numeric" pattern="[0-9]*" value={draft} onChange={(event) => setDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}/><button type="button" onClick={() => onChange(clampInt(value + 1, max))} aria-label={`Augmenter ${label}`}><Plus size={17}/></button></div>;
}

function formatPriceDraft(value: number) { return (Math.round(value * 100) / 100).toFixed(2).replace(".", ","); }

/** Negotiated sachet price. Accepts "11", "11.5" or "11,50"; committed on blur / Enter. */
function PriceInput({ value, defaultValue, label, onChange }: { value: number; defaultValue: string; label: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatPriceDraft(value));
  useEffect(() => { setDraft(formatPriceDraft(value)); }, [value]);
  function commit() {
    const parsed = Number(draft.replace(/\s/g, "").replace(",", "."));
    if (draft.trim() === "" || !Number.isFinite(parsed) || parsed < 0) { setDraft(formatPriceDraft(value)); return; }
    const next = Math.min(LIMITS.price, Math.round(parsed * 100) / 100); onChange(next); setDraft(formatPriceDraft(next));
  }
  return <div className={`price-input ${toCents(value) !== toCents(defaultValue) ? "changed" : ""}`}><input aria-label={label} type="text" inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}/><span>{CURRENCY}</span></div>;
}

/** Cartons + additional sachets + negotiated price, with live totals. */
function PackagingPanel({ line, update, compact = false }: { line: Line; update: (patch: Partial<CartItem>) => void; compact?: boolean }) {
  return <div className={`pack-panel ${compact ? "compact" : ""}`}>
    <div className="pack-grid">
      <div className="pack-field"><label>Cartons <small>· {line.perCarton} sachets / carton</small></label><IntControl value={line.cartons} max={LIMITS.cartons} label={`Cartons ${line.product.name}`} onChange={(cartons) => update({ cartons })}/></div>
      <div className="pack-field"><label>Sachets en plus</label><IntControl value={line.sachets} max={LIMITS.sachets} label={`Sachets en plus ${line.product.name}`} onChange={(sachets) => update({ sachets })}/></div>
      <div className="pack-field price"><label>Prix négocié / sachet</label><PriceInput value={line.sachetPrice} defaultValue={line.defaultPrice} label={`Prix négocié ${line.product.name}`} onChange={(sachetPrice) => update({ sachetPrice })}/><div className="pack-note"><span>Prix catalogue : <b>{money(line.defaultPrice)}</b></span>{line.priceCents !== line.defaultCents && <button type="button" onClick={() => update({ sachetPrice: Number(line.defaultPrice) })}><RotateCcw size={11}/> Remettre</button>}</div></div>
    </div>
    <div className="pack-summary"><span>{line.totalSachets > 0 ? <>Total : <b>{plural(line.totalSachets, "sachet")}</b> <small>({packingLabel(line.cartons, line.sachets, line.perCarton)})</small></> : <span className="pack-warning">Indiquez au moins 1 carton ou 1 sachet.</span>}<PriceDelta defaultCents={line.defaultCents} priceCents={line.priceCents}/></span><div className="pack-line-totals">{line.taxRateBps === null ? <span className="pack-warning">TVA à définir</span> : <><span>HT <b>{money(line.totalCents / 100)}</b></span><span>TVA {taxRateLabel(line.taxRateBps)} <b>{money(line.taxCents / 100)}</b></span></>}</div><strong>{line.taxRateBps === null ? "—" : `TTC ${money(line.totalTtcCents / 100)}`}</strong></div>
  </div>;
}

export default function OrderWorkflow({ data, mutate, onClose, onFinish, editing, initialProductId, initialClientId }: Props) {
  const [step, setStep] = useState(initialClientId ? 2 : 1);
  const [clientId, setClientId] = useState<number | null>(editing?.clientId || initialClientId || null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (editing) return editing.items.filter((item) => item.productId && data.products.some((p) => p.id === item.productId)).map((item) => ({ productId: item.productId!, cartons: item.cartonQuantity, sachets: item.additionalSachets, sachetPrice: Number(item.sachetPriceAtOrder) }));
    const product = initialProductId ? data.products.find((p) => p.id === initialProductId) : null;
    return product ? [{ productId: product.id, cartons: 1, sachets: 0, sachetPrice: Number(product.defaultSachetPrice) }] : [];
  });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState(""); const [productSearch, setProductSearch] = useState(""); const [category, setCategory] = useState<number | "all">("all");
  const [clientForm, setClientForm] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ id: number; orderNumber: string } | null>(null);
  const client = data.clients.find((item) => item.id === clientId);
  const filteredClients = data.clients.filter((item) => `${item.name} ${item.phone} ${item.city}`.toLowerCase().includes(clientSearch.toLowerCase()));
  const filteredProducts = data.products.filter((item) => (item.available || cart.some((line) => line.productId === item.id)) && (category === "all" || item.categoryId === category) && `${item.name} ${item.sku}`.toLowerCase().includes(productSearch.toLowerCase()));
  const lines = useMemo<Line[]>(() => cart.flatMap((item) => {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product) return [];
    // Existing lines of an edited order keep the packaging and catalogue price saved with the order.
    const snapshot = editing?.items.find((old) => old.productId === item.productId);
    const perCarton = snapshot?.sachetsPerCartonAtOrder ?? product.sachetsPerCarton;
    const defaultPrice = snapshot?.defaultSachetPriceAtOrder ?? product.defaultSachetPrice;
    const totalSachets = totalSachetsOf(item.cartons, item.sachets, perCarton);
    const priceCents = toCents(item.sachetPrice);
    const taxRateBps = snapshot ? snapshot.taxRateBps : product.taxRateBps;
    const totalCents = lineTotalCents(totalSachets, priceCents);
    const taxCents = taxRateBps === null ? 0 : taxCentsFromHt(totalCents, taxRateBps);
    return [{ ...item, product, perCarton, defaultPrice, defaultCents: toCents(defaultPrice), priceCents, totalSachets, taxRateBps, totalCents, taxCents, totalTtcCents: totalCents + taxCents }];
  }), [cart, data.products, editing]);
  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const taxCents = lines.reduce((sum, line) => sum + line.taxCents, 0);
  const totalCents = subtotalCents + taxCents;
  const totalSachets = lines.reduce((sum, line) => sum + line.totalSachets, 0);
  const discountCents = lines.reduce((sum, line) => sum + (line.defaultCents - line.priceCents) * line.totalSachets, 0);
  const incomplete = lines.filter((line) => line.totalSachets < 1).length;
  const hasUnassignedTax = lines.some((line) => line.taxRateBps === null);
  const canContinue = lines.length > 0 && incomplete === 0 && !hasUnassignedTax;
  function addProduct(product: Product) { setCart((previous) => previous.some((line) => line.productId === product.id) ? previous : [...previous, { productId: product.id, cartons: 1, sachets: 0, sachetPrice: Number(product.defaultSachetPrice) }]); }
  function updateLine(productId: number, patch: Partial<CartItem>) { setCart((previous) => previous.map((line) => line.productId === productId ? { ...line, ...patch } : line)); }
  function removeLine(productId: number) { setCart((previous) => previous.filter((line) => line.productId !== productId)); }
  async function save() {
    if (!clientId || !canContinue) return;
    setSaving(true); setError("");
    try {
      const result = await mutate("order", "save", { ...(editing ? { id: editing.id } : {}), clientId, items: cart.map(({ productId, cartons, sachets, sachetPrice }) => ({ productId, cartons, sachets, sachetPrice })) });
      if (result.id && result.orderNumber) setConfirmed({ id: result.id, orderNumber: result.orderNumber });
    } catch (err) { setError(err instanceof Error ? err.message : "Impossible d'enregistrer la commande."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop order-backdrop"><section className="order-flow" role="dialog" aria-modal="true" aria-label={editing ? "Modifier la commande" : "Nouvelle commande"}>
    <div className="flow-header"><div><div className="flow-title-icon"><ShoppingBasket size={20}/></div><span><h2>{editing ? "Modifier la commande" : "Nouvelle commande"}</h2><p>{editing ? `#${editing.orderNumber}` : "Une commande en quelques étapes"}</p></span></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></div>
    {!confirmed && <div className="flow-steps">{[{ n: 1, label: "Client" }, { n: 2, label: "Produits" }, { n: 3, label: "Récapitulatif" }].map((item, index) => <div className={`flow-step ${step === item.n ? "active" : ""} ${step > item.n ? "done" : ""}`} key={item.n}><span className="step-circle">{step > item.n ? <Check size={15}/> : item.n}</span><span>{item.label}</span>{index < 2 && <i/>}</div>)}</div>}
    <div className="flow-body">{confirmed ? <div className="confirmation"><div className="confirmation-check"><Check size={37}/></div><div className="heading-overline centered"><span/> COMMANDE ENREGISTRÉE</div><h2>{editing ? "Commande mise à jour !" : "C’est dans la boîte !"}</h2><p>La commande de <strong>{client?.name}</strong> a bien été {editing ? "mise à jour" : "enregistrée"}.</p><div className="confirmation-receipt"><div><span>Numéro de commande</span><strong>#{confirmed.orderNumber}</strong></div><div><span>Date</span><strong>{shortDate(editing?.createdAt || new Date())}</strong></div><div><span>Quantité</span><strong>{plural(lines.length, "produit")} · {plural(totalSachets, "sachet")}</strong></div><div><span>Total HT</span><strong>{money(subtotalCents / 100)}</strong></div><div><span>TVA totale</span><strong>{money(taxCents / 100)}</strong></div><div className="receipt-total"><span>Total TTC</span><strong>{money(totalCents / 100)}</strong></div></div><div className="confirmation-actions"><button className="button secondary" onClick={onClose}>Terminer</button><button className="button primary" onClick={() => onFinish(confirmed.id)}>Voir la commande <ArrowRight size={17}/></button></div></div> : <>
      {step === 1 && <div className="flow-section"><div className="flow-section-heading"><div><h3>À qui s’adresse cette commande ?</h3><p>Recherchez ou ajoutez un client pour commencer.</p></div><button className="button secondary compact" onClick={() => setClientForm(true)}><UserPlus size={17}/> Nouveau client</button></div><div className="search-box flow-search"><Search size={18}/><input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Rechercher un client, un téléphone..."/></div><div className="selection-list">{filteredClients.map((item, index) => <button key={item.id} onClick={() => setClientId(item.id)} className={`client-option ${clientId === item.id ? "selected" : ""}`}><span className={`avatar large avatar-${index % 5}`}>{initials(item.name)}</span><span className="client-option-info"><strong>{item.name}</strong><small>{item.city} <span>·</span> {item.phone}</small></span><span className="radio-dot">{clientId === item.id && <Check size={14}/>}</span></button>)}{!filteredClients.length && <div className="flow-empty"><Store size={24}/><p>Aucun client trouvé.</p><button className="text-link" onClick={() => setClientForm(true)}>Ajouter un client <Plus size={15}/></button></div>}</div></div>}
      {step === 2 && <div className="flow-section">
        <div className="flow-section-heading"><div><h3>Choisissez les produits</h3><p>Indiquez les cartons, les sachets en plus et, si besoin, le prix HT négocié.</p></div><div className="cart-count"><ShoppingBasket size={16}/>{plural(lines.length, "produit")}</div></div>
        <div className="search-box flow-search"><Search size={18}/><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Rechercher un produit..."/></div>
        <div className="filter-chips"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Tous</button>{data.categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div>
        <div className="flow-products">
          {filteredProducts.map((product) => {
            const line = lines.find((item) => item.productId === product.id);
            const cartonCents = toCents(product.defaultSachetPrice) * product.sachetsPerCarton;
            const cartonTaxCents = product.taxRateBps === null ? null : taxCentsFromHt(cartonCents, product.taxRateBps);
            return <div className={`flow-product ${line ? "in-cart" : ""}`} key={product.id}>
              <div className="flow-product-img">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <Package size={23}/>}</div>
              <div className="flow-product-info">
                <strong>{product.name}</strong><small>{product.categoryName} · {product.sku}{product.unit ? ` · Sachet ${product.unit}` : ""}</small>
                <span>{money(product.defaultSachetPrice)} <small>HT / sachet · carton HT {money(cartonCents / 100)}</small></span>
                <span className="flow-product-tax">{product.taxRateBps === null ? "TVA à définir" : `TVA ${taxRateLabel(product.taxRateBps)} · carton TTC ${money((cartonCents + (cartonTaxCents || 0)) / 100)}`}</span>
              </div>
              {line ? <button className="icon-button danger" aria-label={`Retirer ${product.name}`} onClick={() => removeLine(product.id)}><Trash2 size={17}/></button> : <button className="add-product" disabled={!product.available || product.taxRateBps === null} title={product.taxRateBps === null ? "Définissez d’abord la TVA du produit" : undefined} onClick={() => addProduct(product)}><Plus size={16}/> <span>{product.taxRateBps === null ? "TVA à définir" : "Ajouter"}</span></button>}
              {line && <PackagingPanel line={line} update={(patch) => updateLine(product.id, patch)}/>}
            </div>;
          })}
          {!filteredProducts.length && <div className="flow-empty"><Package size={24}/><p>Aucun produit trouvé.</p></div>}
        </div>
        {hasUnassignedTax && <p className="form-error">Définissez le taux de TVA du produit dans Catalogue ou Administration avant de continuer.</p>}
      </div>}
      {step === 3 && <div className="flow-section"><div className="flow-section-heading"><div><h3>Tout est bon ?</h3><p>Vérifiez les quantités et les prix avant d’enregistrer la commande.</p></div></div><div className="review-client"><span className="review-icon"><Store size={20}/></span><span><small>CLIENT</small><strong>{client?.name}</strong><em>{client?.city} · {client?.phone}</em></span><button className="text-link" onClick={() => setStep(1)}>Modifier</button></div><div className="review-title"><strong>Produits commandés <span>({lines.length})</span></strong><button className="text-link" onClick={() => setStep(2)}>Ajouter <Plus size={15}/></button></div><div className="review-lines">{lines.map((line) => <div className="review-line" key={line.productId}><div className="review-product"><div className="review-img">{line.product.imageUrl ? <img src={line.product.imageUrl} alt=""/> : <Package size={19}/>}</div><span><strong>{line.product.name}</strong><small>{packingLabel(line.cartons, line.sachets, line.perCarton)} = <b>{plural(line.totalSachets, "sachet")}</b></small><small className="review-price">{line.priceCents !== line.defaultCents && <s className="catalog-price">{money(line.defaultPrice)}</s>}<b>{money(line.sachetPrice)}</b> HT / sachet <PriceDelta defaultCents={line.defaultCents} priceCents={line.priceCents}/></small></span></div><div className="review-vat-summary"><span>HT <b>{money(line.totalCents / 100)}</b></span><span>TVA {taxRateLabel(line.taxRateBps)} <b>{money(line.taxCents / 100)}</b></span></div><strong className="line-total">TTC {money(line.totalTtcCents / 100)}</strong><div className="review-actions"><button className={`icon-button ${expanded === line.productId ? "active" : ""}`} aria-label={`Modifier ${line.product.name}`} onClick={() => setExpanded(expanded === line.productId ? null : line.productId)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`Retirer ${line.product.name}`} onClick={() => removeLine(line.productId)}><Trash2 size={15}/></button></div>{expanded === line.productId && <PackagingPanel compact line={line} update={(patch) => updateLine(line.productId, patch)}/>}</div>)}</div><div className="review-total"><span>Quantité <strong>{plural(totalSachets, "sachet")}</strong></span>{discountCents !== 0 && <span>{discountCents > 0 ? "Remise accordée" : "Majoration"} <strong>{discountCents > 0 ? "−" : "+"}{money(Math.abs(discountCents) / 100)}</strong></span>}<span>Sous-total HT <strong>{money(subtotalCents / 100)}</strong></span><span>TVA totale <strong>{money(taxCents / 100)}</strong></span><div>Total TTC <strong>{money(totalCents / 100)}</strong></div></div>{!lines.length && <p className="form-error">Ajoutez au moins un produit à la commande.</p>}{incomplete > 0 && <p className="form-error">{plural(incomplete, "produit")} sans quantité : indiquez des cartons ou des sachets.</p>}{error && <p className="form-error">{error}</p>}</div>}
    </>}</div>
    {!confirmed && <div className="flow-footer"><div>{step > 1 ? <button className="button secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={16}/> Retour</button> : <button className="button ghost" onClick={onClose}>Annuler</button>}</div><div className="flow-footer-right">{step === 2 && <span className="footer-total"><small>{incomplete > 0 ? `${plural(incomplete, "produit")} sans quantité` : `${plural(totalSachets, "sachet")} · total provisoire TTC`}</small><strong>{money(totalCents / 100)}</strong></span>}{step < 3 ? <button className="button primary" disabled={step === 1 ? !clientId : !canContinue} onClick={() => setStep(step + 1)}>Continuer <ChevronRight size={17}/></button> : <button className="button primary" disabled={saving || !canContinue} onClick={save}>{saving ? "Enregistrement..." : editing ? "Enregistrer les modifications" : "Confirmer la commande"} <ClipboardCheck size={17}/></button>}</div></div>}
    {clientForm && <ClientForm mutate={mutate} onClose={() => setClientForm(false)} onSaved={(id) => { setClientId(id); setClientForm(false); }}/>}</section></div>;
}
