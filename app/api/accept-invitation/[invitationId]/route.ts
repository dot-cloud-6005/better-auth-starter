import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const invitationId = decodeURIComponent(segments[segments.length - 1] || "");

        try {
            const api = auth.api as unknown as {
                acceptInvitation: (input: { body: { invitationId: string }; headers: Headers }) => Promise<unknown>;
            };
                const data = await api.acceptInvitation({
                    body: { invitationId },
                    headers: request.headers,
                });

        console.log(data);
        return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (error) {
        console.error(error);
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }
}