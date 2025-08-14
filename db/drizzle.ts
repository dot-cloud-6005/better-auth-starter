import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types as pgTypes } from 'pg';
import { schema } from './schema';

config({ path: ".env" }); // or .env.local

// Avoid parsing timestamptz (OID 1184) to Date; keep as string
pgTypes.setTypeParser(1184, (val) => val);
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
