"use client"

import { create } from "zustand"

import { clearSession, createSession, readSession, type DropletSession } from "@/lib/mockAuth"

type SessionState = {
  session: DropletSession | null
  hydrate: () => void
  signIn: (username: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  hydrate: () => set({ session: readSession() }),
  signIn: (username) => set({ session: createSession(username) }),
  signOut: () => {
    clearSession()
    set({ session: null })
  }
}))
