"use client";

// S4-4: App layout — header, sidebar, main area

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Search, Clock, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-6">
        <Link
          href="/acts/search"
          className="flex items-center gap-2 font-bold text-blue-700"
        >
          <Scale size={20} />
          <span>LexDiff</span>
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-sm text-slate-500">
          Legal document change tracker
        </span>
      </div>
    </header>
  );
}

const navItems = [
  { href: "/acts/search", label: "Search", icon: Search },
] as const;

function Sidebar({ eli }: { eli?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">
      <nav className="p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === href
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        {eli && (
          <>
            <div className="my-3 border-t border-slate-100 pt-3">
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                Act
              </p>
              <p className="px-3 text-xs text-slate-500 font-mono break-all">
                {eli}
              </p>
            </div>
            <Link
              href={`/acts/${eli}/timeline`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname.endsWith("/timeline")
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Clock size={16} />
              Timeline
            </Link>
            <Link
              href={`/acts/${eli}/diff`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname.endsWith("/diff")
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <GitCompare size={16} />
              Diff
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  eli?: string;
}

export function AppLayout({ children, eli }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar eli={eli} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
