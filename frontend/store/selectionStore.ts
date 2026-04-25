"use client"

import { create } from "zustand"

type SelectionState = {
  activeSegment: number | null
  activeTank: number | null
  activeDMA: number | null
  activeRoute: string
  mapFocus: { longitude: number; latitude: number; zoom?: number } | null
  setActiveSegment: (id: number | null) => void
  setActiveTank: (id: number | null) => void
  setActiveDMA: (id: number | null) => void
  setActiveRoute: (route: string) => void
  setMapFocus: (focus: { longitude: number; latitude: number; zoom?: number } | null) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  activeSegment: null,
  activeTank: null,
  activeDMA: null,
  activeRoute: "/",
  mapFocus: null,
  setActiveSegment: (id) => set({ activeSegment: id, activeTank: null, activeDMA: null }),
  setActiveTank: (id) => set({ activeTank: id, activeSegment: null, activeDMA: null }),
  setActiveDMA: (id) => set({ activeDMA: id, activeTank: null, activeSegment: null }),
  setActiveRoute: (route) => set({ activeRoute: route }),
  setMapFocus: (focus) => set({ mapFocus: focus }),
  clearSelection: () => set({ activeSegment: null, activeTank: null, activeDMA: null })
}))
