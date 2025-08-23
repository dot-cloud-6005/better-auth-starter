"use server";

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/users";
import { revalidatePath } from "next/cache";

// Update basic profile fields (currently only name)
export async function updateProfile(formData: FormData): Promise<void> {
  const { currentUser } = await getCurrentUser();
  const name = (formData.get("name") || "").toString().trim();
  if (!name) {
  // Silently ignore empty; in future surface via redirect search param
  return;
  }
  await db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, currentUser.id));
  revalidatePath("/" + (formData.get("orgSlug") || "" ) + "/profile");
}

// Passkey (WebAuthn) placeholder actions. Actual implementation will require
// adding a credentials table and using @simplewebauthn/server. These are stubs
// to outline the future API shape.
export async function beginPasskeyRegistration() {
  // TODO: implement WebAuthn challenge generation & store transient challenge
  return { notImplemented: true } as const;
}

export async function completePasskeyRegistration() {
  // TODO: verify attestation and persist credential
  return { notImplemented: true } as const;
}
