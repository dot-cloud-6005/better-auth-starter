import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/db/drizzle";
import { user, verification, webauthnCredential } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";


export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ message: "Email required" }, { status: 400 });
    const u = await db.query.user.findFirst({ where: eq(user.email, email.trim().toLowerCase()) });
    if (!u) return NextResponse.json({ message: "User not found" }, { status: 404 });
  const creds = await db.query.webauthnCredential.findMany({ where: eq(webauthnCredential.userId, u.id) });
    if (!creds.length) return NextResponse.json({ message: "No passkeys" }, { status: 404 });

    const rpID = process.env.WEBAUTHN_RP_ID || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;

    const options = await generateAuthenticationOptions({
      timeout: 60000,
      rpID,
      userVerification: "preferred",
      // Keep id as base64url string; the browser lib will convert internally
      allowCredentials: creds.map(c => ({
        id: c.credentialId,
        transports: c.transports ? (c.transports.split(',') as any) : undefined,
      })),
    });

    // Store challenge keyed by passkey-auth:<userId>
    await db.delete(verification).where(eq(verification.identifier, `passkey-auth:${u.id}`));
    await db.insert(verification).values({
      id: randomUUID(),
      identifier: `passkey-auth:${u.id}`,
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ options, userId: u.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}
