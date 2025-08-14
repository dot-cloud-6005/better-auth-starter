"use client";

import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/server/organizations";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface InvitationRow {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string | null;
}

export default function InvitationsTable({ invitations }: { invitations: InvitationRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  const handleRevoke = async (id: string) => {
    try {
      setLoadingId(id);
      const { success, error } = await revokeInvitation(id);
      if (!success) {
        toast.error(error || "Failed to revoke invitation");
        return;
      }
      toast.success("Invitation revoked");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to revoke invitation");
    } finally {
      setLoadingId(null);
    }
  };

  if (!invitations?.length) {
    return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between border rounded-md p-3">
          <div className="flex flex-col">
            <span className="font-medium">{inv.email}</span>
            <span className="text-xs text-muted-foreground">
              {inv.role || "member"} · {inv.status}
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleRevoke(inv.id)}
            disabled={loadingId === inv.id}
          >
            {loadingId === inv.id ? <Loader2 className="size-4 animate-spin" /> : "Revoke"}
          </Button>
        </div>
      ))}
    </div>
  );
}
