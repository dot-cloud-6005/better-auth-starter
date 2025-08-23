import { getOrganizationBySlug } from "@/server/organizations";
import { getCurrentUser } from "@/server/users";
import { updateProfile } from "./actions";
import { redirect } from "next/navigation";
import PasskeyRegistration from './passkey-registration';
import { PasskeyList } from './passkey-list.client';

// Simple profile & security settings page. Passkeys not yet implemented.
// When implemented, a list of registered credentials and add/remove flows will go here.

interface Params { slug: string }

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) redirect("/landing");
  const { currentUser } = await getCurrentUser();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile & Security</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information and sign-in methods.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Profile</h2>
        <form action={updateProfile} className="space-y-4 border rounded-lg p-4 bg-white dark:bg-neutral-900">
          <input type="hidden" name="orgSlug" value={slug} />
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              defaultValue={currentUser.name || ""}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              defaultValue={currentUser.email}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-80"
            />
            <p className="text-xs text-muted-foreground">Email changes not supported. Contact support if required.</p>
          </div>
          <div>
            <button type="submit" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Security</h2>
        <div className="space-y-3 border rounded-lg p-4 bg-white dark:bg-neutral-900">
          <div>
            <h3 className="text-sm font-semibold">Current Sign-in Method</h3>
            <p className="text-xs text-muted-foreground">Email One-Time Passcode (OTP) + optional Passkeys</p>
          </div>
          <div className="pt-2 border-t border-border space-y-3">
            <h3 className="text-sm font-semibold mb-1">Passkeys</h3>
            <PasskeyRegistration />
            <PasskeyList />
          </div>
          <div className="pt-2 border-t border-border">
            <h3 className="text-sm font-semibold mb-1">Recovery Options</h3>
            <p className="text-xs text-muted-foreground">Recovery codes will be available after passkey support is finalized.</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Account Metadata</h2>
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b last:border-0"><th className="text-left p-2 font-medium w-48">User ID</th><td className="p-2 font-mono text-xs break-all">{currentUser.id}</td></tr>
              <tr className="border-b last:border-0"><th className="text-left p-2 font-medium">Created</th><td className="p-2 text-xs">{new Date(currentUser.createdAt as unknown as string).toLocaleString()}</td></tr>
              <tr className="border-b last:border-0"><th className="text-left p-2 font-medium">Last Updated</th><td className="p-2 text-xs">{new Date(currentUser.updatedAt as unknown as string).toLocaleString()}</td></tr>
              <tr className="border-b last:border-0"><th className="text-left p-2 font-medium">Verified Email</th><td className="p-2 text-xs">{currentUser.emailVerified ? 'Yes' : 'No'}</td></tr>
              {currentUser.isMasterAdmin ? <tr className="border-b last:border-0"><th className="text-left p-2 font-medium">Master Admin</th><td className="p-2 text-xs">Yes</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
