import { Button } from "@/components/ui/button";
import { getOrganizations } from "@/server/organizations";
import Link from "next/link";
import { CreateOrgDialog } from "./create-org-dialog.client";

export default async function Dashboard() {
  const organizations = await getOrganizations();
  // Use the first org as active context for the quick link tile

  const hasOrgs = organizations.length > 0;

  return (
    <div className="flex flex-col gap-8 items-center justify-start min-h-[calc(100vh-64px)] pt-6 px-4">
      
      {!hasOrgs ? (
        <div className="max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-2">Create your first organisation</h1>
          <p className="text-sm text-muted-foreground mb-4">You’ll need an organisation to get started.</p>
          <CreateOrgDialog defaultOpen />
        </div>
      ) : (
        <div className="flex flex-col gap-3 items-center">
          <h2 className="text-2xl font-bold">Organisations</h2>
          {organizations.map((organization) => (
            <Button variant="outline" key={organization.id} asChild>
              <Link href={`/${organization.slug}`}>{organization.name}</Link>
            </Button>
          ))}
          <div className="text-sm text-muted-foreground">
            Want to create another organisation? Go to your org’s Admin page.
          </div>
        </div>
      )}
    </div>
  );
}
