import { getOrganizationBySlug, getInvitationsByOrgId } from "@/server/organizations";
import { getCurrentUser } from "@/server/users";
import { redirect } from "next/navigation";
// merged admin features
import AdminClient from "./admin-client";
import { getUsers, getAdmins, getEmailSettings, getSystemLogs } from "./actions";
import type { EmailAutomationJob } from "./job-templates";

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

  // Load equipment/plant admin datasets and logs; degrade gracefully
  let users: any[] = [];
  let admins: any[] = [];
  let emailSettings: any[] = [];
  let systemLogs: any[] = [];
  try {
    const [u, a, e, logs] = await Promise.all([
      getUsers(),
      getAdmins(),
      getEmailSettings(),
      getSystemLogs(40),
    ]);
    users = u || [];
    admins = a || [];
    emailSettings = e || [];
    systemLogs = logs || [];
  } catch (err) {
    try {
      const [u, a] = await Promise.all([getUsers(), getAdmins()]);
      users = u || [];
      admins = a || [];
    } catch {}
  }

  const transformedEmailSettings: EmailAutomationJob[] = (emailSettings || []).map((setting: any) => ({
    ...setting,
    name: setting.name || `${(setting.automation_category || setting.type || 'email').toString()} Job`,
    description:
      setting.description || `Automated ${(setting.automation_category || setting.type || 'email').toString().replace('_', ' ')} notifications`,
    priority: setting.priority || 5,
    run_count: setting.run_count || 0,
    error_count: setting.error_count || 0,
    last_run: setting.last_run || undefined,
    next_run: setting.next_run || undefined,
    last_error: setting.last_error || undefined,
  }));

  return (
    <div className="flex flex-col gap-10 mx-auto py-10 max-w-7xl">
      {/* System Administration (equipment/plant/logs) */}
      <AdminClient
        initialUsers={users as any}
        initialAdmins={admins as any}
        initialEmailSettings={transformedEmailSettings as any}
        initialSystemLogs={systemLogs as any}
  organizationName={organization?.name}
  organizationId={organization?.id || ""}
  organizationSlug={organization?.slug || undefined}
  members={(organization?.members as any) || []}
  invitations={invitations as any}
      />
    </div>
  );
}
