import AllUsers from "@/components/all-users";
import MembersTable from "@/components/members-table";
import { getOrganizationBySlug } from "@/server/organizations";
import { getCurrentUser, getUsers } from "@/server/users";
import Link from "next/link";

type Params = Promise<{ slug: string }>;

export default async function OrganizationBySlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  await getCurrentUser();

  const organization = await getOrganizationBySlug(slug);
  const users = await getUsers(organization?.id || "");

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{organization?.name}</h1>
        <Link className="text-sm underline" href={`/${slug}/admin`}>
          Admin
        </Link>
      </div>
      <MembersTable members={organization?.members || []} />
      <AllUsers users={users} organizationId={organization?.id || ""} />
    </div>
  );
}
