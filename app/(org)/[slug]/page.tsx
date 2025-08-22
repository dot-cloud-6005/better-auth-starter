import { redirect } from "next/navigation";

// Redirect /[slug] -> /[slug]/home to avoid duplicate root page and make /home canonical.
// NOTE: Route groups (e.g. (equipment)) do not add a URL segment, so having another
// page at (equipment)/page.tsx previously conflicted with this one. Keeping only a
// redirect here resolves the build-time manifest issue on Vercel.

type Params = Promise<{ slug: string }>;

export default async function OrgSlugRootRedirect({ params }: { params: Params }) {
  const { slug } = await params;
  redirect(`/${slug}/home`);
}
