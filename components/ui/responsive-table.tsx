// components/ui/responsive-table.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ResponsiveTable({ children, className, ...props }: ResponsiveTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)} {...props}>
      <div className="min-w-[640px]">
        {children}
      </div>
    </div>
  );
}

export function ResponsiveTableCell({ 
  children, 
  className,
  dataLabel,
  ...props 
}: React.TdHTMLAttributes<HTMLTableCellElement> & { dataLabel?: string }) {
  return (
    <td 
      className={cn(
        "p-3 align-middle",
        "before:content-[attr(data-label)] before:font-medium before:text-muted-foreground",
        "sm:before:hidden",
        className
      )} 
      data-label={dataLabel}
      {...props}
    >
      {children}
    </td>
  );
}