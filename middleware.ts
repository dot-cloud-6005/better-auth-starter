import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const publicPaths = new Set([
        "/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/favicon.ico",
    ]);
    const isAsset = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/i.test(pathname);
    const isPublic =
        publicPaths.has(pathname) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/public") ||
        isAsset;

    // Redirect any legacy /dashboard paths to /landing
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        const url = new URL("/landing", request.url);
        // preserve query string
        for (const [k, v] of request.nextUrl.searchParams.entries()) url.searchParams.set(k, v);
        return NextResponse.redirect(url);
    }

    const sessionCookie = getSessionCookie(request);

    let response: NextResponse;
    if (!isPublic && !sessionCookie) {
        const url = new URL("/login", request.url);
        url.searchParams.set("next", pathname);
        response = NextResponse.redirect(url);
    } else {
        response = NextResponse.next();
    }

    // Apply security headers to all responses
    try {
        const isProd = process.env.NODE_ENV === "production";

        const scriptSrc = "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'") + " blob: data:";
        const cspParts = [
            "default-src 'self'",
            // Allow Next.js dev/hmr, Graph, and external APIs we call from the browser
            scriptSrc,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            // Map tiles/styles and dev websocket
            "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com https://*.upstash.io https://api.maptiler.com https://*.maptiler.com https://demotiles.maplibre.org ws: wss:",
            // MapLibre uses blob workers; allow them
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ];

        response.headers.set("Content-Security-Policy", cspParts.join("; "));
        response.headers.set("X-Frame-Options", "DENY");
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        response.headers.set(
            "Permissions-Policy",
            // Allow geolocation in the top-level document; keep camera/mic disabled
            "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
        );
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
        response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
        response.headers.set("X-DNS-Prefetch-Control", "off");
        response.headers.set("Origin-Agent-Cluster", "?1");
    // Legacy fallback (very old Chrome): Feature-Policy
    response.headers.set("Feature-Policy", "geolocation 'self'");
        // Only set HSTS in production/HTTPS
        const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
        if (isProd && proto === "https") {
            response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
        }
    } catch {
        // no-op if headers can't be set
    }

    return response;
}

export const config = {
    matcher: ["/:path*"],
};