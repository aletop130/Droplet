import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/droplet-mark.svg" alt="Droplet" width={40} height={40} priority />
            <span className="font-[var(--font-unbounded)] text-lg tracking-normal text-[var(--text-hi)]">
              Droplet
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-md border border-[var(--glass-stroke)] px-4 py-2 text-sm text-[var(--acea-ice)] transition hover:border-[var(--acea-cyan)]"
          >
            Enter platform
          </Link>
        </nav>
        <div className="grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-4 font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
              Ciociaria pilot · 69.5% NRW
            </p>
            <h1 className="font-[var(--font-unbounded)] text-5xl font-semibold leading-[1.08] tracking-normal text-[var(--text-hi)] md:text-7xl">
              Traceable water intelligence for live network operations.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-md)]">
              Droplet fuses Copernicus observation, Galileo-timed hydraulic simulation and Regolo AI
              explanations into an operational map with mandatory human approval for every control recommendation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md bg-[var(--acea-cyan)] px-5 py-3 text-sm font-semibold text-[var(--bg-0)] transition hover:bg-[var(--acea-ice)]"
              >
                Enter the platform
              </Link>
              <a
                href="#architecture"
                className="rounded-md border border-[var(--glass-stroke)] px-5 py-3 text-sm text-[var(--text-hi)] transition hover:border-[var(--acea-teal)]"
              >
                View architecture
              </a>
            </div>
          </div>
          <div className="glass-panel relative min-h-[360px] overflow-hidden rounded-lg p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,207,255,0.24),transparent_34%),radial-gradient(circle_at_70%_70%,rgba(45,212,191,0.14),transparent_30%)]" />
            <div className="relative grid h-full content-between">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-md)]">
                <span>Pipe Health Index</span>
                <span>Live twin</span>
              </div>
              <div className="grid gap-3">
                {["EGMS subsidence", "S2 NDVI residual", "ECOSTRESS LST", "Hydraulic MNF", "Tank signal"].map(
                  (label, index) => (
                    <div key={label} className="grid grid-cols-[150px_1fr_42px] items-center gap-3 text-sm">
                      <span className="text-[var(--text-md)]">{label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-[var(--acea-cyan)]"
                          style={{ width: `${72 - index * 8}%` }}
                        />
                      </span>
                      <span className="font-[var(--font-jetbrains)] text-[var(--acea-ice)]">{72 - index * 8}%</span>
                    </div>
                  )
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["3", "Red segments"],
                  ["54", "Known tanks"],
                  ["<8s", "AI explain"]
                ].map(([value, label]) => (
                  <div key={label} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <div className="font-[var(--font-unbounded)] text-2xl text-[var(--text-hi)]">{value}</div>
                    <div className="mt-1 text-xs text-[var(--text-md)]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div id="architecture" className="grid gap-3 border-t border-white/10 py-5 text-xs text-[var(--text-md)] md:grid-cols-4">
          {["Copernicus", "Supabase + Qdrant + Neo4j", "HF Spaces FastAPI", "Vercel Next.js"].map((item) => (
            <div key={item} className="rounded-md border border-white/10 px-3 py-2">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
