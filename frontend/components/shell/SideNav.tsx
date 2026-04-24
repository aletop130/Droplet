"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  Map,
  Settings,
  ShieldCheck,
  Waves,
  Workflow
} from "lucide-react"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/app", label: "Mission Control", icon: Gauge },
  { href: "/app/map", label: "Map", icon: Map },
  { href: "/app/segment/1482", label: "Segment", icon: Activity },
  { href: "/app/tank/3", label: "Tank", icon: Database },
  { href: "/app/dma/1", label: "DMA", icon: Workflow },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/app/source", label: "Source", icon: Waves },
  { href: "/app/audit", label: "Audit", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings }
]

export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-[76px] shrink-0 border-r border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.72)] px-3 py-4 backdrop-blur-[var(--blur-glass)] lg:block">
      <nav className="grid gap-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.href === "/app" ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "grid h-11 place-items-center rounded-md border border-transparent text-[var(--text-md)] transition hover:border-[var(--glass-stroke)] hover:bg-white/[0.04] hover:text-[var(--text-hi)]",
                active && "border-[rgba(34,207,255,0.34)] bg-[rgba(34,207,255,0.1)] text-[var(--acea-cyan)]"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
