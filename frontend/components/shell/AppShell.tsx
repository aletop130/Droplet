"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { AgentChat } from "@/components/chat/AgentChat"
import { SideNav } from "@/components/shell/SideNav"
import { TopBar } from "@/components/shell/TopBar"
import { clearSession, readSession, type DropletSession } from "@/lib/mockAuth"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<DropletSession | null>(null)
  const [checked, setChecked] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const activeSession = readSession()
    if (!activeSession) {
      router.replace("/login")
      return
    }
    setSession(activeSession)
    setChecked(true)
  }, [router])

  function logout() {
    clearSession()
    router.replace("/login")
  }

  if (!checked || !session) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[var(--text-md)]">
        Checking operator session...
      </main>
    )
  }

  return (
    <div className="flex min-h-screen overflow-hidden">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={session.user} onLogout={logout} onToggleChat={() => setChatOpen((open) => !open)} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
      <AgentChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
