import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/db/drizzle";
import { verification, webauthnCredential, user, session } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { setSessionCookie } from "better-auth/cookies";
import { base64urlToBuffer } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, credential } = body;
    if (!userId) return NextResponse.json({ message: "Missing userId" }, { status: 400 });

    const challengeRecord = await db.query.verification.findFirst({ where: eq(verification.identifier, `passkey-auth:${userId}`) });
    if (!challengeRecord) return NextResponse.json({ message: "No challenge" }, { status: 400 });

    const creds = await db.query.webauthnCredential.findMany({ where: eq(webauthnCredential.userId, userId) });
    if (!creds.length) return NextResponse.json({ message: "No credentials" }, { status: 400 });

    const rpID = process.env.WEBAUTHN_RP_ID || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;
    const origin = (process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    const authRecord = creds.find(c => c.credentialId === credential.rawId);
    if (!authRecord) {
      return NextResponse.json({ message: "Credential not registered" }, { status: 400 });
    }

    // Build authenticator object for library
    const authenticator = {
      credentialID: base64urlToBuffer(authRecord.credentialId),
      credentialPublicKey: base64urlToBuffer(authRecord.publicKey),
      counter: authRecord.counter,
      transports: authRecord.transports?.split(',') as any,
    };

  const verificationResult = await (verifyAuthenticationResponse as any)({
      expectedChallenge: challengeRecord.value,
      expectedOrigin: origin,
      expectedRPID: rpID,
      response: credential,
      requireUserVerification: true,
      authenticator,
    });

    if (!verificationResult.verified || !verificationResult.authenticationInfo) {
      return NextResponse.json({ message: "Verification failed" }, { status: 400 });
    }

    // Update counter if advanced security info present
    if (verificationResult.authenticationInfo?.newCounter != null) {
      await db.update(webauthnCredential)
        .set({ counter: verificationResult.authenticationInfo.newCounter, updatedAt: new Date(), lastUsedAt: new Date() })
        .where(eq(webauthnCredential.id, authRecord.id));
    } else {
      await db.update(webauthnCredential)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(webauthnCredential.id, authRecord.id));
    }

    // Issue session similar to OTP flow
    const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!u) return NextResponse.json({ message: "User missing" }, { status: 404 });

    // rely on auth config for session expiry
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

    await db.insert(session).values({
      id: randomUUID(),
      userId: u.id,
      token,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await setSessionCookie({} as any, { session: { token, userId: u.id, id: "", expiresAt, createdAt: new Date(), updatedAt: new Date() } as any, user: u as any });

    // cleanup challenge
    await db.delete(verification).where(eq(verification.id, challengeRecord.id));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Auth failed" }, { status: 500 });
  }
}
