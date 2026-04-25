"use client"

import { create } from "zustand"

import {
  getControlRecs,
  getDMABalance,
  getDMAs,
  getIncidents,
  getScarcityForecast,
  getSegment,
  getSegments,
  getSourceAvailability,
  getTank,
  getTanks
} from "@/lib/api"
import type {
  ControlRecommendation,
  DMABalance,
  DMAFeature,
  Incident,
  ScarcityForecast,
  SegmentDetail,
  SegmentFeature,
  SourceAvailability,
  SourceNode,
  TankDetail,
  TankFeature
} from "@/types/domain"

type DataState = {
  segments: SegmentFeature[] | null
  tanks: TankFeature[] | null
  dmas: DMAFeature[] | null
  incidents: Incident[] | null
  sources: SourceNode[] | null
  sourceAvailability: SourceAvailability | null
  controlRecs: ControlRecommendation[] | null
  scarcityForecastByDays: Partial<Record<30 | 60 | 90, ScarcityForecast>>
  segmentDetailsById: Record<number, SegmentDetail>
  tankDetailsById: Record<number, TankDetail>
  dmaBalancesById: Record<number, DMABalance>
  coreLoaded: boolean
  coreLoading: boolean
  fetchCore: (options?: { force?: boolean }) => Promise<void>
  fetchSegmentDetail: (id: number, options?: { force?: boolean }) => Promise<SegmentDetail>
  fetchTankDetail: (id: number, options?: { force?: boolean }) => Promise<TankDetail>
  fetchDmaBalance: (id: number, options?: { force?: boolean }) => Promise<DMABalance>
  fetchScarcityForecast: (days: 30 | 60 | 90, options?: { force?: boolean }) => Promise<ScarcityForecast>
  fetchControlRecs: (options?: { force?: boolean }) => Promise<ControlRecommendation[]>
}

let coreRequest: Promise<void> | null = null
const segmentDetailRequests = new Map<number, Promise<SegmentDetail>>()
const tankDetailRequests = new Map<number, Promise<TankDetail>>()
const dmaBalanceRequests = new Map<number, Promise<DMABalance>>()
const forecastRequests = new Map<30 | 60 | 90, Promise<ScarcityForecast>>()
let controlRecsRequest: Promise<ControlRecommendation[]> | null = null

export const useDataStore = create<DataState>((set, get) => ({
  segments: null,
  tanks: null,
  dmas: null,
  incidents: null,
  sources: null,
  sourceAvailability: null,
  controlRecs: null,
  scarcityForecastByDays: {},
  segmentDetailsById: {},
  tankDetailsById: {},
  dmaBalancesById: {},
  coreLoaded: false,
  coreLoading: false,

  async fetchCore(options) {
    const { force = false } = options ?? {}
    const state = get()
    if (!force && state.coreLoaded && state.segments && state.tanks && state.dmas && state.incidents && state.sources) {
      return
    }
    if (!force && coreRequest) {
      return coreRequest
    }

    set({ coreLoading: true })
    coreRequest = Promise.all([
      getSegments(),
      getTanks(),
      getDMAs(),
      getIncidents(),
      getSourceAvailability()
    ])
      .then(([segments, tanks, dmas, incidents, availability]) => {
        set({
          segments: segments.features,
          tanks: tanks.features,
          dmas,
          incidents: incidents.items,
          sources: availability.sources,
          sourceAvailability: availability,
          coreLoaded: true,
          coreLoading: false
        })
      })
      .catch((error) => {
        set({ coreLoading: false })
        throw error
      })
      .finally(() => {
        coreRequest = null
      })

    return coreRequest
  },

  async fetchSegmentDetail(id, options) {
    const { force = false } = options ?? {}
    const cached = get().segmentDetailsById[id]
    if (!force && cached) return cached
    if (!force && segmentDetailRequests.has(id)) {
      return segmentDetailRequests.get(id)!
    }
    const request = getSegment(id)
      .then((detail) => {
        set((state) => ({
          segmentDetailsById: { ...state.segmentDetailsById, [id]: detail }
        }))
        return detail
      })
      .finally(() => {
        segmentDetailRequests.delete(id)
      })
    segmentDetailRequests.set(id, request)
    return request
  },

  async fetchTankDetail(id, options) {
    const { force = false } = options ?? {}
    const cached = get().tankDetailsById[id]
    if (!force && cached) return cached
    if (!force && tankDetailRequests.has(id)) {
      return tankDetailRequests.get(id)!
    }
    const request = getTank(id)
      .then((detail) => {
        set((state) => ({
          tankDetailsById: { ...state.tankDetailsById, [id]: detail }
        }))
        return detail
      })
      .finally(() => {
        tankDetailRequests.delete(id)
      })
    tankDetailRequests.set(id, request)
    return request
  },

  async fetchDmaBalance(id, options) {
    const { force = false } = options ?? {}
    const cached = get().dmaBalancesById[id]
    if (!force && cached) return cached
    if (!force && dmaBalanceRequests.has(id)) {
      return dmaBalanceRequests.get(id)!
    }
    const request = getDMABalance(id)
      .then((balance) => {
        set((state) => ({
          dmaBalancesById: { ...state.dmaBalancesById, [id]: balance }
        }))
        return balance
      })
      .finally(() => {
        dmaBalanceRequests.delete(id)
      })
    dmaBalanceRequests.set(id, request)
    return request
  },

  async fetchScarcityForecast(days, options) {
    const { force = false } = options ?? {}
    const cached = get().scarcityForecastByDays[days]
    if (!force && cached) return cached
    if (!force && forecastRequests.has(days)) {
      return forecastRequests.get(days)!
    }
    const request = getScarcityForecast(days)
      .then((forecast) => {
        set((state) => ({
          scarcityForecastByDays: { ...state.scarcityForecastByDays, [days]: forecast }
        }))
        return forecast
      })
      .finally(() => {
        forecastRequests.delete(days)
      })
    forecastRequests.set(days, request)
    return request
  },

  async fetchControlRecs(options) {
    const { force = false } = options ?? {}
    const cached = get().controlRecs
    if (!force && cached) return cached
    if (!force && controlRecsRequest) {
      return controlRecsRequest
    }
    controlRecsRequest = getControlRecs()
      .then((items) => {
        set({ controlRecs: items })
        return items
      })
      .finally(() => {
        controlRecsRequest = null
      })
    return controlRecsRequest
  }
}))
