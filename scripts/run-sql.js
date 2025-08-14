/*
  Usage:
    node scripts/run-sql.js migrations/0000_xxx.sql

  Requires env DATABASE_URL.
*/
const { readFileSync } = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const { Client } = require('pg');

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Missing SQL file path argument');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), fileArg);
  let sqlText = readFileSync(filePath, 'utf8');
  // Make schema creation idempotent
  sqlText = sqlText.replace(/CREATE SCHEMA\s+"drizzle";/g, 'CREATE SCHEMA IF NOT EXISTS "drizzle";');
  // Make enum type creation idempotent using a DO block
  sqlText = sqlText.replace(
    /CREATE TYPE\s+"drizzle"\."role"\s+AS\s+ENUM\(([^)]+)\);/g,
    (_, enumValues) => `DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='role' AND n.nspname='drizzle') THEN\n    CREATE TYPE "drizzle"."role" AS ENUM(${enumValues});\n  END IF;\nEND $$;`
  );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Applying SQL from ${filePath} ...`);
  await client.query(sqlText);
  await client.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
