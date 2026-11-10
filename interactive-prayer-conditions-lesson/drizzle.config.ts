import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * للهجرات على Neon استخدم رابط الاتصال غير المجمّع (DATABASE_URL_UNPOOLED) إن توفر.
 * محليًا يُستخدم DATABASE_URL من ملف .env
 */
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: false,
  verbose: true,
});
