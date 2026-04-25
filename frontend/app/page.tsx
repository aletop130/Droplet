import Link from "next/link"
import Image from "next/image"

export default function LandingPage() {
  return (
    <main className="min-h-screen px-5 py-5">
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] gap-8">
        <nav className="glass-panel flex h-16 items-center justify-between rounded-[1.8rem] px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(10,92,168,0.14)] bg-[rgba(255,255,255,0.62)]">
              <Image src="/droplet-mark.svg" alt="" width={27} height={27} priority />
            </div>
            <div>
              <Image src="/droplet-logo.svg" alt="Droplet" width={154} height={33} priority className="h-7 w-auto" />
              <div className="text-data text-[var(--text-lo)]">CASSINI Hackathon #11</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="liquid-button inline-flex h-11 items-center rounded-2xl px-4 text-sm text-[var(--acea-ice)]">
              Enter platform
            </Link>
          </div>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-4xl py-8">
            <div className="text-data text-[var(--acea-cyan)]">Pilot: Ciociaria, NRW 69.5%.</div>
            <h1 className="text-h1 mt-4">Water security, satellite intelligence, traceable decisions.</h1>
            <p className="text-body mt-6 max-w-2xl">
              Droplet combines satellite monitoring, a hydraulic digital twin, and an auditable agent to guide network operations with mandatory human-in-the-loop review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="liquid-button inline-flex h-12 items-center rounded-2xl px-5 text-sm text-[var(--acea-ice)]">
                Enter platform
              </Link>
              <a href="#architecture" className="glass-card inline-flex h-12 items-center rounded-2xl px-5 text-sm text-[var(--text-hi)]">
                View architecture
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["AI Act Art.13", "GDPR", "EU-sovereign", "Human-in-the-loop"].map((item) => (
                <span key={item} className="rounded-full border border-[rgba(173,218,255,0.14)] px-3 py-1 text-data text-[var(--text-md)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel relative min-h-[480px] rounded-[2rem] p-6">
            <div className="absolute left-10 top-10 h-24 w-24 animate-[floaty_6s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(75,214,255,0.48),rgba(75,214,255,0.08)_55%,transparent_70%)]" />
            <div className="absolute right-14 top-20 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(68,215,192,0.32),transparent_68%)]" />
            <div className="relative grid h-full content-between">
              <div className="flex items-center justify-between">
                <div className="text-data text-[var(--text-lo)]">Operational twin</div>
                <div className="text-data text-[var(--acea-cyan)]">live</div>
              </div>
              <div className="grid place-items-center">
                <Image src="/droplet-mark.svg" alt="Droplet" width={240} height={240} priority className="h-[15rem] w-[15rem]" />
              </div>
              <div className="grid gap-3">
                {[
                  ["Detect", "Copernicus + anomaly fusion"],
                  ["Explain", "Regolo AI with audit trail"],
                  ["Trace", "operator approval mandatory"]
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                    <div className="text-sm text-[var(--text-hi)]">{title}</div>
                    <div className="mt-1 text-sm text-[var(--text-md)]">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4">
          <div className="overflow-hidden rounded-[1.8rem] border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 text-data text-[var(--text-lo)]">Data sources</div>
            <div className="flex flex-wrap gap-2">
              {["ESA", "Copernicus", "Galileo", "NASA", "ISTAT", "ARERA", "OSM", "Qdrant", "Neo4j", "Supabase", "HF Spaces", "Vercel", "Regolo"].map((item) => (
                <span key={item} className="rounded-full border border-[rgba(173,218,255,0.14)] px-3 py-1 text-data text-[var(--text-md)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div id="architecture" className="glass-panel rounded-[1.8rem] p-5">
            <div className="text-sm text-[var(--text-hi)]">Architecture snapshot</div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {["Satellite + signals", "Hydraulic twin", "FastAPI backend", "Next.js frontend"].map((item) => (
                <div key={item} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-md)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
