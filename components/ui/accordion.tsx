"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AccordionType = "single" | "multiple";

type AccordionContextType = {
  type: AccordionType;
  collapsible?: boolean;
  openValues: string[];
  toggle: (value: string) => void;
};

const AccordionCtx = React.createContext<AccordionContextType | null>(null);

export function Accordion({
  type = "single",
  collapsible = true,
  className,
  children,
}: React.PropsWithChildren<{ type?: AccordionType; collapsible?: boolean; className?: string }>) {
  const [openValues, setOpenValues] = React.useState<string[]>([]);

  const toggle = React.useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const isOpen = prev.includes(value);
        if (type === "multiple") {
          if (isOpen) return prev.filter((v) => v !== value);
          return [...prev, value];
        }
        // single
        if (isOpen) return collapsible ? [] : prev;
        return [value];
      });
    },
    [type, collapsible]
  );

  return (
    <AccordionCtx.Provider value={{ type, collapsible, openValues, toggle }}>
      <div className={cn("divide-y rounded-md border", className)}>{children}</div>
    </AccordionCtx.Provider>
  );
}

export function AccordionItem({ value, children }: React.PropsWithChildren<{ value: string }>) {
  return <div data-accordion-item={value}>{children}</div>;
}

export function AccordionTrigger({ value, className, children }: React.PropsWithChildren<{ value?: string; className?: string }>) {
  const ctx = React.useContext(AccordionCtx);
  if (!ctx) return null;
  const v = value ?? (typeof children === "string" ? children : "");
  const isOpen = ctx.openValues.includes(v);
  return (
    <button
      type="button"
      onClick={() => ctx.toggle(v)}
      className={cn(
        "w-full px-3 py-2 text-sm font-medium flex items-center justify-between hover:bg-muted/50",
        className
      )}
      aria-expanded={isOpen}
      aria-controls={`content-${v}`}
    >
  {children}
      <svg
        className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

export function AccordionContent({ value, children }: React.PropsWithChildren<{ value?: string }>) {
  const ctx = React.useContext(AccordionCtx);
  if (!ctx) return null;
  const v = value ?? "";
  const isOpen = ctx.openValues.includes(v);
  return (
    <div id={`content-${v}`} hidden={!isOpen} className="px-3 py-2">
      {children}
    </div>
  );
}
