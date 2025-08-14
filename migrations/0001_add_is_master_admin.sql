ALTER TABLE "drizzle"."user" ADD COLUMN IF NOT EXISTS "is_master_admin" boolean DEFAULT false NOT NULL;
