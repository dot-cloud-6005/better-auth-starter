import { db } from "@/db/drizzle";
import { schema } from "@/db/schema";

import OrganizationInvitationEmail from "@/components/emails/organization-invitation";
import ForgotPasswordEmail from "@/components/emails/reset-password";
import VerifyEmail from "@/components/emails/verify-email";
import { getActiveOrganization } from "@/server/organizations";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey"; // per docs; if missing will error
import { render } from "@react-email/render";
import { sendGraphMail } from "@/lib/msgraph";
import { admin, member, owner } from "./auth/permissions";
import { createAuthEndpoint } from "better-auth/api";
import { APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { rateLimitTake, isLocked, setLock } from "@/lib/rate-limit";
import { getAllowSignups } from "@/lib/config";

export const auth = betterAuth({
    cookies: {
        sessionToken: {
            secure: true,
            httpOnly: true,
            sameSite: "lax",
            path: "/",
        },
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            const html = await render(
                VerifyEmail({ username: user.name, verifyUrl: url })
            );
            await sendGraphMail({
                from: process.env.EMAIL_SENDER_ADDRESS,
                to: user.email,
                subject: "Verify your email",
                html,
            });
        },
    // We'll verify via OTP flow instead of a separate verification email
    sendOnSignUp: false,
    },
    
    emailAndPassword: {
    // Disable password auth in favor of OTP
    enabled: false,
        sendResetPassword: async ({ user, url }) => {
            const html = await render(
                ForgotPasswordEmail({ username: user.name, resetUrl: url, userEmail: user.email })
            );
            await sendGraphMail({
                from: process.env.EMAIL_SENDER_ADDRESS,
                to: user.email,
                subject: "Reset your password",
                html,
            });
        },
        requireEmailVerification: true
    },
    databaseHooks: {
        session: {
            create: {
                before: async (session) => {
                    const organization = await getActiveOrganization(session.userId)
                    return {
                        data: {
                            ...session,
                            activeOrganizationId: organization?.id
                        }
                    }
                }
            }
        }
    },
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    plugins: [
        passkey({
            rpID: process.env.WEBAUTHN_RP_ID || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname,
            rpName: process.env.NEXT_PUBLIC_APP_NAME || "App",
            origin: (process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
            authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        }),
        organization({
        async sendInvitationEmail(data) {
            const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/accept-invitation/${data.id}`
            const html = await render(
                OrganizationInvitationEmail({
                    email: data.email,
                    invitedByUsername: data.inviter.user.name,
                    invitedByEmail: data.inviter.user.email,
                    teamName: data.organization.name,
                    inviteLink
                })
            );
            await sendGraphMail({
                from: process.env.EMAIL_SENDER_ADDRESS,
                to: data.email,
                subject: "You've been invited to join our organization",
                html,
            });
        },
        roles: {
            owner,
            admin,
            member
        }
    }),
    // Lightweight Email OTP plugin: request and verify OTP, then create session
    ((): import("better-auth").BetterAuthPlugin => {
        const requestOtp = createAuthEndpoint(
            "/request-otp",
            {
                method: ["POST"],
                body: z.object({
                    email: z.string().email(),
                    name: z.string().min(1).optional(),
                }),
            },
            async (ctx) => {
                const { adapter } = ctx.context;
                const emailRaw = ctx.body.email;
                const name = ctx.body.name;
                const email = (emailRaw || "").trim().toLowerCase();
                const ip = ctx.request?.headers.get("x-forwarded-for") || ctx.request?.headers.get("x-real-ip") || "ip:unknown";
                const emailKey = `otp:req:${email}`;
                const ipKey = `otp:req-ip:${ip}`;
                if (!(await rateLimitTake(emailKey, 5, 60)).allowed) {
                    throw new APIError(429, { message: "Too many requests. Please try again shortly." });
                }
                if (!(await rateLimitTake(ipKey, 20, 60)).allowed) {
                    throw new APIError(429, { message: "Too many requests. Please try again shortly." });
                }

                // If sign-ups are disabled, only allow OTP for existing users
                const existingUser = await adapter.findOne<{ id: string } | null>({
                    model: "user",
                    where: [{ field: "email", operator: "eq", value: email }],
                });
                if (!existingUser) {
                    const allowed = await getAllowSignups();
                    if (!allowed) {
                        throw new APIError(403, { message: "Sign-ups are currently disabled." });
                    }
                }

                // Generate 6-digit code
                const code = Math.floor(100000 + Math.random() * 900000)
                    .toString();
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

                // Remove any existing OTPs for this email
                await adapter.deleteMany({
                    model: "verification",
                    where: [
                        { field: "identifier", operator: "eq", value: `otp:${email}` },
                    ],
                });

                await adapter.create({
                    model: "verification",
                    data: {
                        identifier: `otp:${email}`,
                        value: code,
                        expiresAt,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                });

                const html = `
                    <div style="font-family: Arial, sans-serif; line-height:1.6;">
                      <h2>Sign-in code</h2>
                      <p>Hello${name ? ` ${name}` : ""},</p>
                      <p>Your one-time code is:</p>
                      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
                      <p>This code expires in 10 minutes.</p>
                    </div>`;

                await sendGraphMail({
                    from: process.env.EMAIL_SENDER_ADDRESS,
                    to: email,
                    subject: "Your sign-in code",
                    html,
                });

                return { success: true } as const;
            }
        );

        const verifyOtp = createAuthEndpoint(
            "/verify-otp",
            {
                method: ["POST"],
                body: z.object({
                    email: z.string().email(),
                    code: z.string().length(6),
                    name: z.string().min(1).optional(),
                }),
            },
            async (ctx) => {
                const { adapter, sessionConfig, generateId } = ctx.context;
                const emailRaw = ctx.body.email;
                const code = ctx.body.code;
                const name = ctx.body.name;
                const email = (emailRaw || "").trim().toLowerCase();
                const ip = ctx.request?.headers.get("x-forwarded-for") || ctx.request?.headers.get("x-real-ip") || "ip:unknown";
                const lockKey = `otp:lock:${email}`;
                if (await isLocked(lockKey)) {
                    throw new APIError(429, { message: "Too many attempts. Please try again later." });
                }
                const attemptsKey = `otp:attempts:${email}`;
                const ipKey = `otp:verify-ip:${ip}`;
                if (!(await rateLimitTake(ipKey, 30, 300)).allowed) {
                    throw new APIError(429, { message: "Too many attempts. Please try again later." });
                }

                const record = await adapter.findOne<{ id: string; expiresAt: Date } | null>({
                    model: "verification",
                    where: [
                        { field: "identifier", operator: "eq", value: `otp:${email}` },
                        { field: "value", operator: "eq", value: code },
                    ],
                });

                if (!record) {
                    // count failed attempts and lock after 5
                    const fails = (await rateLimitTake(attemptsKey, 5, 600));
                    if (!fails.allowed) {
                        await setLock(lockKey, 900);
                    }
                    throw new APIError(400, { message: "Invalid code or email." });
                }
                if (new Date(record.expiresAt).getTime() < Date.now()) {
                    await setLock(lockKey, 300);
                    throw new APIError(400, { message: "Code has expired." });
                }

                let userRecord = await adapter.findOne<{ id: string; email: string; emailVerified: boolean; name: string; createdAt: Date; updatedAt: Date; image?: string | null } | null>({
                    model: "user",
                    where: [{ field: "email", operator: "eq", value: email }],
                });

                if (!userRecord) {
                    // If user doesn't exist, treat as sign-up and gate on global toggle
                    const allowed = await getAllowSignups();
                    if (!allowed) {
                        throw new APIError(403, { message: "Sign-ups are currently disabled." });
                    }
                    userRecord = await adapter.create<{ id: string; email: string; emailVerified: boolean; name: string; createdAt: Date; updatedAt: Date; image?: string | null }>({
                        model: "user",
                        data: {
                            email,
                            name: name || email.split("@")[0],
                            emailVerified: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    });
                }

                // Invalidate the OTP
                await adapter.delete({
                    model: "verification",
                    where: [{ field: "id", operator: "eq", value: record.id }],
                });

                const expiresAt = new Date(Date.now() + (sessionConfig.expiresIn ?? 60 * 60 * 24 * 7) * 1000);
                const token =
                    (typeof generateId === "function" && generateId({ model: "session", size: 48 })) ||
                    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

        const sessionRecord = await adapter.create<{ id: string; userId: string; token: string; expiresAt: Date; createdAt: Date; updatedAt: Date; ipAddress?: string | null; userAgent?: string | null }>({
                    model: "session",
                    data: {
                        userId: userRecord.id,
                        expiresAt,
                        token,
                        createdAt: new Date(),
                        updatedAt: new Date(),
            ipAddress: undefined as unknown as null,
            userAgent: undefined as unknown as null,
                    },
                });

                await setSessionCookie(ctx, { session: sessionRecord, user: userRecord });

                return { success: true } as const;
            }
        );

        return {
            id: "email-otp",
            endpoints: {
                "request-otp": requestOtp,
                "verify-otp": verifyOtp,
            },
        } as const;
    })()]
});
