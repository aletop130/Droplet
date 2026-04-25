"use client"

import Link from "next/link"
import Image from "next/image"
import { Bot, LogOut } from "lucide-react"

import { AlertBell } from "@/components/shell/AlertBell"
import { OmniSearch } from "@/components/shell/OmniSearch"
import { Button } from "@/components/ui/Button"
import { DataBadge } from "@/components/ui/DataBadge"

type TopBarProps = {
  user: string
  onLogout: () => void
  onToggleChat: () => void
}

export function TopBar({ user, onLogout, onToggleChat }: TopBarProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 lg:px-5">
      <div className="pointer-events-auto glass-panel flex h-16 items-center justify-between rounded-[1.6rem] px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/app" className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(75,214,255,0.2)] bg-[rgba(255,255,255,0.04)]">
              <Image src="/droplet-mark.svg" alt="Droplet" width={26} height={26} priority />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="text-display text-sm font-semibold text-[var(--acea-ice)]">Droplet</div>
              <div className="truncate text-xs text-[var(--text-lo)]">Ciociaria operational twin</div>
            </div>
          </Link>
        </div>

        <div className="mx-3 hidden min-w-[280px] flex-1 justify-center xl:flex">
          <OmniSearch />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden xl:block">
            <DataBadge label="operator" value={user} tone="neutral" />
          </div>
          <AlertBell />
          <Button variant="ghost" size="icon" onClick={onToggleChat} aria-label="Regolo AI">
            <Bot className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
