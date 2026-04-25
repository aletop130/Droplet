"use client"

import { create } from "zustand"

import { clearSession, createSession, readSession, type DropletSession } from "@/lib/mockAuth"

type SessionState = {
  session: DropletSession | null
  hydrated: boolean
  hydrate: () => void
  signIn: (username: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  hydrated: false,
  hydrate: () => set({ session: readSession(), hydrated: true }),
  signIn: (username) => set({ session: createSession(username), hydrated: true }),
  signOut: () => {
    clearSession()
    set({ session: null, hydrated: true })
  }
}))
