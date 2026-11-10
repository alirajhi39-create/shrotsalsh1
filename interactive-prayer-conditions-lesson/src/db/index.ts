import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * يُستخدم سائق Neon Serverless (HTTP) تلقائيًا عندما يشير DATABASE_URL إلى Neon،
 * وإلا يُستخدم سائق node-postgres (محليًا أو مع أي PostgreSQL قياسي).
 * واجهة الاستعلامات (Drizzle) واحدة في الحالتين.
 */
export const isNeon = /neon\.tech/i.test(databaseUrl);

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __shurutPool?: Pool;
  __shurutDb?: Database;
};

function createDatabase(): Database {
  if (isNeon) {
    const client = neon(databaseUrl as string);
    // واجهة الاستعلام متطابقة؛ نوحّد النوع لتبسيط بقية الكود.
    return drizzleNeon(client, { schema }) as unknown as Database;
  }

  const needsSsl = /sslmode=require/i.test(databaseUrl as string);
  const pool =
    globalForDb.__shurutPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__shurutPool = pool;
  }

  return drizzlePg(pool, { schema });
}

export const db: Database = globalForDb.__shurutDb ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__shurutDb = db;
}
