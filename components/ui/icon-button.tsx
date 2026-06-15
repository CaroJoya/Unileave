// components/ui/icon-button.tsx
"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";

interface IconButtonProps extends ButtonProps {
  icon: React.ReactNode;
  label: string;
}

export function IconButton({ icon, label, ...props }: IconButtonProps) {
  return (
    <Button aria-label={label} {...props}>
      {icon}
      <span className="sr-only">{label}</span>
    </Button>
  );
}