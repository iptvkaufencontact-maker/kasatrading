import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Schema changes must use a DIRECT (non-pooled) connection on Neon.
// `neon env pull` provides DATABASE_URL_UNPOOLED for that; fall back to DATABASE_URL
// for local Postgres, where both are the same server.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
