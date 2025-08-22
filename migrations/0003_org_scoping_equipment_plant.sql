-- 0003_org_scoping_equipment_plant.sql
-- Purpose: Introduce per-organization scoping for equipment and plant data.
-- Notes:
-- - We add organization_id columns as TEXT and index them.
-- - We DO NOT add a foreign key to drizzle.organization because auth/org tables live in a separate DB/schema.
-- - We stage unique constraints so existing global unique(auto_id) keeps working until backfill is complete.

BEGIN;

-- 1) equipment.equipment: add organization_id (nullable for staged rollout)
ALTER TABLE equipment.equipment
  ADD COLUMN IF NOT EXISTS organization_id text;

-- index for filtering
CREATE INDEX IF NOT EXISTS idx_equipment_org
  ON equipment.equipment (organization_id);

-- staged unique: allow (organization_id, auto_id) to be unique when org is set,
-- while keeping the existing global unique(auto_id) in place for org_id IS NULL rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'equipment'
      AND indexname = 'equipment_org_auto_id_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX equipment_org_auto_id_unique
             ON equipment.equipment (organization_id, auto_id)
             WHERE organization_id IS NOT NULL';
  END IF;
END $$;

-- 2) equipment.plant: add organization_id (nullable)
ALTER TABLE equipment.plant
  ADD COLUMN IF NOT EXISTS organization_id text;

-- index for filtering
CREATE INDEX IF NOT EXISTS idx_plant_org
  ON equipment.plant (organization_id);

-- staged unique for plant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'equipment'
      AND indexname = 'plant_org_auto_id_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX plant_org_auto_id_unique
             ON equipment.plant (organization_id, auto_id)
             WHERE organization_id IS NOT NULL';
  END IF;
END $$;

COMMIT;

-- Follow-up (post-backfill) steps to be run later, once every row has organization_id set:
--  A) Drop global unique constraints and replace with NOT NULL + full unique on (organization_id, auto_id)
--     ALTER TABLE equipment.equipment DROP CONSTRAINT IF EXISTS equipment_auto_id_key;
--     ALTER TABLE equipment.equipment ALTER COLUMN organization_id SET NOT NULL;
--     -- Optional: enforce via table-level unique (the partial index above already protects non-null rows)
--     -- CREATE UNIQUE INDEX CONCURRENTLY equipment_org_auto_id_unique_all ON equipment.equipment (organization_id, auto_id);
--
--     ALTER TABLE equipment.plant DROP CONSTRAINT IF EXISTS plant_auto_id_key;
--     ALTER TABLE equipment.plant ALTER COLUMN organization_id SET NOT NULL;
--     -- CREATE UNIQUE INDEX CONCURRENTLY plant_org_auto_id_unique_all ON equipment.plant (organization_id, auto_id);
--
-- Keep the staged partial unique indexes until after the full switch is complete.
