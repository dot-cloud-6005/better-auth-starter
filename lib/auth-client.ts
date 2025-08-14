import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Prefer same-origin in the browser to avoid cross-origin calls in production.
// On the server (SSR), fall back to an env-configured absolute URL.
const clientBaseURL =
    typeof window !== "undefined"
        ? window.location.origin // explicit same-origin to avoid localhost in prod bundles
        : process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const authClient = createAuthClient({
    baseURL: clientBaseURL,
    plugins: [organizationClient()],
});