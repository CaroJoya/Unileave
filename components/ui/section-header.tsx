// components/ui/section-header.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "gradient" | "minimal";
}

export function SectionHeader({
  className,
  title,
  subtitle,
  icon,
  action,
  variant = "default",
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        variant === "gradient" && "bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-4 -mx-2",
        variant === "minimal" && "border-b border-gray-100 pb-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}