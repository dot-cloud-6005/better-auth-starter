"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Organization } from "@/db/schema";
import { authClient } from "@/lib/auth-client";

export default function ChooseOrgModal({ organizations }: { organizations: Organization[] }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  const go = async (org: Organization) => {
    setOpen(false);
    if (org.id) {
      await authClient.organization.setActive({ organizationId: org.id });
    }
    router.push(`/${org.slug || ""}/home`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select an organization</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {organizations.map((org) => (
            <Button key={org.id} variant="outline" onClick={() => go(org)} disabled={!org.slug}>
              {org.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
