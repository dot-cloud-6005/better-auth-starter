import { relations } from "drizzle-orm";
import { boolean, pgSchema, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { integer, doublePrecision, numeric } from "drizzle-orm/pg-core";

// Use a dedicated Postgres schema named "drizzle" instead of public
export const appSchema = pgSchema("drizzle");

export const user = appSchema.table("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
    isMasterAdmin: boolean('is_master_admin').$defaultFn(() => false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
});

export const session = appSchema.table("session", {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id')
});

export const account = appSchema.table("account", {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
});

export const verification = appSchema.table("verification", {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date())
});

export const organization = appSchema.table("organization", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique(),
    logo: text('logo'),
    createdAt: timestamp('created_at').notNull(),
    metadata: text('metadata')
});

export const organizationRelations = relations(organization, ({ many }) => ({
    members: many(member)
}));

export type Organization = typeof organization.$inferSelect;

export const role = appSchema.enum("role", ["member", "admin", "owner"]);

export type Role = (typeof role.enumValues)[number];

export const member = appSchema.table("member", {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    role: role('role').default("member").notNull(),
    createdAt: timestamp('created_at').notNull()
});

export const memberRelations = relations(member, ({ one }) => ({
    organization: one(organization, {
        fields: [member.organizationId],
        references: [organization.id]
    }),
    user: one(user, {
        fields: [member.userId],
        references: [user.id]
    })
}));

export type Member = typeof member.$inferSelect & {
    user: typeof user.$inferSelect;
};

export type User = typeof user.$inferSelect;

export const invitation = appSchema.table("invitation", {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default("pending").notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

// Add navigation schema + assets table
export const navigation = pgSchema("navigation");

export const navigationAssets = navigation.table("assets", {
  Asset_Number: integer("Asset_Number").notNull(),
  Location_Code: text("Location_Code").notNull(),
  NavAid_Name: text("NavAid_Name").notNull(),
  NavAid_Primary_Function: text("NavAid_Primary_Function").notNull(),
  STATUS: text("STATUS"),
  Latitude: doublePrecision("Latitude").notNull(),
  Longitude: doublePrecision("Longitude").notNull(),
  NavAid_Colour: text("NavAid_Colour"),
    Northing: numeric("Northing"),
    Easting: numeric("Easting"),
    UTM_Zone: integer("UTM_Zone"),
    Chart_Character: text("Chart_Character"),
    Flash_Sequence: text("Flash_Sequence"),
    Light_Range: text("Light_Range"),
    Light_Colour: text("Light_Colour"),
    Light_Model: text("Light_Model"),
    Lead_Bearing: text("Lead_Bearing"),
    Daymark: text("Daymark"),
    Mark_Structure: text("Mark_Structure"),
    Situation: text("Situation"),
    Risk_Category: integer("Risk_Category"),
    Infrastructure_Subgroup_Code: text("Infrastructure_Subgroup_Code"),
    Function_Code: text("Function_Code"),
    Horizontal_Accuracy: text("Horizontal_Accuracy"),
    Responsible_Agency: text("Responsible_Agency"),
    OWNER: text("OWNER"),
    NavAid_Shape: text("NavAid_Shape"),
    AIS_Type: text("AIS_Type"),
    MMSI_Number: text("MMSI_Number"),
});

export type NavigationAsset = typeof navigationAssets.$inferSelect;

// Storage schema: folders/files with simple ACLs
export const storageVisibility = appSchema.enum("storage_visibility", [
    "org",
    "private",
    "custom",
]);

export const storageItem = appSchema.table("storage_item", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    // Note: self-referential FK exists in the DB migration; omit here to avoid circular type inference
    parentId: text("parent_id"),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'folder' | 'file'
    ownerUserId: text("owner_user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    mimeType: text("mime_type"),
    size: integer("size"),
    storagePath: text("storage_path"),
    visibility: storageVisibility("visibility").default("org").notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
});

export const storagePermission = appSchema.table("storage_permission", {
    id: text("id").primaryKey(),
    itemId: text("item_id")
        .notNull()
        .references(() => storageItem.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const schema = {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
  organizationRelations,
  memberRelations,
  navigationAssets,
  navigation,
    storageVisibility,
    storageItem,
    storagePermission,
};
export type AppSchema = typeof schema;
