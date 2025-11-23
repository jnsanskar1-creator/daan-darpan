import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client, { schema });

// Export query function for raw SQL queries (replaces pool.query)
export const query = async (sql: string, params: any[] = []) => {
  const result = await client.unsafe(sql, params);
  return { rows: result };
};
