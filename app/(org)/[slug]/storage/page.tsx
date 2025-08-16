import { getOrganizationBySlug } from "@/server/organizations";
import { ModernStorageBrowser } from "@/components/storage/modern-browser.client";

type Params = Promise<{ slug: string }>;

export default async function StoragePage({ params }: { params: Params }) {
	const { slug } = await params;
	const org = await getOrganizationBySlug(slug);
	if (!org) {
		return <div className="p-6">Organisation not found.</div>;
	}
	return (
		<div className="min-h-screen">
			<ModernStorageBrowser organizationId={org.id} />
		</div>
	);
}
