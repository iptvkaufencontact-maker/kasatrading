import { boolean, index, integer, numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  contact: varchar("contact", { length: 160 }),
  phone: varchar("phone", { length: 40 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  sku: varchar("sku", { length: 80 }).notNull().unique(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  imageUrl: text("image_url"),
  /** Catalogue price of one sachet (EUR). Salespeople may negotiate a different price per order line. */
  defaultSachetPrice: numeric("default_sachet_price", { precision: 12, scale: 2 }).notNull(),
  /** VAT basis points; null keeps existing products unconfigured until an admin chooses a rate. */
  taxRateBps: integer("tax_rate_bps"),
  sachetsPerCarton: integer("sachets_per_carton").notNull().default(10),
  /** Optional sachet format shown to salespeople, e.g. "250 g". */
  unit: varchar("unit", { length: 30 }).notNull().default(""),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("products_category_idx").on(table.categoryId)]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("orders_client_idx").on(table.clientId), index("orders_created_idx").on(table.createdAt)]);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 160 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull().default(""),
  cartonQuantity: integer("carton_quantity").notNull().default(0),
  // Whole sachets, stored as numeric(12,2) to match the shared Neon schema (the app always writes integers).
  additionalSachets: numeric("additional_sachets", { precision: 12, scale: 2 }).notNull(),
  /** Historical snapshots: packaging and prices as they were when the line was saved. */
  sachetsPerCartonAtOrder: integer("sachets_per_carton").notNull().default(1),
  /** Historical VAT snapshot; null means the legacy order predates VAT tracking. */
  taxRateBps: integer("tax_rate_bps"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSachets: numeric("total_sachets", { precision: 12, scale: 2 }).notNull(),
  sachetPriceAtOrder: numeric("sachet_price_at_order", { precision: 12, scale: 2 }).notNull(),
  defaultSachetPriceAtOrder: numeric("default_sachet_price_at_order", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 30 }).notNull().default("commercial"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);
