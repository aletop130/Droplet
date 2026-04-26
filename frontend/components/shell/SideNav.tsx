"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  Droplet,
  Layers,
  LayoutDashboard,
  Map,
  Satellite,
  Settings
} from "lucide-react"

import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/app", label: "Mission Control", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/app/map", label: "Map", icon: Map },
  { href: "/app/copernicus", label: "Copernicus Data", shortLabel: "Data", icon: Satellite },
  { href: "/app/ceccano", label: "Ceccano", icon: Droplet },
  { href: "/app/chat", label: "AI Chat", shortLabel: "Chat", icon: Bot },
  { href: "/app/dma/4", label: "Service areas", shortLabel: "Areas", icon: Layers },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/app/settings", label: "Settings", icon: Settings }
]

function isActivePath(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname.startsWith(href.replace(/\/\d+$/, ""))
}

export function SideNav() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "pointer-events-none fixed bottom-4 left-3 top-24 z-30 hidden transition-all duration-300 lg:block",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("pointer-events-auto glass-panel flex h-full flex-col rounded-[1.8rem] p-3", collapsed && "items-center px-2")}>
        <div className={cn("mb-3 flex items-center justify-between", collapsed && "justify-center")}>
          {!collapsed ? <div className="text-data text-[var(--text-lo)]">Navigation</div> : <div className="font-semibold text-[var(--text-lo)]" />}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.03)] text-[var(--text-lo)] transition hover:text-[var(--text-hi)]"
          >
            <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
          </button>
        </div>

        <nav className={cn("grid gap-2", collapsed && "justify-items-center")}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex h-12 items-center gap-3 rounded-2xl border border-transparent px-3 text-sm text-[var(--text-md)] transition hover:border-[rgba(75,214,255,0.12)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-hi)]",
                  collapsed && "w-12 justify-center gap-0 px-0",
                  active && "bg-[rgba(75,214,255,0.08)] text-[var(--acea-ice)]"
                )}
              >
                <span
                  className={cn(
                    "absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-transparent",
                    collapsed && "-left-2",
                    active && "bg-[linear-gradient(180deg,var(--acea-cyan),var(--acea-teal))]"
                  )}
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)]">
                  <Icon className="h-4 w-4" />
                </span>
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            )
          })}
        </nav>

        
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-2 bottom-3 z-50 lg:hidden">
      <div className="glass-panel mx-auto flex max-w-xl items-center gap-1 overflow-x-auto rounded-[1.4rem] p-1.5 shadow-[0_18px_46px_rgba(8,53,107,0.18)]">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActivePath(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 text-[11px] font-medium text-[var(--text-md)] transition",
                active
                  ? "bg-[rgba(75,214,255,0.14)] text-[var(--acea-blue)]"
                  : "hover:bg-[rgba(8,53,107,0.05)] hover:text-[var(--text-hi)]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
