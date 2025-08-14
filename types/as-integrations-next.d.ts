declare module "@as-integrations/next" {
  import type { NextRequest } from "next/server";
  import type { ApolloServer } from "@apollo/server";

  export function startServerAndCreateNextHandler<Req extends NextRequest = NextRequest>(
    server: ApolloServer,
    options?: {
      context?: (req: Req) => Promise<Record<string, unknown>> | Record<string, unknown>;
    }
  ): (req: Req) => Promise<Response>;
}
