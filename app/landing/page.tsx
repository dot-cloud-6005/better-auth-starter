import { getOrganizations } from "@/server/organizations";
import ChooseOrgModal from "@/components/choose-org-modal";
import SingleOrgRedirect from "@/components/single-org-redirect";
import { CreateOrgDialog } from "@/components/create-org-dialog.client";

export default async function LandingPage() {
  const organizations = await getOrganizations();
  // No orgs: onboard right here
  if (!organizations?.length) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-2">Create your first organisation</h1>
          <p className="text-sm text-muted-foreground mb-4">You’ll need an organisation to get started.</p>
          <CreateOrgDialog defaultOpen />
        </div>
      </div>
    );
  }

  if (organizations.length === 1) {
    const only = organizations[0];
    return (
      <div className="flex items-center justify-center h-screen">
        <SingleOrgRedirect organization={only} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <ChooseOrgModal organizations={organizations} />
    </div>
  );
}
