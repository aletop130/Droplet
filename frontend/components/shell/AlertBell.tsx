"use client"

import { Bell } from "lucide-react"

import { Button } from "@/components/ui/Button"

export function AlertBell() {
  return (
    <Button variant="glass" size="icon" aria-label="Alerts" title="Alerts">
      <span className="relative">
        <Bell className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--phi-red)]" />
      </span>
    </Button>
  )
}
