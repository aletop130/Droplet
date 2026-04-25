"use client"

import Link from "next/link"
import Image from "next/image"
import { LogOut } from "lucide-react"

import { AlertBell } from "@/components/shell/AlertBell"
import { Button } from "@/components/ui/Button"
type TopBarProps = {
  user: string
  onLogout: () => void
}

export function TopBar({ user, onLogout }: TopBarProps) {
  const displayUser = user.trim().toLowerCase() === "operator" ? "Aldini" : user

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 lg:px-5">
      <div className="pointer-events-auto glass-panel flex h-16 items-center justify-between rounded-[1.6rem] px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/app" className="flex min-w-0 items-center">
            <Image src="/droplet-logo.svg" alt="Droplet" width={152} height={32} priority className="h-7 w-auto" />
          </Link>
        </div>

        <div className="hidden flex-1 xl:block" />

        <div className="flex items-center gap-2">
          <div className="hidden xl:block">
            <div className="rounded-full border border-[rgba(173,218,255,0.16)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-data text-[var(--text-md)]">
              <span className="text-[var(--text-lo)]">Operator:</span>{" "}
              <span className="text-[var(--text-hi)]">{displayUser}</span>
            </div>
          </div>
          <AlertBell />
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
