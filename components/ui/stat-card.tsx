// components/ui/stat-card.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    direction: "up" | "down" | "neutral";
  };
  color?: "primary" | "teal" | "amber" | "green" | "red" | "purple" | "blue";
}

const colorConfigs = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    iconBg: "bg-primary/20",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    border: "border-teal-200",
    iconBg: "bg-teal-100",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    border: "border-green-200",
    iconBg: "bg-green-100",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    iconBg: "bg-red-100",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
    iconBg: "bg-purple-100",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
  },
};

export function StatCard({
  className,
  label,
  value,
  icon,
  trend,
  color = "primary",
  ...props
}: StatCardProps) {
  const colors = colorConfigs[color];

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-0",
        className
      )}
      {...props}
    >
      <CardContent className="pt-6 relative">
        {/* Accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bg}`} />
        
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
            
            {trend && (
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.direction === "up" && "text-green-600",
                    trend.direction === "down" && "text-red-600",
                    trend.direction === "neutral" && "text-muted-foreground"
                  )}
                >
                  {trend.direction === "up" && "↑"}
                  {trend.direction === "down" && "↓"}
                  {trend.direction === "neutral" && "→"}
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          
          {icon && (
            <div className={cn("p-2.5 rounded-lg", colors.iconBg, colors.text)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}