import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="hover:shadow-md transition-shadow">
        <Link href="/dashboard/navigation-map" className="block focus:outline-hidden">
          <CardHeader>
            <CardTitle>Navigation Map</CardTitle>
            <CardDescription>
              Explore navigation assets on an interactive map. Search by Asset ID, view details, and track your location.
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
  );
}
