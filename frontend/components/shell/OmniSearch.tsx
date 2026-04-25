"use client"

import { useDeferredValue, useEffect, useState, type KeyboardEvent } from "react"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { postSearchOmni } from "@/lib/api"
import type { SearchOmniResult } from "@/types/domain"

export function OmniSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [results, setResults] = useState<SearchOmniResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent | globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || deferredQuery.trim().length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    postSearchOmni(deferredQuery)
      .then((items) => {
        if (!cancelled) {
          setResults(items)
          setActiveIndex(0)
        }
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })

    return () => {
      cancelled = true
    }
  }, [deferredQuery, open])

  function go(result: SearchOmniResult) {
    setOpen(false)
    if (result.type === "segment") router.push(`/app/segment/${result.id}`)
    if (result.type === "tank") router.push(`/app/tank/${result.id}`)
    if (result.type === "dma") router.push(`/app/dma/${result.id}`)
    if (result.type === "incident") router.push("/app/incidents")
    if (result.type === "audit") router.push("/app/audit")
  }

  function onResultsKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault()
      go(results[activeIndex])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 min-w-[18rem] items-center gap-3 rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 text-left text-sm text-[var(--text-md)] transition hover:border-[rgba(75,214,255,0.24)]"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">OmniSearch</span>
        <span className="text-data text-[var(--text-lo)]">⌘K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(3,8,18,0.55)] p-4 backdrop-blur-md">
          <div className="glass-panel w-full max-w-2xl rounded-[1.8rem] p-4">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onResultsKeyDown}
              placeholder="Cerca segmenti, tank, DMA, audit"
              className="h-12 w-full rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.7)] px-4 text-[var(--text-hi)] outline-none"
            />
            <div className="app-scroll mt-4 grid max-h-[24rem] gap-2 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => go(result)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    index === activeIndex
                      ? "border-[rgba(75,214,255,0.26)] bg-[rgba(75,214,255,0.08)]"
                      : "border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="text-sm text-[var(--text-hi)]">{result.label}</div>
                  <div className="mt-1 text-data text-[var(--text-lo)]">{result.type}</div>
                </button>
              ))}
              {query.trim().length >= 2 && results.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(173,218,255,0.1)] p-4 text-sm text-[var(--text-lo)]">
                  Nessun risultato.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
