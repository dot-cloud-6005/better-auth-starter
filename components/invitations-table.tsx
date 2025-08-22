"use client";

import { Button } from "@/components/ui/button";
import { revokeInvitation, resendInvitation } from "@/server/organizations";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateToDDMMYYYY } from "@/lib/utils";

interface InvitationRow {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string | null;
}

export default function InvitationsTable({ invitations }: { invitations: InvitationRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
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

  const handleResend = async (id: string) => {
    try {
      setResendingId(id);
      const { success, error } = await resendInvitation(id);
      if (!success) {
        toast.error(error || "Failed to resend invitation");
        return;
      }
      toast.success("Invitation resent");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  };

  if (!invitations?.length) {
  return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
    <div key={inv.id} className="flex items-center justify-between border rounded-md p-3 bg-background">
          <div className="flex flex-col">
      <span className="font-medium text-foreground">{inv.email}</span>
      <span className="text-xs text-muted-foreground">
              {inv.role || "member"} · {inv.status}
              {inv.expiresAt && ` · expires ${formatDateToDDMMYYYY(inv.expiresAt)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleResend(inv.id)}
              disabled={resendingId === inv.id}
            >
              {resendingId === inv.id ? <Loader2 className="size-4 animate-spin" /> : "Resend"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleRevoke(inv.id)}
              disabled={loadingId === inv.id}
            >
              {loadingId === inv.id ? <Loader2 className="size-4 animate-spin" /> : "Revoke"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
