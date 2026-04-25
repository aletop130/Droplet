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
  { href: "/app", label: "Mission Control", icon: LayoutDashboard },
  { href: "/app/map", label: "Map", icon: Map },
  { href: "/app/copernicus", label: "Copernicus Data", icon: Satellite },
  { href: "/app/ceccano", label: "Ceccano", icon: Droplet },
  { href: "/app/chat", label: "AI Chat", icon: Bot },
  { href: "/app/dma/4", label: "Service areas", icon: Layers },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/app/settings", label: "Settings", icon: Settings }
]

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
      <div className="pointer-events-auto glass-panel flex h-full flex-col rounded-[1.8rem] p-3">
        <div className="mb-3 flex items-center justify-between">
          {!collapsed ? <div className="text-data text-[var(--text-lo)]">Navigation</div> : <div className="font-semibold text-[var(--text-lo)]" />}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.03)] text-[var(--text-lo)] transition hover:text-[var(--text-hi)]"
          >
            <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="grid gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.href === "/app" ? pathname === item.href : pathname.startsWith(item.href.replace(/\/\d+$/, ""))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex h-12 items-center gap-3 rounded-2xl border border-transparent px-3 text-sm text-[var(--text-md)] transition hover:border-[rgba(75,214,255,0.12)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-hi)]",
                  active && "bg-[rgba(75,214,255,0.08)] text-[var(--acea-ice)]"
                )}
              >
                <span
                  className={cn(
                    "absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-transparent",
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
