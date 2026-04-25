import Link from "next/link"
import Image from "next/image"

const team = [
  {
    name: "Francesco Massa",
    role: "Infrastructure and Design",
    image: "/team/francesco-massa.jpeg",
    summary:
      "R&D intern at Seeweb and MSR Brick Architect, focused on agentic infrastructure, ontologies, and production-grade AI workflows.",
    bullets: [
      "Winner, NASA Space Apps Challenge Rome 2023 with FireSpy and 2024 with EmiScan.",
      "Winner, Entering the Global Market with AI by Seeweb, SACE, and Codemotion with PageAI.",
      "Finalist at DigithON 2024 with GrowMate, selected from 2,300+ candidates."
    ]
  },
  {
    name: "Alessandro Aldini",
    role: "Solution Architect and Team Leader",
    image: "/team/alessandro-aldini.jpeg",
    summary:
      "High school student, former Humans intern, and Acea collaborator, building AI products that connect data, automation, and operational decision support.",
    bullets: [
      "Winner, NASA Space Apps Challenge Rome 2023 and 2024 alongside Francesco Massa.",
      "Creator of ZeroHR, an AI assistant for labor consultants selected for DigithON 2025.",
      "Winner at Codemotion with Lumio, turning applied AI concepts into product prototypes."
    ]
  },
  {
    name: "Romolo Mairelli",
    role: "Marketing Consultant",
    image: "/team/romolo-mairelli.jpeg",
    summary:
      "Strategic investments profile focused on AI in medicine, bringing market positioning, stakeholder access, and project-financing discipline.",
    bullets: [
      "Principal architect and consultant with experience across project management, works direction, and business consulting.",
      "Author on AI, legaltech, and public procurement efficiency for professional audiences.",
      "Builder of public-facing digital products, including the Med Alessia health-assistant app."
    ]
  }
]

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
              <a href="#team" className="liquid-button inline-flex h-12 items-center rounded-2xl px-6 text-sm font-semibold text-[var(--acea-ice)]">
                View Team
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

          <div id="team" className="glass-panel scroll-mt-6 rounded-[1.8rem] p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-data text-[var(--acea-cyan)]">DROPLET's Team</div>
                <h2 className="text-h2 mt-2">Satellite intelligence, AI systems, and water-tech execution.</h2>
              </div>
              <div className="text-data text-[var(--text-lo)]">NASA Space Apps winners in the front line</div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {team.map((member) => (
                <article
                  key={member.name}
                  className="rounded-[1.4rem] border border-[rgba(173,218,255,0.14)] bg-[rgba(255,255,255,0.42)] p-4 shadow-[0_18px_40px_rgba(7,45,91,0.12)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.1rem] border border-[rgba(7,54,101,0.14)] bg-[rgba(255,255,255,0.48)]">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(min-width: 1024px) 31vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xl font-semibold text-[var(--text-hi)]">{member.name}</h3>
                    <div className="mt-1 text-data text-[var(--acea-blue)]">{member.role}</div>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-md)]">{member.summary}</p>
                    <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--text-md)]">
                      {member.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--acea-cyan)]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
