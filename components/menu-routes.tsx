"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Map as MapIcon, HardDrive, Wrench, BarChart3, Settings2, Home, Truck, ListChecks, User as UserIcon, BookOpen } from "lucide-react";
import React, { useState } from "react";
import { DialogClose } from "@/components/ui/dialog";

type IconName =
  | "home"
  | "map"
  | "storage"
  | "equipment"
  | "analytics"
  | "admin"
  | "superAdmin"
  | "truck" // Plant route
  | "list" // Inspections route
  | "profile" // User profile / security settings
  | "docs"; // Documentation / help

const icons: Record<IconName, React.ComponentType<{ className?: string }>> = {
  home: Home,
  map: MapIcon,
  storage: HardDrive,
  equipment: Wrench,
  // Replaced BarChartBig (missing in current lucide package) with BarChart3
  analytics: BarChart3,
  admin: Settings2,
  superAdmin: Settings2,
  truck: Truck,
  list: ListChecks,
  profile: UserIcon,
  docs: BookOpen,
};

export interface MenuRoute {
  href: string;
  label: string;
  icon: IconName;
}

export interface MenuGroup {
  label: string;
  icon: IconName;
  routes: MenuRoute[];
  defaultCollapsed?: boolean;
}

export type MenuItem = MenuRoute | MenuGroup;

function isMenuGroup(item: MenuItem): item is MenuGroup {
  return 'routes' in item;
}

export function MenuRoutes({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(items.filter(isMenuGroup).filter(g => g.defaultCollapsed).map(g => g.label))
  );

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  const renderRoute = (route: MenuRoute) => {
    const isActive = pathname === route.href || pathname?.startsWith(route.href + "/");
    const Icon = icons[route.icon] || MapIcon;
    return (
      <DialogClose asChild key={route.href}>
        <Link
          href={route.href}
          className={
            "group flex items-center gap-3 rounded-md border px-3 py-2 transition-colors " +
            (isActive
              ? "border-primary/40 bg-muted hover:bg-muted"
              : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800")
          }
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className={"h-5 w-5 " + (isActive ? "text-foreground" : "text-gray-600 dark:text-gray-300")} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{route.label}</div>
          </div>
          <ChevronRight
            className={
              "h-4 w-4 " + (isActive ? "text-foreground" : "text-gray-400 group-hover:text-gray-600 dark:text-neutral-500")
            }
          />
        </Link>
      </DialogClose>
    );
  };

  return (
    <nav className="grid gap-2">
      {items.map((item) => {
        if (isMenuGroup(item)) {
          const isCollapsed = collapsedGroups.has(item.label);
          const hasActiveRoute = item.routes.some(route => 
            pathname === route.href || pathname?.startsWith(route.href + "/")
          );
          const GroupIcon = icons[item.icon] || MapIcon;
          
          return (
            <div key={item.label} className="space-y-1">
              <button
                onClick={() => toggleGroup(item.label)}
                className={
                  "group flex items-center gap-3 rounded-md border px-3 py-2 transition-colors w-full " +
                  (hasActiveRoute
                    ? "border-primary/40 bg-muted hover:bg-muted"
                    : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800")
                }
              >
                <GroupIcon className={"h-5 w-5 " + (hasActiveRoute ? "text-foreground" : "text-gray-600 dark:text-gray-300")} />
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-medium">{item.label}</div>
                </div>
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-neutral-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-neutral-500" />
                )}
              </button>
              {!isCollapsed && (
                <div className="ml-6 space-y-1">
                  {item.routes.map(renderRoute)}
                </div>
              )}
            </div>
          );
        } else {
          return renderRoute(item);
        }
      })}
    </nav>
  );
}
