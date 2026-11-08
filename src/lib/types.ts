export type OrderStatus = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";

export type Client = {
  id: number; name: string; contact: string | null; phone: string; city: string;
  address: string | null; notes: string | null; createdAt: string;
};
export type Category = { id: number; name: string; createdAt: string };
export type Product = {
  id: number; name: string; sku: string; categoryId: number; categoryName: string; imageUrl: string | null;
  /** Catalogue price per sachet (EUR, "12.00"). */
  defaultSachetPrice: string;
  sachetsPerCarton: number;
  /** Optional sachet format, e.g. "250 g". */
  unit: string;
  available: boolean; createdAt: string;
};
/** Order line with historical snapshots: later catalogue changes never alter it. */
export type OrderItem = {
  id: number; orderId: number; productId: number | null; productName: string; unit: string;
  cartonQuantity: number; additionalSachets: number; sachetsPerCartonAtOrder: number; totalSachets: number;
  sachetPriceAtOrder: string; defaultSachetPriceAtOrder: string; totalPrice: string;
};
export type Order = {
  id: number; orderNumber: string; clientId: number; clientName: string; clientCity: string;
  status: OrderStatus; subtotal: string; total: string; createdAt: string; items: OrderItem[];
};
export type Role = "admin" | "commercial";
export type SessionUser = { id: number; name: string; email: string; role: Role; mustChangePassword: boolean };
export type AppUser = SessionUser & { createdAt: string };
export type AppData = { clients: Client[]; categories: Category[]; products: Product[]; orders: Order[]; users: AppUser[] };
export type CartItem = { productId: number; cartons: number; sachets: number; sachetPrice: number };

export const statusLabels: Record<OrderStatus, string> = {
  pending: "En attente", confirmed: "Confirmée", processing: "En préparation", delivered: "Livrée", cancelled: "Annulée",
};
