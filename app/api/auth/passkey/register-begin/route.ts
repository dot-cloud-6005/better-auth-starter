import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/db/drizzle";
import { verification } from "@/db/schema";
import { eq } from "drizzle-orm";

// We'll reuse verification table to store challenge with identifier = passkey-reg:<userId>

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const userId = session.user.id;
    // Clean existing challenge
    await db.delete(verification).where(eq(verification.identifier, `passkey-reg:${userId}`));

    const rpName = process.env.NEXT_PUBLIC_APP_NAME || "App";
    const rpID = process.env.WEBAUTHN_RP_ID || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;
    const origin = (process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      // Provide Uint8Array per spec
      userID: new TextEncoder().encode(userId),
      userName: session.user.email,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      supportedAlgorithmIDs: [-7, -257],
    });

    await db.insert(verification).values({
      id: randomUUID(),
      identifier: `passkey-reg:${userId}`,
      value: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ options, origin });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ message: "Failed to start registration" }, { status: 500 });
  }
}
