// components/ui/section-divider.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  variant?: "line" | "gradient" | "dashed";
}

export function SectionDivider({
  className,
  label,
  variant = "line",
  ...props
}: SectionDividerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 py-4",
        variant === "gradient" && "bg-gradient-to-r from-primary/10 to-transparent rounded-xl px-4",
        className
      )}
      {...props}
    >
      {label ? (
        <>
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            {label}
          </span>
          <div
            className={cn(
              "flex-1 h-px",
              variant === "dashed" ? "border-t border-dashed border-gray-200" : "bg-gray-200",
              variant === "gradient" && "bg-gradient-to-r from-primary/30 to-transparent"
            )}
          />
        </>
      ) : (
        <div
          className={cn(
            "w-full h-px",
            variant === "dashed" ? "border-t border-dashed border-gray-200" : "bg-gray-200",
            variant === "gradient" && "bg-gradient-to-r from-primary/30 to-transparent"
          )}
        />
      )}
    </div>
  );
}