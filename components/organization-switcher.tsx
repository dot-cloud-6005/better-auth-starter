"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Organization } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

interface OrganizationSwitcherProps {
  organizations: Organization[];
}

export function OrganizationSwitcher({
  organizations,
}: OrganizationSwitcherProps) {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const router = useRouter();
  const pathname = usePathname();

  const handleChangeOrganization = async (organizationId: string) => {
    try {
      const { error } = await authClient.organization.setActive({
        organizationId,
      });

      if (error) {
        console.error(error);
        toast.error("Failed to switch organization");
        return;
      }

      const target = organizations.find((o) => o.id === organizationId);
      // Update URL to the same subpath but with the new slug
      if (target?.slug && pathname) {
        const nextPath = pathname.replace(/^\/[\w-]+/, `/${target.slug}`);
        router.push(nextPath);
      } else {
        router.refresh();
      }
      toast.success("Organization switched successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to switch organization");
    }
  };

  return (
    <Select
      onValueChange={handleChangeOrganization}
      value={activeOrganization?.id}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Organisation" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((organization) => (
          <SelectItem key={organization.id} value={organization.id}>
            {organization.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
