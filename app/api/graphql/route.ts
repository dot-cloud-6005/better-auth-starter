import type { NextRequest } from "next/server";
import { ApolloServer, BaseContext } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { gql } from "graphql-tag";
import { render } from "@react-email/render";
import VerifyEmail from "@/components/emails/verify-email";
import ForgotPasswordEmail from "@/components/emails/reset-password";
import OrganizationInvitationEmail from "@/components/emails/organization-invitation";
import { sendGraphMail } from "@/lib/msgraph";
import { auth } from "@/lib/auth";
import { rateLimitTake } from "@/lib/rate-limit";

const typeDefs = gql`
  type Mutation {
    sendMail(to: String!, subject: String!, html: String!): Boolean!
    sendVerifyEmail(to: String!, username: String!, url: String!): Boolean!
    sendResetPassword(to: String!, username: String!, url: String!, userEmail: String!): Boolean!
    sendInvitation(to: String!, invitedByUsername: String!, invitedByEmail: String!, teamName: String!, inviteLink: String!): Boolean!
  }

  type Query {
    health: String!
  }
`;

type Ctx = { isAuthenticated: boolean; userId?: string; sameOrigin?: boolean };

function isAuthCtx(x: unknown): x is Ctx {
  if (typeof x !== "object" || x === null) return false;
  if (!("isAuthenticated" in x)) return false;
  const val = (x as { isAuthenticated?: unknown }).isAuthenticated;
  return typeof val === "boolean";
}

const resolvers = {
  Query: {
    health: () => "ok",
  },
  Mutation: {
    async sendMail(_: unknown, args: { to: string; subject: string; html: string }, ctx: unknown) {
      if (!isAuthCtx(ctx) || !ctx.isAuthenticated || ctx.sameOrigin === false) throw new Error("Unauthorized");
      if (ctx.userId) {
        const rl = await rateLimitTake(`gql:sendMail:user:${ctx.userId}`, 10, 600);
        if (!rl.allowed) throw new Error("Rate limited");
      }
      await sendGraphMail({ to: args.to, subject: args.subject, html: args.html });
      return true;
    },
    async sendVerifyEmail(_: unknown, args: { to: string; username: string; url: string }, ctx: unknown) {
      if (!isAuthCtx(ctx) || !ctx.isAuthenticated || ctx.sameOrigin === false) throw new Error("Unauthorized");
      if (ctx.userId) {
        const rl = await rateLimitTake(`gql:verifyEmail:user:${ctx.userId}`, 5, 600);
        if (!rl.allowed) throw new Error("Rate limited");
      }
      const html = await render(VerifyEmail({ username: args.username, verifyUrl: args.url }));
      await sendGraphMail({ to: args.to, subject: "Verify your email", html });
      return true;
    },
    async sendResetPassword(_: unknown, args: { to: string; username: string; url: string; userEmail: string }, ctx: unknown) {
      if (!isAuthCtx(ctx) || !ctx.isAuthenticated || ctx.sameOrigin === false) throw new Error("Unauthorized");
      if (ctx.userId) {
        const rl = await rateLimitTake(`gql:reset:user:${ctx.userId}`, 3, 900);
        if (!rl.allowed) throw new Error("Rate limited");
      }
      const html = await render(
        ForgotPasswordEmail({ username: args.username, resetUrl: args.url, userEmail: args.userEmail })
      );
      await sendGraphMail({ to: args.to, subject: "Reset your password", html });
      return true;
    },
    async sendInvitation(
      _: unknown,
      args: { to: string; invitedByUsername: string; invitedByEmail: string; teamName: string; inviteLink: string },
      ctx: unknown
    ) {
      if (!isAuthCtx(ctx) || !ctx.isAuthenticated || ctx.sameOrigin === false) throw new Error("Unauthorized");
      if (ctx.userId) {
        const rl = await rateLimitTake(`gql:invite:user:${ctx.userId}`, 10, 3600);
        if (!rl.allowed) throw new Error("Rate limited");
      }
      const html = await render(
        OrganizationInvitationEmail({
          email: args.to,
          invitedByUsername: args.invitedByUsername,
          invitedByEmail: args.invitedByEmail,
          teamName: args.teamName,
          inviteLink: args.inviteLink,
        })
      );
      await sendGraphMail({ to: args.to, subject: "You've been invited to join our organization", html });
      return true;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== "production",
}) as unknown as ApolloServer<BaseContext>;
const apolloHandler = startServerAndCreateNextHandler(server, {
  context: async (req: NextRequest) => {
    // Authenticate via Better Auth and check same-origin to mitigate CSRF
    const session = await auth.api.getSession({ headers: req.headers });
    const origin = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";
    const url = new URL(req.url);
    const rawAllowed = (process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\/$/, ""));
    const allowed = rawAllowed.length > 0 ? rawAllowed : [url.origin];
    const sameOrigin = allowed.some((o) => origin === o || (referer && referer.startsWith(o)));
    return { isAuthenticated: Boolean(session), userId: session?.user.id, sameOrigin } satisfies Ctx;
  },
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disallow GET to reduce CSRF surface; use POST only
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: Request) {
  return apolloHandler(req as unknown as NextRequest);
}
