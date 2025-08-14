import { getOrganizations } from "@/server/organizations";
import { redirect } from "next/navigation";
import ChooseOrgModal from "@/components/choose-org-modal";
import SingleOrgRedirect from "@/components/single-org-redirect";

export default async function LandingPage() {
  const organizations = await getOrganizations();

  if (!organizations?.length) {
    redirect("/dashboard");
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
