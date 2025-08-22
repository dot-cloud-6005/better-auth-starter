import { Logout } from "./logout";
import { ModeSwitcher } from "./mode-switcher";
import { OptimizedOrganizationSwitcher } from "./organization-switcher-optimized";
import { getActiveOrganization, getOrganizations } from "@/server/organizations";
import { getOrganizationBySlug } from "@/server/organizations";
import { getCurrentUser, isMasterAdmin } from "@/server/users";
import { Menu, Shield, Building2, User as UserIcon } from "lucide-react";
import { MenuRoutes, type MenuRoute } from "@/components/menu-routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export async function Header() {
  const organizations = await getOrganizations();
  const master = await isMasterAdmin();
  const { currentUser } = await getCurrentUser();
  const activeOrg = await getActiveOrganization(currentUser.id);
  const navMapHref = activeOrg?.slug
    ? `/${activeOrg.slug}/nav-map`
    : organizations[0]?.slug
    ? `/${organizations[0].slug}/nav-map`
  : "/landing";

  // Build allowed org routes based on permissions
  const baseSlug = activeOrg?.slug || organizations[0]?.slug;
  const routes: MenuRoute[] = [];
  if (baseSlug) {
    routes.push({ href: `/${baseSlug}/home`, label: 'Home', icon: 'home' });
    routes.push({ href: `/${baseSlug}/nav-map`, label: 'Navigation Map', icon: 'map' });
    routes.push({ href: `/${baseSlug}/storage`, label: 'Storage', icon: 'storage' });
    routes.push({ href: `/${baseSlug}/plant-equip/plant`, label: 'Plant', icon: 'truck' });
  // Use icon key 'equipment' which maps to the Wrench icon in menu-routes
  routes.push({ href: `/${baseSlug}/plant-equip/equipment`, label: 'Equipment', icon: 'equipment' });
    routes.push({ href: `/${baseSlug}/plant-equip/inspections`, label: 'Inspections', icon: 'list' });
    routes.push({ href: `/${baseSlug}/plant-equip/analytics`, label: 'Analytics', icon: 'analytics' });
    // Only show Admin for org owners/admins
    const orgFull = await getOrganizationBySlug(baseSlug);
    const hasOrgAdminAccess = !!orgFull?.members?.some((m: any) => m.userId === currentUser.id && (m.role === 'owner' || m.role === 'admin'));
    if (hasOrgAdminAccess) {
      routes.push({ href: `/${baseSlug}/admin`, label: 'Admin', icon: 'admin' });
    }
  }
  // Append Super Admin route only for master in the same list to keep spacing consistent
  if (master) {
    routes.push({ href: `/super-admin`, label: 'Super Admin', icon: 'superAdmin' });
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 flex justify-between items-center px-4 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b border-gray-200 dark:border-neutral-800 print:hidden">
      {/* Left: Org switcher (desktop) */}
      <div className="hidden sm:block">
        <OptimizedOrganizationSwitcher organizations={organizations} />
      </div>

      {/* Center spacer/title on mobile */}
      <div className="sm:hidden text-sm font-medium" />

      {/* Right: Theme + Menu (mobile and desktop) */}
      <div className="flex items-center gap-2">
        {/* User badge */}
        {master ? (
          <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
            Master Admin
          </span>
        ) : currentUser?.name ? (
          <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
            {currentUser.name}
          </span>
        ) : null}
        <ModeSwitcher />
        <Dialog>
          {/* Desktop trigger */}
          <DialogTrigger asChild>
            <button
              aria-label="Open menu"
              className="hidden sm:inline-flex items-center justify-center rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2"
            >
              <Menu className="h-5 w-5" />
            </button>
          </DialogTrigger>
          {/* Mobile trigger */}
          <DialogTrigger asChild>
            <button
              aria-label="Open menu"
              className="sm:hidden inline-flex items-center justify-center rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2"
            >
              <Menu className="h-5 w-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-sm p-0 overflow-hidden" showCloseButton>
            <DialogHeader>
              <DialogTitle className="sr-only">Menu</DialogTitle>
            </DialogHeader>
            {/* Menu body */}
            <div className="p-4">
              {/* User/org summary */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{currentUser?.name || currentUser?.email || "User"}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{activeOrg?.name || organizations[0]?.name || "No organization"}</span>
                  </div>
                </div>
                <div className="ml-auto">
                  {master ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200">Master Admin</span>
                  ) : null}
                </div>
              </div>

              {/* Mobile: org switcher */}
              <div className="sm:hidden mb-3">
                <OptimizedOrganizationSwitcher organizations={organizations} />
              </div>

              {/* Nav items */}
              <MenuRoutes routes={routes} />
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-neutral-800 p-4">
              <Logout />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
