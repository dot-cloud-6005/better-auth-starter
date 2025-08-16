-- Storage tables for SharePoint-like feature
CREATE TYPE "drizzle"."storage_visibility" AS ENUM ('org','private','custom');

CREATE TABLE IF NOT EXISTS "drizzle"."storage_item" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "drizzle"."organization"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "drizzle"."storage_item"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "drizzle"."user"("id") ON DELETE CASCADE,
  "mime_type" text,
  "size" integer,
  "storage_path" text,
  "visibility" "drizzle"."storage_visibility" NOT NULL DEFAULT 'org',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "drizzle"."storage_permission" (
  "id" text PRIMARY KEY,
  "item_id" text NOT NULL REFERENCES "drizzle"."storage_item"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "drizzle"."user"("id") ON DELETE CASCADE
);
