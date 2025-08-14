import MembersTable from "@/components/members-table";
import { InviteByEmailForm } from "@/components/forms/invite-by-email-form";
import InvitationsTable from "@/components/invitations-table";
import { getOrganizationBySlug, getInvitationsByOrgId } from "@/server/organizations";
import { getCurrentUser } from "@/server/users";
import { CreateOrgDialog } from "@/app/dashboard/create-org-dialog.client";
import { redirect } from "next/navigation";

type Params = Promise<{ slug: string }>;

export default async function OrgAdminPage({ params }: { params: Params }) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  const { currentUser } = await getCurrentUser();
  const invitationsRaw = organization?.id
    ? await getInvitationsByOrgId(organization.id)
    : [];
  const invitations = invitationsRaw.map((i) => ({
    ...i,
    expiresAt: i.expiresAt ? new Date(i.expiresAt as unknown as string).toISOString() : null,
  }));

  const isOwner = Boolean(
    organization?.members?.some((m: { userId: string; role: string }) => m.userId === currentUser.id && m.role === "owner")
  );

  if (!isOwner && !organization?.members?.some((m: { userId: string; role: string }) => m.userId === currentUser.id && (m.role === "admin"))) {
    // Redirect non-admin/owner users away
    return redirect(`/${slug}/home`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · {organization?.name}</h1>
        {isOwner ? (
          <CreateOrgDialog />
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        <MembersTable members={organization?.members || []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Invite by email</h2>
        <InviteByEmailForm organizationId={organization?.id || ""} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pending invitations</h2>
        <InvitationsTable invitations={invitations} />
      </section>
    </div>
  );
}
