"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateOrganizationForm } from "@/components/forms/create-organization-form";
import { authClient } from "@/lib/auth-client";

export function CreateOrgDialog({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Organisation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organisation</DialogTitle>
          <DialogDescription>
            Create a new organisation to get started.
          </DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm
          onSuccess={async (org) => {
            setOpen(false);
            const slug = org?.slug || "";
            // Navigate first for immediate UX
            router.push(`/${slug}/home`);
            // Best-effort set active in background
            if (org?.id) {
              try {
                await authClient.organization.setActive({ organizationId: org.id });
              } catch (e) {
                console.error("Failed to set active org after create", e);
              }
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
