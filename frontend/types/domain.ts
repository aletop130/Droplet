export type SegmentFeature = {
  type: "Feature"
  geometry: {
    type: "LineString"
    coordinates: [number, number][]
  }
  properties: {
    id: number
    dma_id: number
    phi: 0 | 1 | 2 | 3
    subsidence: number
    ndvi: number
    thermal: number
    hydraulic: number
    tank_signal: number
    material: string
    diameter_mm: number
  }
}

export type SegmentFeatureCollection = {
  type: "FeatureCollection"
  features: SegmentFeature[]
}

export type TankFeature = {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    id: number
    name: string
    headroom_pct: number
    severity: 0 | 1 | 2 | 3
    capacity_m3?: number
    dma_id?: number | null
    data_source?: string
  }
}

export type TankFeatureCollection = {
  type: "FeatureCollection"
  features: TankFeature[]
}
