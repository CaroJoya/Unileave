// components/layout/ResponsiveGrid.tsx
"use client";

import { cn } from "@/lib/utils";

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export function ResponsiveGrid({ children, className, cols = {} }: ResponsiveGridProps) {
  const {
    default: defaultCols = 1,
    sm = 2,
    md = 3,
    lg = 4,
    xl = 4,
  } = cols;
  
  return (
    <div
      className={cn(
        `grid grid-cols-${defaultCols}`,
        sm && `sm:grid-cols-${sm}`,
        md && `md:grid-cols-${md}`,
        lg && `lg:grid-cols-${lg}`,
        xl && `xl:grid-cols-${xl}`,
        "gap-4 md:gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}