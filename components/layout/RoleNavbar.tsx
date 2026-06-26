// components/layout/RoleNavbar.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Role } from "@/types/roles";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface RoleNavbarProps {
  role: Role;
  navItems: NavItem[];
  greeting: string;
  subtitle?: string;
}

export function RoleNavbar({ role, navItems, greeting, subtitle }: RoleNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Get role color for active tab
  const getRoleColor = (role: Role) => {
    const colors: Record<Role, string> = {
      super_admin: "border-purple-500 text-purple-700",
      head_clerk: "border-amber-500 text-amber-700",
      principal: "border-indigo-500 text-indigo-700",
      registrar: "border-emerald-500 text-emerald-700",
      hod: "border-blue-500 text-blue-700",
      faculty: "border-gray-500 text-gray-700",
      lab_assistant: "border-gray-500 text-gray-700",
      office_staff: "border-gray-500 text-gray-700",
    };
    return colors[role] || "border-primary text-primary";
  };

  const roleColor = getRoleColor(role);

  return (
    <div className="space-y-6">
      {/* Greeting Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
        {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
                            (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  "hover:text-gray-900 hover:border-gray-300",
                  isActive
                    ? `${roleColor} border-b-2`
                    : "text-gray-500 border-transparent hover:text-gray-700"
                )}
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}