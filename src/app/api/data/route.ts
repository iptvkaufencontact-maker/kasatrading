import { db } from "@/db";
import { categories, clients, orderItems, orders, products, sessions, users } from "@/db/schema";
import { currentUser, hashPassword, hashToken, requestTokens, sameOrigin, verifyPassword } from "@/lib/auth";
import { ensureInitialData, getAppData } from "@/lib/data";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { centsToDecimal, hasTwoDecimals, LIMITS, lineTotalCents, taxCentsFromHt, toCents, totalSachetsOf } from "@/lib/packaging";

export const dynamic = "force-dynamic";

const id = z.number().int().positive();
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const clientSchema = z.object({
  id: id.optional(), name: z.string().trim().min(2).max(160), contact: optionalText(160),
  phone: z.string().trim().min(6).max(40), city: z.string().trim().min(2).max(100),
  address: optionalText(1000), notes: optionalText(4000),
});
const categorySchema = z.object({ id: id.optional(), name: z.string().trim().min(2).max(100) });
const productSchema = z.object({
  id: id.optional(), name: z.string().trim().min(2).max(160), sku: z.string().trim().min(1).max(80),
  categoryId: id,
  defaultSachetPrice: z.number().finite().min(0).max(LIMITS.price).refine(hasTwoDecimals, "Prix invalide"),
  taxRateBps: z.union([z.literal(550), z.literal(2000)]).nullable().optional(),
  sachetsPerCarton: z.number().int().min(1).max(LIMITS.perCarton),
  unit: z.string().trim().max(30).nullish().transform((value) => value || ""),
  available: z.boolean(),
  imageUrl: z.string().max(2000000).nullish().transform((v) => v?.trim() || null)
    .refine((v) => !v || v.startsWith("/images/") || /^https:\/\//i.test(v) || /^data:image\/(png|jpeg|webp);base64,/i.test(v), "Image invalide"),
}).refine((product) => product.id !== undefined || product.taxRateBps === 550 || product.taxRateBps === 2000, "Choisissez un taux de TVA.");
const orderLineSchema = z.object({
  productId: id,
  cartons: z.number().int().min(0).max(LIMITS.cartons),
  sachets: z.number().int().min(0).max(LIMITS.sachets),
  /** Negotiated price for this line only; the catalogue price is never modified from an order. */
  sachetPrice: z.number().finite().min(0).max(LIMITS.price).refine(hasTwoDecimals, "Prix invalide"),
}).refine((line) => line.cartons > 0 || line.sachets > 0, "Quantité requise");
const orderSchema = z.object({ id: id.optional(), clientId: id, items: z.array(orderLineSchema).min(1).max(100) })
  .refine((value) => new Set(value.items.map((item) => item.productId)).size === value.items.length, "Produit en double");
const statusSchema = z.object({ id, status: z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]) });
const userSchema = z.object({
  id: id.optional(), name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().max(200).nullish().transform((value) => value || ""), role: z.enum(["admin", "commercial"]),
});
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) });
const deleteSchema = z.object({ id });

