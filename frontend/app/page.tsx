import Link from "next/link"
import Image from "next/image"

export default function LandingPage() {
  return (
    <main className="min-h-screen px-5 py-5">
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] gap-8">
        <nav className="glass-panel flex h-16 items-center justify-between rounded-[1.8rem] px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(75,214,255,0.2)] bg-[rgba(255,255,255,0.03)]">
              <Image src="/droplet-mark.svg" alt="Droplet" width={26} height={26} priority />
            </div>
            <div>
              <div className="text-display text-sm font-semibold text-[var(--acea-ice)]">Droplet</div>
              <div className="text-data text-[var(--text-lo)]">CASSINI Hackathon #11</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="liquid-button inline-flex h-11 items-center rounded-2xl px-4 text-sm text-[var(--acea-ice)]">
              Entra nella piattaforma
            </Link>
          </div>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-4xl py-8">
            <div className="text-data text-[var(--acea-cyan)]">Pilot: Ciociaria, NRW 69.5 %.</div>
            <h1 className="text-h1 mt-4">Sicurezza idrica, intelligenza satellitare, decisioni tracciabili.</h1>
            <p className="text-body mt-6 max-w-2xl">
              Droplet unisce monitoraggio satellitare, digital twin idraulico e agente auditabile per guidare le operazioni di rete con human-in-the-loop obbligatorio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="liquid-button inline-flex h-12 items-center rounded-2xl px-5 text-sm text-[var(--acea-ice)]">
                Entra nella piattaforma
              </Link>
              <a href="#architecture" className="glass-card inline-flex h-12 items-center rounded-2xl px-5 text-sm text-[var(--text-hi)]">
                Vedi architettura
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
                <svg viewBox="0 0 320 320" className="h-[18rem] w-[18rem]">
                  <defs>
                    <linearGradient id="dropStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4bd6ff" />
                      <stop offset="100%" stopColor="#44d7c0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M160 36C133 89 84 132 84 192c0 43 34 76 76 76s76-33 76-76c0-60-49-103-76-156Z"
                    fill="rgba(75,214,255,0.12)"
                    stroke="url(#dropStroke)"
                    strokeWidth="4"
                  />
                </svg>
              </div>
              <div className="grid gap-3">
                {[
                  ["Rileva", "Copernicus + anomaly fusion"],
                  ["Spiega", "Regolo AI with audit trail"],
                  ["Traccia", "operator approval mandatory"]
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
