"use client"

import { useEffect } from "react"

import { useDataStore } from "@/store/dataStore"

export function DataBootstrapper() {
  const fetchCore = useDataStore((state) => state.fetchCore)

  useEffect(() => {
    void fetchCore()
  }, [fetchCore])

  return null
}