class ValidationError extends Error {}
function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError("Veuillez vérifier les champs du formulaire.");
  return result.data;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
    return Response.json(await getAppData(user));
  } catch (error) {
    console.error("Unable to load application data", error);
    return Response.json({ error: "Impossible de charger les données." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
    const user = await currentUser();
    if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Requête invalide." }, { status: 400 });
    const body = await request.json().catch(() => null);
    const entity = body?.entity;
    const action = body?.action;
    const payload = body?.payload;
    const requireAdmin = () => { if (user.role !== "admin") throw new ValidationError("Action réservée à l’administrateur."); };
    await ensureInitialData();

    if (entity === "client" && action === "save") {
      const { id: recordId, ...values } = parse(clientSchema, payload);
      if (recordId) {
        const updated = await db.update(clients).set(values).where(eq(clients.id, recordId)).returning();
        if (!updated.length) throw new ValidationError("Client introuvable.");
        return Response.json({ ok: true, id: recordId });
      }
      const [created] = await db.insert(clients).values(values).returning();
      return Response.json({ ok: true, id: created.id });
    }
    if (entity === "category" && action === "save") {
      const { id: recordId, ...values } = parse(categorySchema, payload);
      if (recordId) {
        const updated = await db.update(categories).set(values).where(eq(categories.id, recordId)).returning();
        if (!updated.length) throw new ValidationError("Catégorie introuvable.");
        return Response.json({ ok: true, id: recordId });
      }
      const [created] = await db.insert(categories).values(values).returning();
      return Response.json({ ok: true, id: created.id });
    }
    if (entity === "product" && action === "save") {
      const { id: recordId, ...input } = parse(productSchema, payload);
      const category = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId));
      if (!category.length) throw new ValidationError("Veuillez choisir une catégorie existante.");
      const { taxRateBps, ...productInput } = input;
      const values = { ...productInput, ...(taxRateBps === undefined ? {} : { taxRateBps }), defaultSachetPrice: centsToDecimal(toCents(input.defaultSachetPrice)) };
      if (recordId) {
        const updated = await db.update(products).set(values).where(eq(products.id, recordId)).returning();
        if (!updated.length) throw new ValidationError("Produit introuvable.");
        return Response.json({ ok: true, id: recordId });
      }
      const [created] = await db.insert(products).values(values).returning();
      return Response.json({ ok: true, id: created.id });
    }
    if (entity === "order" && action === "save") {
      const input = parse(orderSchema, payload);
      const client = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
      if (!client.length) throw new ValidationError("Veuillez choisir un client existant.");
      const availableProducts = await db.select().from(products).where(inArray(products.id, input.items.map((item) => item.productId)));
      if (availableProducts.length !== input.items.length) throw new ValidationError("Un produit sélectionné n'existe plus.");
      const previousItems = input.id ? await db.select().from(orderItems).where(eq(orderItems.orderId, input.id)) : [];
      if (availableProducts.some((p) => !p.available && !previousItems.some((old) => old.productId === p.id))) throw new ValidationError("Un produit sélectionné n'est plus disponible.");
      const lines = input.items.map((item) => {
        const product = availableProducts.find((p) => p.id === item.productId)!;
        // When editing, lines that already existed keep their original packaging/catalogue snapshot.
        const previous = previousItems.find((old) => old.productId === product.id);
        const perCarton = previous?.sachetsPerCartonAtOrder ?? product.sachetsPerCarton;
        const defaultPriceCents = toCents(previous?.defaultSachetPriceAtOrder ?? product.defaultSachetPrice);
        const taxRateBps = previous ? previous.taxRateBps : product.taxRateBps;
        if (taxRateBps !== 550 && taxRateBps !== 2000) throw new ValidationError(`Définissez la TVA de « ${product.name} » avant de créer la commande.`);
        const totalSachets = totalSachetsOf(item.cartons, item.sachets, perCarton);
        if (totalSachets < 1 || totalSachets > LIMITS.totalSachets) throw new ValidationError(`Quantité invalide pour « ${product.name} ».`);
        const priceCents = toCents(item.sachetPrice);
        const totalCents = lineTotalCents(totalSachets, priceCents);
        const taxCents = taxCentsFromHt(totalCents, taxRateBps);
        return {
          productId: product.id, productName: product.name, unit: previous?.unit ?? product.unit,
          cartonQuantity: item.cartons, additionalSachets: String(item.sachets), sachetsPerCartonAtOrder: perCarton, taxRateBps, taxAmount: centsToDecimal(taxCents), totalSachets: String(totalSachets),
          sachetPriceAtOrder: centsToDecimal(priceCents), defaultSachetPriceAtOrder: centsToDecimal(defaultPriceCents),
          totalPrice: centsToDecimal(totalCents), totalCents, taxCents,
        };
      });
      const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
      const taxCents = lines.reduce((sum, line) => sum + line.taxCents, 0);
      const subtotal = centsToDecimal(subtotalCents);
      const taxAmount = centsToDecimal(taxCents);
      const total = centsToDecimal(subtotalCents + taxCents);
      const result = await db.transaction(async (tx) => {
        let orderId: number;
        let orderNumber: string;
        if (input.id) {
          const [updated] = await tx.update(orders).set({ clientId: input.clientId, subtotal, taxAmount, total }).where(eq(orders.id, input.id)).returning();
          if (!updated) throw new ValidationError("Commande introuvable.");
          orderId = updated.id; orderNumber = updated.orderNumber;
          await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
        } else {
          orderNumber = `KT-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
          const [created] = await tx.insert(orders).values({ orderNumber, clientId: input.clientId, subtotal, taxAmount, total, status: "pending" }).returning();
          orderId = created.id;
        }
        await tx.insert(orderItems).values(lines.map(({ totalCents: _totalCents, taxCents: _taxCents, ...line }) => ({ ...line, orderId })));
        return { id: orderId, orderNumber };
      });
      return Response.json({ ok: true, ...result });
    }
    if (entity === "order" && action === "status") {
      const input = parse(statusSchema, payload);
      const updated = await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id)).returning();
      if (!updated.length) throw new ValidationError("Commande introuvable.");
      return Response.json({ ok: true });
    }
    if (entity === "user" && action === "save") {
      requireAdmin();
      const { id: recordId, password, ...values } = parse(userSchema, payload);
      if (password && password.length < 8) throw new ValidationError("Le mot de passe doit contenir au moins 8 caractères.");
      if (recordId) {
        if (recordId === user.id && values.role !== "admin") throw new ValidationError("Vous ne pouvez pas retirer votre propre rôle administrateur.");
        const update: Partial<typeof users.$inferInsert> = { ...values };
        if (password) { update.passwordHash = await hashPassword(password); update.mustChangePassword = recordId !== user.id; }
        const updated = await db.update(users).set(update).where(eq(users.id, recordId)).returning();
        if (!updated.length) throw new ValidationError("Utilisateur introuvable.");
        if (password && recordId !== user.id) await db.delete(sessions).where(eq(sessions.userId, recordId));
        return Response.json({ ok: true, id: recordId });
      }
      if (!password) throw new ValidationError("Un mot de passe d’au moins 8 caractères est requis.");
      const [created] = await db.insert(users).values({ ...values, passwordHash: await hashPassword(password), mustChangePassword: true }).returning();
      return Response.json({ ok: true, id: created.id });
    }
    if (entity === "account" && action === "password") {
      const input = parse(passwordSchema, payload);
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) throw new ValidationError("Le mot de passe actuel est incorrect.");
      if (input.currentPassword === input.newPassword) throw new ValidationError("Choisissez un mot de passe différent de l’actuel.");
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false }).where(eq(users.id, user.id));
      const tokens = await requestTokens();
      if (tokens.length) await db.delete(sessions).where(and(eq(sessions.userId, user.id), notInArray(sessions.tokenHash, tokens.map(hashToken))));
      return Response.json({ ok: true });
    }
    if (action === "delete") {
      const input = parse(deleteSchema, payload);
      if (entity === "client") await db.delete(clients).where(eq(clients.id, input.id));
      else if (entity === "category") await db.delete(categories).where(eq(categories.id, input.id));
      else if (entity === "product") await db.delete(products).where(eq(products.id, input.id));
      else if (entity === "order") await db.delete(orders).where(eq(orders.id, input.id));
      else if (entity === "user") {
        requireAdmin();
        if (input.id === user.id) throw new ValidationError("Vous ne pouvez pas supprimer votre propre compte.");
        const [target] = await db.select().from(users).where(eq(users.id, input.id));
        if (!target) throw new ValidationError("Utilisateur introuvable.");
        if (target.role === "admin") {
          const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
          if (admins.length <= 1) throw new ValidationError("Impossible de supprimer le dernier administrateur.");
        }
        await db.delete(users).where(eq(users.id, input.id));
      }
      else throw new ValidationError("Opération inconnue.");
      return Response.json({ ok: true });
    }
    throw new ValidationError("Opération inconnue.");
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    const text = String(error) + " " + String((error as { cause?: unknown })?.cause || "");
    if (text.includes("23505") || text.includes("duplicate key")) return Response.json({ error: "Cette valeur existe déjà (référence, nom ou e-mail)." }, { status: 400 });
    if (text.includes("23503") || text.includes("foreign key")) return Response.json({ error: "Cet élément est lié à des commandes ou des produits et ne peut pas être supprimé." }, { status: 400 });
    console.error("Data mutation failed", error);
    return Response.json({ error: "Impossible d'enregistrer les modifications. Veuillez réessayer." }, { status: 500 });
  }
}
