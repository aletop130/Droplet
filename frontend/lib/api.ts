import type { SegmentFeatureCollection, TankFeatureCollection } from "@/types/domain"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://Alessandro0709-Droplet.hf.space"

export async function getSegments(dma?: number): Promise<SegmentFeatureCollection> {
  const url = dma ? `${API_BASE}/api/segments?dma=${dma}` : `${API_BASE}/api/segments`
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`HF backend returned ${response.status} for /api/segments`)
  }

  return response.json() as Promise<SegmentFeatureCollection>
}

export async function getTanks(dma?: number): Promise<TankFeatureCollection> {
  const url = dma ? `${API_BASE}/api/tanks?dma=${dma}` : `${API_BASE}/api/tanks`
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`HF backend returned ${response.status} for /api/tanks`)
  }

  return response.json() as Promise<TankFeatureCollection>
}
