"use client"

import Image from "next/image"
import { Bot, LogOut } from "lucide-react"

import { AlertBell } from "@/components/shell/AlertBell"
import { OmniSearch } from "@/components/shell/OmniSearch"
import { Button } from "@/components/ui/Button"

type TopBarProps = {
  user: string
  onLogout: () => void
  onToggleChat: () => void
}

export function TopBar({ user, onLogout, onToggleChat }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.72)] px-4 backdrop-blur-[var(--blur-glass)]">
      <div className="flex items-center gap-3">
        <Image src="/droplet-mark.svg" alt="Droplet" width={34} height={34} priority />
        <div>
          <div className="font-[var(--font-unbounded)] text-sm font-semibold tracking-normal">Droplet</div>
          <div className="text-xs text-[var(--text-lo)]">Ciociaria operational twin</div>
        </div>
      </div>
      <OmniSearch />
      <div className="flex items-center gap-2">
        <AlertBell />
        <Button variant="glass" size="icon" onClick={onToggleChat} aria-label="Agent chat" title="Agent chat">
          <Bot className="h-4 w-4" />
        </Button>
        <div className="hidden rounded-md border border-[var(--glass-stroke)] px-3 py-2 text-xs text-[var(--text-md)] sm:block">
          {user}
        </div>
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
