"use client";

import React from "react";
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
import { LoaderIcon } from "lucide-react";
import {
  getCachedActiveOrganization,
  cacheActiveOrganization,
  switchOrganizationOptimistic
} from "@/lib/org-cache";

interface OptimizedOrganizationSwitcherProps {
  organizations: Organization[];
}

export function OptimizedOrganizationSwitcher({
  organizations,
}: OptimizedOrganizationSwitcherProps) {
  const [isClient, setIsClient] = React.useState(false);
  const [cachedActiveOrg, setCachedActiveOrg] = React.useState<Organization | null>(null);
  const [switchingState, setSwitchingState] = React.useState({ isSwitching: false, error: null });
  
  // Only run on client side to prevent hydration issues
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const { data: activeOrganization, isPending, error } = authClient.useActiveOrganization();
  const router = useRouter();
  const pathname = usePathname();

  // Cache active organization when it loads
  React.useEffect(() => {
    if (activeOrganization && activeOrganization.id) {
      const orgForCache: Organization = {
        id: activeOrganization.id,
        name: activeOrganization.name,
        slug: activeOrganization.slug || null,
        logo: activeOrganization.logo || null,
        createdAt: activeOrganization.createdAt,
        metadata: activeOrganization.metadata || null,
      };
      
      setCachedActiveOrg(orgForCache);
      // Cache it for faster future access
      cacheActiveOrganization('current-user', orgForCache); // TODO: Get actual user ID
    }
  }, [activeOrganization]);

  // Try to load from cache on mount
  React.useEffect(() => {
    if (!activeOrganization && !isPending) {
      getCachedActiveOrganization('current-user').then(cached => {
        if (cached) {
          setCachedActiveOrg(cached);
        }
      });
    }
  }, [activeOrganization, isPending]);

  // Don't render the hook-dependent parts until we're on the client side
  if (!isClient) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
        <SelectContent>
        </SelectContent>
      </Select>
    );
  }

  // Show cached organization while loading
  const displayOrganization = activeOrganization || cachedActiveOrg;
  const isLoading = isPending && !displayOrganization;

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[180px]">
          <div className="flex items-center space-x-2">
            <LoaderIcon className="h-4 w-4 animate-spin" />
            <SelectValue placeholder="Loading..." />
          </div>
        </SelectTrigger>
        <SelectContent>
        </SelectContent>
      </Select>
    );
  }

  if (error && !displayOrganization) {
    console.error("OrganizationSwitcher error:", error);
    return (
      <Select disabled>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Error loading" />
        </SelectTrigger>
        <SelectContent>
        </SelectContent>
      </Select>
    );
  }

  const handleChangeOrganization = async (organizationId: string) => {
    if (switchingState.isSwitching) {
      return; // Prevent concurrent switches
    }

    const targetOrg = organizations.find((o) => o.id === organizationId);
    if (!targetOrg) {
      toast.error("Organization not found");
      return;
    }

    // Set switching state
    setSwitchingState({ isSwitching: true, error: null });

    try {
      const result = await switchOrganizationOptimistic(
        'current-user', // TODO: Get actual user ID
        targetOrg,
        async () => {
          // Actual switch logic
          const { error } = await authClient.organization.setActive({
            organizationId,
          });

          if (error) {
            console.error(error);
            return { success: false, error: "Failed to switch organisation" };
          }

          return { success: true };
        }
      );

      if (result.success) {
        // Optimistically update the display
        setCachedActiveOrg(targetOrg);
        
        // Update URL to the same subpath but with the new slug
        if (targetOrg?.slug && pathname) {
          const nextPath = pathname.replace(/^\/[\w-]+/, `/${targetOrg.slug}`);
          router.push(nextPath);
        } else {
          router.refresh();
        }
        
        toast.success("Organisation switched successfully");
      } else {
        toast.error(result.error || "Failed to switch organisation");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to switch organisation");
    } finally {
      setSwitchingState({ isSwitching: false, error: null });
    }
  };

  // Get the current value - prefer cached for faster display
  const currentValue = displayOrganization?.id || "";

  return (
    <Select
      onValueChange={handleChangeOrganization}
      value={currentValue}
      disabled={switchingState.isSwitching}
    >
      <SelectTrigger className="w-[180px]">
        {switchingState.isSwitching ? (
          <div className="flex items-center space-x-2 w-full">
            <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="flex-1 truncate">Switching...</span>
          </div>
        ) : (
          <SelectValue placeholder="Select Organisation" />
        )}
      </SelectTrigger>
      <SelectContent>
        {organizations.map((organization) => (
          <SelectItem 
            key={organization.id} 
            value={organization.id}
            disabled={switchingState.isSwitching}
          >
            <div className="flex items-center space-x-2">
              <span>{organization.name}</span>
              {organization.id === currentValue && !switchingState.isSwitching && (
                <span className="text-xs text-muted-foreground">• Active</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Export both for backward compatibility
export { OptimizedOrganizationSwitcher as OrganizationSwitcher };
