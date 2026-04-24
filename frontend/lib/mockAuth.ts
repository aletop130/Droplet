"use client"

export type DropletSession = {
  user: string
  iat: number
  exp: number
}

const SESSION_KEY = "droplet_session"
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000

export function getMockCredentials() {
  return {
    username: process.env.NEXT_PUBLIC_MOCK_USERNAME ?? "operator",
    password: process.env.NEXT_PUBLIC_MOCK_PASSWORD ?? "droplet-2026"
  }
}

export function createSession(username: string) {
  const now = Date.now()
  const session: DropletSession = {
    user: username,
    iat: now,
    exp: now + EIGHT_HOURS_MS
  }
  window.localStorage.setItem(SESSION_KEY, btoa(JSON.stringify(session)))
  return session
}

export function readSession(): DropletSession | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(atob(raw)) as DropletSession
    if (!session.exp || session.exp <= Date.now()) {
      clearSession()
      return null
    }
    return session
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY)
  }
}

export function validateCredentials(username: string, password: string) {
  const credentials = getMockCredentials()
  return username === credentials.username && password === credentials.password
}
