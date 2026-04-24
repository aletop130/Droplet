import { MapClient } from "@/components/map/MapClient"

export default function MapPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Operational Map
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal">
            Live PHI, tanks and incident context
          </h1>
        </div>
      </section>
      <MapClient />
    </div>
  )
}
