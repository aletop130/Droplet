"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"

import { SideNav } from "@/components/shell/SideNav"
import { TopBar } from "@/components/shell/TopBar"
import { useChatStore } from "@/store/chatStore"
import { useSelectionStore } from "@/store/selectionStore"
import { useSessionStore } from "@/store/sessionStore"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, hydrate, signOut } = useSessionStore()
  const setActiveRoute = useSelectionStore((state) => state.setActiveRoute)
  const setPageContext = useChatStore((state) => state.setPageContext)
  const activeSegment = useSelectionStore((state) => state.activeSegment)
  const activeTank = useSelectionStore((state) => state.activeTank)
  const activeDMA = useSelectionStore((state) => state.activeDMA)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    setActiveRoute(pathname)
    const entityType = activeSegment ? "segment" : activeTank ? "tank" : activeDMA ? "dma" : null
    const entityId = activeSegment ?? activeTank ?? activeDMA ?? null
    setPageContext({ route: pathname, entity_type: entityType, entity_id: entityId })
  }, [activeDMA, activeSegment, activeTank, pathname, setActiveRoute, setPageContext])

  const isMapRoute = useMemo(() => pathname.startsWith("/app/map"), [pathname])

  useEffect(() => {
    if (session === null) {
      const timer = window.setTimeout(() => {
        router.replace("/login")
      }, 120)
      return () => window.clearTimeout(timer)
    }
  }, [router, session])

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[var(--text-md)]">
        Checking operator session...
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      <TopBar user={session.user} onLogout={() => { signOut(); router.replace("/login") }} />
      <SideNav />
      <main
        className={
          isMapRoute
            ? "relative min-h-screen"
            : "relative min-h-screen px-4 pb-8 pt-24 lg:pl-[17.5rem] lg:pr-6"
        }
      >
        {children}
      </main>
    </div>
  )
}
