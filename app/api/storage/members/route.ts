import { NextRequest } from "next/server";
import { getOrgMembers } from "@/server/storage";

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await req.json();
    if (!organizationId) return new Response('Missing organizationId', { status: 400 });

    const members = await getOrgMembers(organizationId);
    return new Response(JSON.stringify({ members }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
