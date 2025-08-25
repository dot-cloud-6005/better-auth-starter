import Link from "next/link";
import { getOrganizationBySlug } from "@/server/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Wrench, ClipboardList, BarChart3, Building2, BookOpen } from "lucide-react";

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

      <Tabs defaultValue="navigation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="navigation" className="flex items-center gap-2">
            <Map className="h-4 w-4" /> Navigation
          </TabsTrigger>
          <TabsTrigger value="facilities" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Facility&apos;s
          </TabsTrigger>
          <TabsTrigger value="plant-equipment" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Plant & Equipment
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Help
          </TabsTrigger>
        </TabsList>

        {/* Navigation tab */}
        <TabsContent value="navigation">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/nav-map`} className="block focus:outline-hidden" prefetch={true}>
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
        </TabsContent>

        {/* Facility&apos;s tab (placeholder) */}
        <TabsContent value="facilities">
          <div className="rounded border p-6 text-sm text-muted-foreground">
            Facility content coming soon.
          </div>
        </TabsContent>

        {/* Plant & Equipment tab */}
        <TabsContent value="plant-equipment">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/plant-equip/equipment`} className="block focus:outline-hidden" prefetch={true}>
                <CardHeader>
                  <CardTitle>Equipment</CardTitle>
                  <CardDescription>Manage equipment, groups, and schedules.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/plant-equip/plant`} className="block focus:outline-hidden" prefetch={true}>
                <CardHeader>
                  <CardTitle>Plant</CardTitle>
                  <CardDescription>Manage plant assets and maintenance.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/plant-equip/inspections`} className="block focus:outline-hidden" prefetch={true}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Plant & Equipment Inspections</CardTitle>
                  </div>
                  <CardDescription>View and record inspection history.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/plant-equip/analytics`} className="block focus:outline-hidden" prefetch={true}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Analytics</CardTitle>
                  </div>
                  <CardDescription>Compliance status, trends, and schedules.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </TabsContent>

        {/* Help tab */}
        <TabsContent value="help">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <Link href={`/${slug}/docs`} className="block focus:outline-hidden" prefetch={true}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    User Guide
                  </CardTitle>
                  <CardDescription>
                    Comprehensive step-by-step help for using the system. Written in Australian English for clarity.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>• Getting started guide</div>
                    <div>• Equipment & plant management</div>
                    <div>• Passkey authentication</div>
                    <div>• Navigation map usage</div>
                    <div>• Inspections & compliance</div>
                    <div>• Analytics & reporting</div>
                    <div>• Storage & documents</div>
                    <div>• Troubleshooting & support</div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
