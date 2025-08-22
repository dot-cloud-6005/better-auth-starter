"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Map as MapIcon, HardDrive, Wrench, BarChartBig, Settings2, Home, Truck, ListChecks } from "lucide-react";
import React from "react";
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
  | "list"; // Inspections route

const icons: Record<IconName, React.ComponentType<{ className?: string }>> = {
  home: Home,
  map: MapIcon,
  storage: HardDrive,
  equipment: Wrench,
  analytics: BarChartBig,
  admin: Settings2,
  superAdmin: Settings2,
  truck: Truck,
  list: ListChecks,
};

export interface MenuRoute {
  href: string;
  label: string;
  icon: IconName;
}

export function MenuRoutes({ routes }: { routes: MenuRoute[] }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-2">
      {routes.map((r) => {
        const isActive = pathname === r.href || pathname?.startsWith(r.href + "/");
        const Icon = icons[r.icon] || MapIcon;
        return (
          <DialogClose asChild key={r.href}>
            <Link
              href={r.href}
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
                <div className="text-sm font-medium">{r.label}</div>
              </div>
              <ChevronRight
                className={
                  "h-4 w-4 " + (isActive ? "text-foreground" : "text-gray-400 group-hover:text-gray-600 dark:text-neutral-500")
                }
              />
            </Link>
          </DialogClose>
        );
      })}
    </nav>
  );
}
