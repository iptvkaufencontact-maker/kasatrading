"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, Check, ImagePlus, KeyRound, Plus, Trash2, X } from "lucide-react";
import type { AppUser, Category, Client, OrderStatus, Product } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { priceDeltaPercent, TAX_RATE_OPTIONS, taxCentsFromHt, taxRateLabel, toCents } from "@/lib/packaging";

export type Mutate = (entity: string, action: string, payload: unknown) => Promise<{ id?: number; orderNumber?: string }>;
export const CURRENCY = "€";
export function money(value: number | string, decimals = 2) {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value) || 0)} ${CURRENCY}`;
}
export function shortDate(value: string | Date, withYear = true) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" as const } : {}) }).format(new Date(value)).replace(".", "");
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status status-${status}`}><span />{statusLabels[status] || status}</span>;
}
export function Modal({ title, subtitle, children, onClose, size = "normal" }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; size?: "normal" | "wide" }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button close-button" aria-label="Fermer" onClick={onClose}><X size={20}/></button></div>{children}</section></div>;
}
export function ConfirmDialog({ title = "Confirmer la suppression", message, confirmLabel = "Supprimer", cancelLabel = "Annuler", onConfirm, onCancel }: { title?: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);
  return <div className="modal-backdrop confirm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="confirm-card" role="alertdialog" aria-modal="true" aria-label={title}><span className="confirm-icon"><Trash2 size={28}/></span><h3>{title}</h3><p>{message}</p><div className="confirm-actions"><button type="button" className="button secondary" onClick={onCancel} autoFocus>{cancelLabel}</button><button type="button" className="button danger" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}
/** Opens a centered, styled confirmation dialog and resolves to the user's choice. */
export function useConfirm() {
  const [request, setRequest] = useState<null | { title: string; message: ReactNode; confirmLabel: string; resolve: (value: boolean) => void }>(null);
  const confirm = (options: { title?: string; message: ReactNode; confirmLabel?: string }) => new Promise<boolean>((resolve) => setRequest({ title: options.title || "Confirmer la suppression", message: options.message, confirmLabel: options.confirmLabel || "Supprimer", resolve }));
  const dialog = request ? <ConfirmDialog title={request.title} message={request.message} confirmLabel={request.confirmLabel} onCancel={() => { request.resolve(false); setRequest(null); }} onConfirm={() => { request.resolve(true); setRequest(null); }}/> : null;
  return { confirm, dialog };
}
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p>{action}</div>;
}

export function ClientForm({ client, onClose, onSaved, mutate }: { client?: Client | null; onClose: () => void; onSaved?: (id: number) => void; mutate: Mutate }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await mutate("client", "save", { ...(client ? { id: client.id } : {}), name: form.get("name"), contact: form.get("contact"), phone: form.get("phone"), city: form.get("city"), address: form.get("address"), notes: form.get("notes") });
      if (result.id && onSaved) onSaved(result.id); else onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); } finally { setSaving(false); }
  }
  return <Modal title={client ? "Modifier le client" : "Nouveau client"} subtitle="Les informations essentielles de votre client." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="span-two">Nom du client / magasin <b>*</b><input name="name" required minLength={2} maxLength={160} defaultValue={client?.name} placeholder="Ex. Épicerie Al Baraka" /></label><label>Personne à contacter<input name="contact" maxLength={160} defaultValue={client?.contact || ""} placeholder="Nom et prénom" /></label><label>Téléphone <b>*</b><input name="phone" type="tel" required minLength={6} maxLength={40} defaultValue={client?.phone} placeholder="06 00 00 00 00" /></label><label className="span-two">Ville <b>*</b><input name="city" required minLength={2} maxLength={100} defaultValue={client?.city} placeholder="Ex. Casablanca" /></label><label className="span-two">Adresse <span className="optional">(facultatif)</span><input name="address" maxLength={1000} defaultValue={client?.address || ""} placeholder="Adresse du magasin" /></label><label className="span-two">Notes <span className="optional">(facultatif)</span><textarea name="notes" maxLength={4000} defaultValue={client?.notes || ""} rows={3} placeholder="Informations utiles..." /></label></div>{error && <p className="form-error"><AlertCircle size={15}/>{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving}>{saving ? "Enregistrement..." : client ? "Enregistrer" : "Ajouter le client"}<Check size={17}/></button></div></form></Modal>;
}

const percentFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** Shows the discount or markup between the catalogue price and a negotiated price (both in cents). */
export function PriceDelta({ defaultCents, priceCents }: { defaultCents: number; priceCents: number }) {
  const diff = defaultCents - priceCents;
  if (!diff || defaultCents <= 0) return null;
  const percent = percentFormat.format(Math.abs(priceDeltaPercent(defaultCents, priceCents)));
  return diff > 0 ? <span className="badge-discount">Remise −{money(diff / 100)} ({percent} %)</span> : <span className="badge-markup">Majoration +{money(-diff / 100)} ({percent} %)</span>;
}

export function ProductForm({ product, categories, onClose, mutate }: { product?: Product | null; categories: Category[]; onClose: () => void; mutate: Mutate }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [price, setPrice] = useState(product ? Number(product.defaultSachetPrice).toFixed(2) : "");
  const [taxRateBps, setTaxRateBps] = useState(product?.taxRateBps == null ? "" : String(product.taxRateBps));
  const [perCarton, setPerCarton] = useState(String(product?.sachetsPerCarton || 10));
  const priceValue = Number(price.replace(",", ".")); const perCartonValue = parseInt(perCarton, 10);
  const cartonCents = Number.isFinite(priceValue) && priceValue >= 0 && Number.isFinite(perCartonValue) && perCartonValue > 0 ? toCents(priceValue) * perCartonValue : null;
  const rateBps = taxRateBps === "" ? null : Number(taxRateBps);
  const cartonTaxCents = cartonCents !== null && rateBps !== null ? taxCentsFromHt(cartonCents, rateBps) : null;
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1400000) { setError("Choisissez une image JPG, PNG ou WebP de moins de 1,4 Mo."); return; }
    const reader = new FileReader(); reader.onload = () => { setImageUrl(String(reader.result)); setError(""); }; reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      await mutate("product", "save", { ...(product ? { id: product.id } : {}), name: form.get("name"), sku: form.get("sku"), categoryId: Number(form.get("categoryId")), defaultSachetPrice: Math.round(priceValue * 100) / 100, taxRateBps: Number(form.get("taxRateBps")), sachetsPerCarton: perCartonValue, unit: form.get("unit"), imageUrl, available: form.get("available") === "on" }); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); } finally { setSaving(false); }
  }
  return <Modal title={product ? "Modifier le produit" : "Nouveau produit"} subtitle="Prix HT, taux de TVA et conditionnement par colis." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="span-two">Nom du produit <b>*</b><input name="name" required minLength={2} maxLength={160} defaultValue={product?.name} placeholder="Ex. Amandes décortiquées" /></label><label>Référence (SKU) <b>*</b><input name="sku" required maxLength={80} defaultValue={product?.sku} placeholder="Ex. AMD-001" /></label><label>Catégorie <b>*</b><select name="categoryId" required defaultValue={product?.categoryId || ""}><option value="" disabled>Choisir une catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Prix HT par sachet (€) <b>*</b><input name="defaultSachetPrice" type="number" required min="0" max="1000000" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. 12,00" /></label><label>Taux de TVA <b>*</b><select name="taxRateBps" required value={taxRateBps} onChange={(event) => setTaxRateBps(event.target.value)}><option value="" disabled>Choisir un taux</option>{TAX_RATE_OPTIONS.map((rate) => <option key={rate.basisPoints} value={rate.basisPoints}>{rate.label}</option>)}</select></label><label>Sachets par colis <b>*</b><input name="sachetsPerCarton" type="number" required min="1" max="10000" step="1" inputMode="numeric" value={perCarton} onChange={(e) => setPerCarton(e.target.value)} placeholder="Ex. 10" /></label><div className="carton-callout span-two"><span>Prix du colis HT</span><strong>{cartonCents === null ? "—" : money(cartonCents / 100)}</strong><small>{cartonCents === null ? "Indiquez le prix HT et le nombre de sachets." : rateBps === null ? `${perCartonValue} sachets · choisissez un taux de TVA.` : `${perCartonValue} sachets · TVA ${taxRateLabel(rateBps)} : ${money((cartonTaxCents || 0) / 100)} · TTC : ${money((cartonCents + (cartonTaxCents || 0)) / 100)}`}</small></div><label className="span-two">Format du sachet <span className="optional">(facultatif)</span><input name="unit" maxLength={30} defaultValue={product?.unit || ""} placeholder="Ex. 250 g" /></label><label className="span-two">Image du produit <span className="optional">(URL ou fichier)</span><div className="upload-row"><input value={imageUrl.startsWith("data:") ? "Image sélectionnée" : imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /><label className="upload-button" title="Choisir une image"><ImagePlus size={19}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label>{imageUrl && <img className="upload-preview" src={imageUrl} alt="Aperçu" />}</div></label><label className="checkbox-row span-two"><input type="checkbox" name="available" defaultChecked={product?.available ?? true}/><span>Disponible à la vente</span></label></div>{!categories.length && <p className="form-error">Créez d’abord une catégorie dans l’administration.</p>}{error && <p className="form-error"><AlertCircle size={15}/>{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving || !categories.length}>{saving ? "Enregistrement..." : "Enregistrer le produit"}<Check size={17}/></button></div></form></Modal>;
}

