"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { Organization } from "@/db/schema";
import { toast } from "sonner";

export default function SingleOrgRedirect({ organization }: { organization: Organization }) {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        if (organization.id) {
          await authClient.organization.setActive({ organizationId: organization.id });
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to set active organization");
      } finally {
        const slug = organization.slug ?? "";
        router.replace(`/${slug}/home`);
      }
    })();
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
