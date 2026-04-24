import type { SegmentFeatureCollection, TankFeature } from "@/types/domain"

export const sampleSegments: SegmentFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [13.33, 41.64],
          [13.39, 41.66],
          [13.45, 41.67]
        ]
      },
      properties: {
        id: 1482,
        dma_id: 1,
        phi: 3,
        subsidence: 0.82,
        ndvi: 0.64,
        thermal: 0.74,
        hydraulic: 0.88,
        tank_signal: 0.79,
        material: "grey cast iron",
        diameter_mm: 250
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [13.45, 41.67],
          [13.5, 41.68],
          [13.56, 41.69]
        ]
      },
      properties: {
        id: 1483,
        dma_id: 1,
        phi: 2,
        subsidence: 0.55,
        ndvi: 0.5,
        thermal: 0.59,
        hydraulic: 0.67,
        tank_signal: 0.61,
        material: "ductile iron",
        diameter_mm: 300
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [13.34, 41.58],
          [13.42, 41.57],
          [13.51, 41.6]
        ]
      },
      properties: {
        id: 1501,
        dma_id: 2,
        phi: 1,
        subsidence: 0.22,
        ndvi: 0.35,
        thermal: 0.28,
        hydraulic: 0.31,
        tank_signal: 0.18,
        material: "steel",
        diameter_mm: 180
      }
    }
  ]
}

export const sampleTanks: TankFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.43, 41.67] },
    properties: { id: 3, name: "TK-03", headroom_pct: 31, severity: 3 }
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.55, 41.69] },
    properties: { id: 5, name: "TK-05", headroom_pct: 63, severity: 1 }
  }
]
