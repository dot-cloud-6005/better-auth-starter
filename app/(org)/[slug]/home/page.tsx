import Link from "next/link";
import { getOrganizationBySlug } from "@/server/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Params = Promise<{ slug: string }>;

export default async function OrgHome({ params }: { params: Params }) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Heading */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold truncate">{org?.name ?? "Organization"} Home</h1>
        <p className="text-sm text-muted-foreground mt-1">Quick links to key tools and pages.</p>
      </div>

      {/* Tiles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <Link href={`/${slug}/nav-map`} className="block focus:outline-hidden">
            <CardHeader>
              <CardTitle>Navigation Map</CardTitle>
              <CardDescription>
                Explore navigation assets on an interactive map. Search by Asset ID and track your location.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                - Pan/zoom and tap assets to view details
                <br />- Search by Asset # to quickly locate
                <br />- Enable tracking to follow your position
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
