"use server";

import { db } from "@/db/drizzle";
import { member, Role } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { isAdmin } from "./permissions";
import { getCurrentUserForLogging, logSystemActivity } from "@/lib/equipment/actions/system-logs";
import { headers } from "next/headers";

export const addMember = async (organizationId: string, userId: string, role: Role) => {
    try {
        await auth.api.addMember({
            body: {
                userId,
                organizationId,
                role
            }
        })
    } catch (error) {
        console.error(error);
        throw new Error("Failed to add member.");
    }
};

export const removeMember = async (memberId: string) => {
    const admin = await isAdmin();

    if (!admin) {
        return {
            success: false,
            error: "You are not authorized to remove members."
        }
    }

    try {
        await db.delete(member).where(eq(member.id, memberId));

        // Log
        const { userId, userEmail } = await getCurrentUserForLogging();
        const hdrs = await headers();
        await logSystemActivity({
            eventType: 'member_removed',
            userId,
            userEmail,
            description: `Removed member ${memberId}`,
            metadata: { member_id: memberId },
            ipAddress: hdrs.get('x-forwarded-for') || undefined,
            userAgent: hdrs.get('user-agent') || undefined,
        });

        return {
            success: true,
            error: null
        }
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: "Failed to remove member."
        }
    }
}