// components/ui/enhanced-card.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva(
  "rounded-xl transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-white border border-gray-100 hover:shadow-lg hover:-translate-y-0.5",
        elevated: "bg-white shadow-md hover:shadow-xl hover:-translate-y-1",
        outline: "bg-transparent border-2 hover:shadow-lg",
        accent: "bg-white border-l-4 hover:shadow-lg hover:-translate-y-0.5",
        gradient: "bg-gradient-to-br from-white to-primary/5 border border-primary/10 hover:shadow-xl hover:-translate-y-1",
      },
      accentColor: {
        primary: "border-l-primary",
        teal: "border-l-teal-500",
        amber: "border-l-amber-500",
        green: "border-l-green-500",
        red: "border-l-red-500",
        purple: "border-l-purple-500",
        blue: "border-l-blue-500",
        none: "border-l-transparent",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      accentColor: "none",
      padding: "default",
    },
  }
);

export interface EnhancedCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant, accentColor, padding, header, footer, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, accentColor, padding }), className)}
        {...props}
      >
        {header && (
          <div className={cn(
            "border-b border-gray-100 pb-4 mb-4",
            padding !== "none" && "px-6 pt-6"
          )}>
            {header}
          </div>
        )}
        <div className={cn(padding === "none" ? "" : "px-6", padding === "none" ? "" : padding === "sm" ? "py-3" : "py-6")}>
          {children}
        </div>
        {footer && (
          <div className={cn(
            "border-t border-gray-100 pt-4 mt-4",
            padding !== "none" && "px-6 pb-6"
          )}>
            {footer}
          </div>
        )}
      </div>
    );
  }
);
EnhancedCard.displayName = "EnhancedCard";

export { EnhancedCard, cardVariants };