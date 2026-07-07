"use client";

import { PageContainer } from "@fieldos/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/inbox", label: "Inbox" },
  { href: "/action-items", label: "Action Items" },
  { href: "/search", label: "Search" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 md:block">
        <div className="text-lg font-semibold text-slate-950">FieldOS Dashboard</div>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              }
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
          href="/logout"
        >
          Log out
        </Link>
      </aside>
      <div className="md:pl-64">
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
