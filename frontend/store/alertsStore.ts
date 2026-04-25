"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { AlertEvent } from "@/lib/ws"

type AlertsState = {
  events: AlertEvent[]
  unreadCount: number
  wsStatus: "connecting" | "open" | "closed"
  pushEvent: (event: AlertEvent) => void
  markRead: () => void
  setStatus: (status: "connecting" | "open" | "closed") => void
}

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set) => ({
      events: [],
      unreadCount: 0,
      wsStatus: "closed",
      pushEvent: (event) =>
        set((state) => ({
          events: [event, ...state.events].slice(0, 50),
          unreadCount: Math.min(state.unreadCount + 1, 99)
        })),
      markRead: () => set({ unreadCount: 0 }),
      setStatus: (status) => set({ wsStatus: status })
    }),
    { name: "droplet-alerts" }
  )
)
