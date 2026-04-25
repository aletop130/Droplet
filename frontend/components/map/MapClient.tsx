"use client"

import dynamic from "next/dynamic"

const DeckMap = dynamic(() => import("@/components/map/DeckMap").then((module) => module.DeckMap), {
  ssr: false
})

export function MapClient() {
  return <DeckMap />
}
