"use server";

import { db } from "@/db/drizzle";
import { storageItem, storagePermission, storageVisibility, member, user } from "@/db/schema";
import { eq, and, isNull, or, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { validateStorageInput, createAuditLog, StorageAuditAction, sanitizeFilename } from "@/lib/security";

export type VisibilityOption = "org" | "private" | "custom";

export type NewFolderInput = {
  organizationId: string;
  parentId?: string | null;
  name: string;
  visibility: VisibilityOption;
  userIds?: string[]; // for custom visibility
};

export type NewFileInput = {
  organizationId: string;
  parentId?: string | null;
  name: string;
  mimeType?: string;
  size?: number;
  storagePath: string;
  visibility: VisibilityOption;
  userIds?: string[]; // for custom visibility
};

async function assertOrgAccess(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const mem = await db.query.member.findFirst({
    where: and(eq(member.userId, session.user.id), eq(member.organizationId, organizationId)),
  });
  if (!mem) throw new Error("Forbidden");
}

async function assertOwnerOrAdmin(itemId: string, organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const item = await db.query.storageItem.findFirst({ where: eq(storageItem.id, itemId) });
  if (!item) throw new Error("Not found");
  if (item.ownerUserId === session.user.id) return; // owner allowed
  // else require org admin/owner
  const perm = await auth.api.hasPermission({
    headers: await headers(),
    body: { permissions: { organization: ["update"] }, organizationId },
  });
  if (!perm.success) throw new Error("Forbidden");
}

export async function getOrgMembers(organizationId: string) {
  await assertOrgAccess(organizationId);
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));
  
  return members;
}

export async function listItems(organizationId: string, parentId?: string | null, userId?: string) {
  await assertOrgAccess(organizationId);
  // Resolve user id if not provided
  let uid = userId;
  if (!uid) {
    const session = await auth.api.getSession({ headers: await headers() });
    uid = session?.user.id;
  }
  if (!uid) throw new Error("Unauthorized");

  const parentFilter = parentId ? eq(storageItem.parentId, parentId) : isNull(storageItem.parentId);
  const baseOrg = and(eq(storageItem.organizationId, organizationId), eq(storageItem.visibility, "org"));
  const basePrivate = and(eq(storageItem.organizationId, organizationId), eq(storageItem.visibility, "private"), eq(storageItem.ownerUserId, uid));
  const baseCustom = and(eq(storageItem.organizationId, organizationId), eq(storageItem.visibility, "custom"));

  const items = await db.query.storageItem.findMany({ where: and(parentFilter, or(baseOrg, basePrivate, baseCustom)) });
  const customIds = items.filter(i => i.visibility === "custom").map(i => i.id);
  if (customIds.length === 0) return items;
  const perms = await db.query.storagePermission.findMany({ where: and(inArray(storagePermission.itemId, customIds), eq(storagePermission.userId, uid)) });
  const allowed = new Set(perms.map(p => p.itemId));
  return items.filter(i => i.visibility !== "custom" || allowed.has(i.id));
}

export async function createFolder(input: NewFolderInput, ownerUserId: string) {
  await assertOrgAccess(input.organizationId);
  
  // Validate input
  const validation = validateStorageInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
  }
  
  // Sanitize folder name
  const sanitizedName = sanitizeFilename(input.name);
  
  const id = randomUUID();
  await db.insert(storageItem).values({
    id,
    organizationId: input.organizationId,
    parentId: input.parentId ?? null,
    name: sanitizedName,
    type: "folder",
    ownerUserId,
    visibility: input.visibility,
  });
  
  if (input.visibility === "custom" && input.userIds?.length) {
    await db.insert(storagePermission).values(
      input.userIds.map(uid => ({ 
        id: randomUUID(), 
        itemId: id, 
        userId: uid 
      }))
    );
  }
  
  // Create audit log
  createAuditLog(StorageAuditAction.FOLDER_CREATE, ownerUserId, input.organizationId, id, {
    name: sanitizedName,
    visibility: input.visibility,
    userIds: input.userIds
  });
  
  return { id };
}

export async function createFile(input: NewFileInput, ownerUserId: string) {
  await assertOrgAccess(input.organizationId);
  
  // Validate input
  const validation = validateStorageInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
  }
  
  // Sanitize filename
  const sanitizedName = sanitizeFilename(input.name);
  
  const id = randomUUID();
  await db.insert(storageItem).values({
    id,
    organizationId: input.organizationId,
    parentId: input.parentId ?? null,
    name: sanitizedName,
    type: "file",
    ownerUserId,
    mimeType: input.mimeType,
    size: input.size,
    storagePath: input.storagePath,
    visibility: input.visibility,
  });
  
  if (input.visibility === "custom" && input.userIds?.length) {
    await db.insert(storagePermission).values(
      input.userIds.map(uid => ({ 
        id: randomUUID(), 
        itemId: id, 
        userId: uid 
      }))
    );
  }
  
  return { id };
}

export async function updateVisibility(itemId: string, visibility: VisibilityOption, userIds: string[] | undefined, organizationId: string) {
  await assertOwnerOrAdmin(itemId, organizationId);
  
  // Validate input
  const validation = validateStorageInput({ 
    organizationId, 
    visibility,
    itemId 
  });
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
  }
  
  // Get current user for audit log
  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user.id;
  
  await db.update(storageItem).set({ visibility }).where(eq(storageItem.id, itemId));
  await db.delete(storagePermission).where(eq(storagePermission.itemId, itemId));
  
  if (visibility === "custom" && userIds?.length) {
    await db.insert(storagePermission).values(
      userIds.map(uid => ({ 
        id: randomUUID(), 
        itemId, 
        userId: uid 
      }))
    );
  }
  
  // Create audit log
  if (currentUserId) {
    createAuditLog(StorageAuditAction.PERMISSION_CHANGE, currentUserId, organizationId, itemId, {
      newVisibility: visibility,
      userIds: userIds
    });
  }
  
  return { success: true } as const;
}

export async function renameItem(itemId: string, name: string, organizationId: string) {
  await assertOwnerOrAdmin(itemId, organizationId);
  
  // Validate and sanitize name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid name provided');
  }
  
  const sanitizedName = sanitizeFilename(name);
  
  // Get current user for audit log
  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user.id;
  
  await db.update(storageItem).set({ name: sanitizedName }).where(eq(storageItem.id, itemId));
  
  // Create audit log
  if (currentUserId) {
    createAuditLog(StorageAuditAction.FILE_RENAME, currentUserId, organizationId, itemId, {
      oldName: name,
      newName: sanitizedName
    });
  }
  
  return { success: true } as const;
}

export async function deleteItem(itemId: string, organizationId: string) {
  await assertOwnerOrAdmin(itemId, organizationId);
  
  // Get current user and item info for audit log
  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user.id;
  
  // Get item info before deletion
  const item = await db.query.storageItem.findFirst({ 
    where: eq(storageItem.id, itemId) 
  });
  
  if (!item) {
    throw new Error('Item not found');
  }
  
  // Delete item and associated permissions
  await db.delete(storagePermission).where(eq(storagePermission.itemId, itemId));
  await db.delete(storageItem).where(eq(storageItem.id, itemId));
  
  // Create audit log
  if (currentUserId) {
    createAuditLog(
      item.type === 'folder' ? StorageAuditAction.FOLDER_DELETE : StorageAuditAction.FILE_DELETE, 
      currentUserId, 
      organizationId, 
      itemId, 
      {
        itemName: item.name,
        itemType: item.type,
        storagePath: item.storagePath
      }
    );
  }
  
  return { success: true } as const;
}
