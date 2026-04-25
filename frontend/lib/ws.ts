import { WS_BASE } from "@/lib/api"

export type AlertEvent = {
  type: string
  ts?: string
  payload?: Record<string, unknown>
  entity_type?: string
  entity_id?: number
  severity?: number
  title?: string
}

type Listener = (event: AlertEvent) => void
type StatusListener = (status: "connecting" | "open" | "closed") => void

let socket: WebSocket | null = null
let reconnectMs = 1000
let reconnectTimer: number | null = null
const listeners = new Set<Listener>()
const statusListeners = new Set<StatusListener>()

function notifyStatus(status: "connecting" | "open" | "closed") {
  statusListeners.forEach((listener) => listener(status))
}

function scheduleReconnect() {
  if (typeof window === "undefined" || reconnectTimer !== null) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectAlerts()
  }, reconnectMs)
  reconnectMs = Math.min(reconnectMs * 2, 30000)
}

export function connectAlerts() {
  if (typeof window === "undefined") return
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  notifyStatus("connecting")
  socket = new WebSocket(`${WS_BASE}/ws/alerts`)

  socket.onopen = () => {
    reconnectMs = 1000
    notifyStatus("open")
  }

  socket.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as AlertEvent
      listeners.forEach((listener) => listener(event))
    } catch {
      // Ignore malformed ws frames.
    }
  }

  socket.onclose = () => {
    notifyStatus("closed")
    socket = null
    scheduleReconnect()
  }

  socket.onerror = () => {
    socket?.close()
  }
}

export function subscribeAlerts(listener: Listener, onStatus?: StatusListener) {
  listeners.add(listener)
  if (onStatus) statusListeners.add(onStatus)
  connectAlerts()

  return () => {
    listeners.delete(listener)
    if (onStatus) statusListeners.delete(onStatus)
  }
}
