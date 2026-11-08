import { db } from "@/db";
import { appSettings, categories, clients, orderItems, orders, products, users } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import type { AppData, AppUser, OrderStatus, Role, SessionUser, TaxRateBps } from "@/lib/types";

/** Seed a starter catalogue on an empty installation (claimed atomically, runs once). */
export async function ensureInitialData() {
  await db.transaction(async (tx) => {
    const claim = await tx.insert(appSettings).values({ key: "initial_data_v1", value: "done" }).onConflictDoNothing().returning();
    if (!claim.length) return;
    const existingProducts = await tx.select({ id: products.id }).from(products).limit(1);
    const existingCategories = await tx.select({ id: categories.id }).from(categories).limit(1);
    if (existingProducts.length || existingCategories.length || process.env.KASA_SEED_DEMO === "false") return;

    const cats = await tx.insert(categories).values([
      { name: "Fruits à coque" }, { name: "Fruits secs" }, { name: "Graines & autres" },
    ]).returning();
    const cat = (name: string) => cats.find((item) => item.name === name)!.id;
    await tx.insert(products).values([
      { name: "Amandes décortiquées", sku: "AMD-001", categoryId: cat("Fruits à coque"), defaultSachetPrice: "32.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/almonds.jpg" },
      { name: "Noix de cajou", sku: "NCJ-002", categoryId: cat("Fruits à coque"), defaultSachetPrice: "38.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/cashews.jpg" },
      { name: "Dattes Medjool", sku: "DAT-003", categoryId: cat("Fruits secs"), defaultSachetPrice: "45.00", sachetsPerCarton: 8, unit: "500 g", imageUrl: "/images/dates.jpg" },
      { name: "Pistaches grillées", sku: "PST-004", categoryId: cat("Fruits à coque"), defaultSachetPrice: "42.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/pistachios.jpg" },
      { name: "Abricots secs", sku: "ABR-005", categoryId: cat("Fruits secs"), defaultSachetPrice: "24.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/apricots.jpg" },
      { name: "Noix décortiquées", sku: "NOI-006", categoryId: cat("Fruits à coque"), defaultSachetPrice: "39.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/walnuts.jpg" },
      { name: "Raisins secs", sku: "RAI-007", categoryId: cat("Fruits secs"), defaultSachetPrice: "15.00", sachetsPerCarton: 20, unit: "250 g", imageUrl: "/images/raisins.jpg" },
      { name: "Figues séchées", sku: "FIG-008", categoryId: cat("Fruits secs"), defaultSachetPrice: "23.00", sachetsPerCarton: 12, unit: "250 g", imageUrl: "/images/figs.jpg" },
    ]);
  });
}

export async function getAppData(user: SessionUser): Promise<AppData> {
  await ensureInitialData();
  const [clientRows, categoryRows, productRows, orderRows, itemRows] = await Promise.all([
    db.select().from(clients).orderBy(asc(clients.name)),
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select({ product: products, categoryName: categories.name }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).orderBy(asc(products.id)),
    db.select({ order: orders, clientName: clients.name, clientCity: clients.city }).from(orders).innerJoin(clients, eq(orders.clientId, clients.id)).orderBy(desc(orders.createdAt)),
    db.select().from(orderItems).orderBy(asc(orderItems.id)),
  ]);
  let userRows: AppUser[] = [];
  if (user.role === "admin") {
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt }).from(users).orderBy(asc(users.name));
    userRows = rows.map((row) => ({ ...row, role: row.role as Role, createdAt: row.createdAt.toISOString() }));
  }
  return {
    clients: clientRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    categories: categoryRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    products: productRows.map(({ product, categoryName }) => ({ ...product, categoryName, taxRateBps: product.taxRateBps as TaxRateBps | null, createdAt: product.createdAt.toISOString() })),
    orders: orderRows.map(({ order, clientName, clientCity }) => ({
      ...order, status: order.status as OrderStatus, clientName, clientCity, createdAt: order.createdAt.toISOString(),
      items: itemRows.filter((item) => item.orderId === order.id).map((item) => ({ ...item, taxRateBps: item.taxRateBps as TaxRateBps | null, additionalSachets: Number(item.additionalSachets), totalSachets: Number(item.totalSachets) })),
    })),
    users: userRows,
  };
}
