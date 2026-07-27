// components/layout/EnhancedPageLayout.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface EnhancedPageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function EnhancedPageLayout({
  className,
  title,
  subtitle,
  actions,
  children,
  ...props
}: EnhancedPageLayoutProps) {
  return (
    <div className={cn("container mx-auto py-8 px-4 max-w-7xl", className)} {...props}>
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1.5 text-base">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>

      {/* Page Content */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}