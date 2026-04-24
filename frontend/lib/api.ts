import type { SegmentFeatureCollection } from "@/types/domain"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://Alessandro0709-Droplet.hf.space"

export async function getSegments(dma = 1): Promise<SegmentFeatureCollection> {
  const response = await fetch(`${API_BASE}/api/segments?dma=${dma}`, {
    headers: { Accept: "application/geo+json, application/json" },
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`HF backend returned ${response.status} for /api/segments`)
  }

  return response.json() as Promise<SegmentFeatureCollection>
}
