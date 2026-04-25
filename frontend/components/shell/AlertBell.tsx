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
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label="Alerts">
        <span className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--phi-red)] px-1 text-[10px] font-semibold text-white">
              {Math.min(unreadCount, 99)}
            </span>
          ) : null}
        </span>
      </Button>

      {open ? (
        <div className="glass-panel absolute right-0 top-14 w-[22rem] rounded-[1.5rem] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-[var(--text-hi)]">Live alerts</div>
            <div className="flex items-center gap-1 text-data text-[var(--text-lo)]">
              <Radio className={`h-3 w-3 ${wsStatus === "open" ? "text-[var(--phi-green)]" : "text-[var(--phi-red)]"}`} />
              {wsStatus}
            </div>
          </div>

          <div className="app-scroll grid max-h-[28rem] gap-2 overflow-y-auto">
            {events.slice(0, 10).map((event, index) => (
              <button
                key={`${event.type}-${event.ts ?? index}`}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (event.entity_type === "tank" && event.entity_id) router.push(`/app/tank/${event.entity_id}`)
                  else if (event.entity_type === "segment" && event.entity_id) router.push(`/app/segment/${event.entity_id}`)
                  else if (event.entity_type === "dma" && event.entity_id) router.push(`/app/dma/${event.entity_id}`)
                  else router.push("/app/incidents")
                }}
                className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-3 text-left transition hover:border-[rgba(75,214,255,0.22)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--text-hi)]">{event.title ?? event.type}</div>
                  <div className="text-data text-[var(--text-lo)]">{event.ts ? new Date(event.ts).toLocaleTimeString("it-IT") : "live"}</div>
                </div>
                <div className="mt-1 text-sm text-[var(--text-md)]">
                  {event.entity_type ? `${event.entity_type} ${event.entity_id ?? ""}` : "Digital twin event"}
                </div>
              </button>
            ))}

            {events.length === 0 ? <div className="text-sm text-[var(--text-lo)]">Nessun evento ricevuto.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