export function CategoryForm({ category, onClose, mutate }: { category?: Category | null; onClose: () => void; mutate: Mutate }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await mutate("category", "save", { ...(category ? { id: category.id } : {}), name: form.get("name") }); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); } finally { setSaving(false); } }
  return <Modal title={category ? "Modifier la catégorie" : "Nouvelle catégorie"} onClose={onClose}><form className="modal-form form-stack" onSubmit={submit}><label>Nom de la catégorie <b>*</b><input name="name" required minLength={2} maxLength={100} defaultValue={category?.name} placeholder="Ex. Fruits secs" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving}><Plus size={17}/> Enregistrer</button></div></form></Modal>;
}

export function UserForm({ account, onClose, mutate }: { account?: AppUser | null; onClose: () => void; mutate: Mutate }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { await mutate("user", "save", { ...(account ? { id: account.id } : {}), name: form.get("name"), email: form.get("email"), password: form.get("password"), role: form.get("role") }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); } finally { setSaving(false); }
  }
  return <Modal title={account ? "Modifier l’utilisateur" : "Nouvel utilisateur"} subtitle="Compte autorisé à se connecter à l’application." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="span-two">Nom complet <b>*</b><input name="name" required minLength={2} maxLength={120} defaultValue={account?.name} placeholder="Ex. Yassine Commercial" /></label><label className="span-two">Adresse e-mail <b>*</b><input name="email" type="email" required maxLength={160} defaultValue={account?.email} placeholder="prenom@kasatrading.ma" /></label><label>Rôle <b>*</b><select name="role" defaultValue={account?.role || "commercial"}><option value="commercial">Commercial</option><option value="admin">Administrateur</option></select></label><label>{account ? "Nouveau mot de passe" : "Mot de passe"} {account ? <span className="optional">(vide = inchangé)</span> : <b>*</b>}<input name="password" type="password" required={!account} minLength={8} maxLength={200} autoComplete="new-password" placeholder="8 caractères minimum" /></label></div>{error && <p className="form-error"><AlertCircle size={15}/>{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}<Check size={17}/></button></div></form></Modal>;
}

export function PasswordForm({ mutate }: { mutate: Mutate }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const next = String(form.get("newPassword") || "");
    if (next.length < 8) { setError("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (next !== form.get("confirmPassword")) { setError("La confirmation ne correspond pas au nouveau mot de passe."); return; }
    setSaving(true); setError(""); setDone(false);
    try { await mutate("account", "password", { currentPassword: form.get("currentPassword"), newPassword: next }); formElement.reset(); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); } finally { setSaving(false); }
  }
  return <form className="form-stack" onSubmit={submit}><label>Mot de passe actuel<input name="currentPassword" type="password" required maxLength={200} autoComplete="current-password" /></label><label>Nouveau mot de passe<input name="newPassword" type="password" required minLength={8} maxLength={200} autoComplete="new-password" placeholder="8 caractères minimum" /></label><label>Confirmer le nouveau mot de passe<input name="confirmPassword" type="password" required minLength={8} maxLength={200} autoComplete="new-password" /></label>{error && <p className="form-error"><AlertCircle size={15}/>{error}</p>}{done && <p className="form-success"><Check size={15}/> Mot de passe modifié avec succès.</p>}<button className="button primary" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}<KeyRound size={16}/></button></form>;
}
