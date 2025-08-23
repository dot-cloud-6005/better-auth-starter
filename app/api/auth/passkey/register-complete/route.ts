import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/db/drizzle";
import { verification, webauthnCredential } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json();

    // Load expected challenge
    const existing = await db.query.verification.findFirst({
      where: eq(verification.identifier, `passkey-reg:${userId}`)
    });
    if (!existing) return NextResponse.json({ message: "No challenge" }, { status: 400 });

    const rpID = process.env.WEBAUTHN_RP_ID || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;
    const origin = (process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    const verificationResult = await verifyRegistrationResponse({
      expectedChallenge: existing.value,
      expectedOrigin: origin,
      expectedRPID: rpID,
      response: body,
      requireUserVerification: true,
    });

    if (!verificationResult.verified || !verificationResult.registrationInfo) {
      return NextResponse.json({ message: "Verification failed" }, { status: 400 });
    }

    const { credential } = verificationResult.registrationInfo;
    // Normalize to base64url strings (force type annotation to ensure Drizzle sees string)
    const credentialId: string = typeof credential.id === 'string'
      ? credential.id
      : Buffer.from(credential.id as any).toString('base64url');
    const publicKey: string = typeof credential.publicKey === 'string'
      ? credential.publicKey
      : Buffer.from(credential.publicKey as any).toString('base64url');

    // Persist credential (upsert on credentialId)
    await db.insert(webauthnCredential).values({
      id: randomUUID(),
      userId,
      credentialId,
      publicKey,
      counter: credential.counter || 0,
      transports: credential.transports?.join(","),
      deviceType: verificationResult.registrationInfo.credentialDeviceType,
      backedUp: verificationResult.registrationInfo.credentialBackedUp,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    }).onConflictDoUpdate({
      target: webauthnCredential.credentialId,
      set: {
        counter: credential.counter || 0,
        transports: credential.transports?.join(","),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      }
    });

    // Cleanup challenge
    await db.delete(verification).where(eq(verification.id, existing.id));

    return NextResponse.json({ verified: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Registration failed" }, { status: 500 });
  }
}
