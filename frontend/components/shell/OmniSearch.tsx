"use client"

import { Search } from "lucide-react"

export function OmniSearch() {
  return (
    <button
      type="button"
      className="hidden h-10 min-w-[320px] items-center gap-3 rounded-md border border-[var(--glass-stroke)] bg-white/[0.03] px-3 text-left text-sm text-[var(--text-md)] transition hover:border-[var(--acea-cyan)] md:flex"
      aria-label="OmniSearch"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1">Search segments, tanks, DMAs, audit rows</span>
      <span className="font-[var(--font-jetbrains)] text-xs text-[var(--text-lo)]">⌘K</span>
    </button>
  )
}
