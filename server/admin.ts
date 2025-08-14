"use server";

import { db } from "@/db/drizzle";
import { member, organization, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isMasterAdmin } from "./users";
import { getAllowSignups, setAllowSignups } from "@/lib/config";

export async function createUserAdmin(input: { name: string; email: string }) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    const name = (input.name || "").trim();
    const email = (input.email || "").trim().toLowerCase();
    if (!name) return { success: false as const, error: "Name is required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false as const, error: "Invalid email" };
    const u = await db.insert(user).values({
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return { success: true as const, user: u[0] };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function deleteUserAdmin(userId: string) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    await db.delete(user).where(eq(user.id, userId));
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function createOrganizationAdmin(input: { name: string; slug: string }) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    const name = (input.name || "").trim();
    const slug = (input.slug || "").trim().toLowerCase();
    if (!name) return { success: false as const, error: "Name is required" };
    if (!/^[a-z0-9-]{3,}$/.test(slug)) return { success: false as const, error: "Invalid slug" };
    const org = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name,
      slug,
      createdAt: new Date(),
      metadata: null as unknown as string | null,
    }).returning();
    return { success: true as const, organization: org[0] };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function deleteOrganizationAdmin(orgId: string) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    await db.delete(organization).where(eq(organization.id, orgId));
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function addUserToOrgAdmin(input: { userId: string; orgId: string; role: "member" | "admin" | "owner" }) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    // Ensure user and organization exist
    const [u, o] = await Promise.all([
      db.query.user.findFirst({ where: eq(user.id, input.userId) }),
      db.query.organization.findFirst({ where: eq(organization.id, input.orgId) }),
    ]);
    if (!u) return { success: false as const, error: "User not found" };
    if (!o) return { success: false as const, error: "Organization not found" };
    // Prevent duplicate membership
    const existing = await db.query.member.findFirst({ where: and(eq(member.userId, input.userId), eq(member.organizationId, input.orgId)) });
    if (existing) return { success: false as const, error: "User is already a member" };
    await db.insert(member).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      organizationId: input.orgId,
      role: input.role,
      createdAt: new Date(),
    });
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function removeUserFromOrgAdmin(input: { userId: string; orgId: string }) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    await db.delete(member).where(and(eq(member.userId, input.userId), eq(member.organizationId, input.orgId)));
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function setMemberRoleAdmin(input: { userId: string; orgId: string; role: "member" | "admin" | "owner" }) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  try {
    await db.update(member).set({ role: input.role }).where(and(eq(member.userId, input.userId), eq(member.organizationId, input.orgId)));
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function getAllowSignupsAdmin() {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden", allow: undefined as unknown as boolean };
  const allow = await getAllowSignups();
  return { success: true as const, allow };
}

export async function setAllowSignupsAdmin(allow: boolean) {
  if (!(await isMasterAdmin())) return { success: false as const, error: "Forbidden" };
  await setAllowSignups(allow);
  return { success: true as const };
}
