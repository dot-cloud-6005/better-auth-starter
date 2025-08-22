"use server";

import { db } from "@/db/drizzle";
import { invitation, member, organization, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "./users";
import { cacheGet, cacheSet } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { render } from "@react-email/render";
import OrganizationInvitationEmail from "@/components/emails/organization-invitation";
import { sendGraphMail } from "@/lib/msgraph";
import { rateLimitTake } from "@/lib/rate-limit";
import { getCurrentUserForLogging, logSystemActivity } from "@/lib/equipment/actions/system-logs";

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser();
    const cacheKey = `user:${currentUser.id}:orgs`;
    const cached = await cacheGet<typeof organization.$inferSelect[]>(cacheKey);
    if (cached) return cached;

    const membersRes = await db.query.member.findMany({
        where: eq(member.userId, currentUser.id),
    });

    const organizationsRes = await db.query.organization.findMany({
        where: inArray(organization.id, membersRes.map((m) => m.organizationId)),
    });

    // Cache for 60 seconds
    await cacheSet(cacheKey, organizationsRes, 60);
    return organizationsRes;
}

export async function getActiveOrganization(userId: string) {
    const cacheKey = `user:${userId}:active-org`;
    const cached = await cacheGet<typeof organization.$inferSelect | null>(cacheKey);
    if (cached) return cached;

    const memberUser = await db.query.member.findFirst({
        where: eq(member.userId, userId),
    });

    if (!memberUser) {
        return null;
    }

    const activeOrganization = await db.query.organization.findFirst({
        where: eq(organization.id, memberUser.organizationId),
    });
    await cacheSet(cacheKey, activeOrganization, 60);
    return activeOrganization;
}

export async function getOrganizationBySlug(slug: string) {
    type MemberWithUser = typeof member.$inferSelect & { user: typeof user.$inferSelect };
    type OrgWithMembers = typeof organization.$inferSelect & { members: MemberWithUser[] };
    try {
    const cacheKey = `org:slug:${slug}`;
    const cached = await cacheGet<OrgWithMembers | null>(cacheKey);
    if (cached) return cached;

    const organizationBySlug = await db.query.organization.findFirst({
            where: eq(organization.slug, slug),
            with: {
                members: {
                    with: {
                        user: true,
                    },
                },
            },
        });
    await cacheSet<OrgWithMembers | null>(cacheKey, organizationBySlug as OrgWithMembers | null, 60);
    return organizationBySlug as OrgWithMembers | null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function getInvitationsByOrgId(orgId: string) {
    try {
    const cacheKey = `org:${orgId}:invitations`;
    const cached = await cacheGet<typeof invitation.$inferSelect[]>(cacheKey);
    if (cached) return cached;

    const invites = await db.query.invitation.findMany({
            where: eq(invitation.organizationId, orgId),
        });
    await cacheSet(cacheKey, invites, 60);
        return invites;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function revokeInvitation(id: string) {
    try {
        // Fetch invitation to determine organization and enforce permissions
        const inv = await db.query.invitation.findFirst({ where: eq(invitation.id, id) });
        if (!inv) return { success: false as const, error: "Invitation not found" };

        // Check org permission: require admin or owner (mapped to update/delete org)
        const { success, error } = await auth.api.hasPermission({
            headers: await headers(),
            body: { permissions: { invitation: ["cancel"] }, organizationId: inv.organizationId }
        });
        if (!success || error) {
            return { success: false as const, error: error || "Forbidden" };
        }

        await db.delete(invitation).where(eq(invitation.id, id));
        // Log
        const { userId, userEmail } = await getCurrentUserForLogging();
        const hdrs = await headers();
        await logSystemActivity({
            eventType: 'invitation_revoked',
            userId,
            userEmail,
            description: `Revoked invitation ${id} for ${inv.email}`,
            metadata: { invitation_id: id, organization_id: inv.organizationId },
            ipAddress: hdrs.get('x-forwarded-for') || undefined,
            userAgent: hdrs.get('user-agent') || undefined,
        });
        // Best-effort cache invalidation: find org id and delete related keys if needed
        return { success: true as const };
    } catch (error) {
        console.error(error);
        return { success: false as const, error: (error as Error).message };
    }
}

export async function getAllOrganizationsWithMembers() {
    try {
        const orgs = await db.query.organization.findMany({
            with: {
                members: {
                    with: { user: true }
                }
            }
        });
        return orgs;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function resendInvitation(id: string) {
    try {
        const inv = await db.query.invitation.findFirst({ where: eq(invitation.id, id) });
        if (!inv) return { success: false as const, error: "Invitation not found" };

        // Permission: reuse 'create' on invitation within org as sending an invite action
        const { success, error } = await auth.api.hasPermission({
            headers: await headers(),
            body: { permissions: { invitation: ["create"] }, organizationId: inv.organizationId }
        });
        if (!success || error) {
            return { success: false as const, error: error || "Forbidden" };
        }

        // Rate limit: 3 resends per 24h per invitation
        const key = `inv:resend:${id}`;
        const rl = await rateLimitTake(key, 3, 60 * 60 * 24);
        if (!rl.allowed) {
            return { success: false as const, error: "Daily resend limit reached" };
        }

        // Load org and inviter for email
        const org = await db.query.organization.findFirst({ where: eq(organization.id, inv.organizationId) });
        const inviter = await db.query.user.findFirst({ where: eq(user.id, inv.inviterId) });

        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/accept-invitation/${inv.id}`;
        const html = await render(
            OrganizationInvitationEmail({
                email: inv.email,
                invitedByUsername: inviter?.name || "",
                invitedByEmail: inviter?.email || "",
                teamName: org?.name || "Organization",
                inviteLink,
            })
        );
        await sendGraphMail({
            from: process.env.EMAIL_SENDER_ADDRESS,
            to: inv.email,
            subject: "You've been invited to join our organization",
            html,
        });
        // Log
        const { userId, userEmail } = await getCurrentUserForLogging();
        const hdrs = await headers();
        await logSystemActivity({
            eventType: 'invitation_resent',
            userId,
            userEmail,
            description: `Resent invitation ${id} to ${inv.email}`,
            metadata: { invitation_id: id, organization_id: inv.organizationId },
            ipAddress: hdrs.get('x-forwarded-for') || undefined,
            userAgent: hdrs.get('user-agent') || undefined,
        });
        return { success: true as const };
    } catch (error) {
        console.error(error);
        return { success: false as const, error: (error as Error).message };
    }
}