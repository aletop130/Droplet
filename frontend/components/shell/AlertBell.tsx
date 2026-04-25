"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Radio } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { subscribeAlerts } from "@/lib/ws"
import { useAlertsStore } from "@/store/alertsStore"

export function AlertBell() {
  const router = useRouter()
  const { events, unreadCount, pushEvent, markRead, wsStatus, setStatus } = useAlertsStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return subscribeAlerts(pushEvent, setStatus)
  }, [pushEvent, setStatus])

  useEffect(() => {
    if (open) markRead()
  }, [markRead, open])

  return (
    <Button variant="ghost" size="icon" onClick={() => router.push("/app/incidents")} aria-label="Alerts">
      <Bell className="h-4 w-4" />
    </Button>
  )
}
