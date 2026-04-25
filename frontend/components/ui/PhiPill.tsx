import { cn } from "@/lib/utils"

const phiMap = {
  0: {
    label: "Stabile",
    className: "border-[rgba(16,185,129,0.28)] bg-[rgba(16,185,129,0.12)] text-[var(--phi-green)]"
  },
  1: {
    label: "Attenzione",
    className: "border-[rgba(251,191,36,0.28)] bg-[rgba(251,191,36,0.12)] text-[var(--phi-yellow)]"
  },
  2: {
    label: "Criticità",
    className: "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--phi-orange)]"
  },
  3: {
    label: "Allerta",
    className: "border-[rgba(244,63,94,0.28)] bg-[rgba(244,63,94,0.12)] text-[var(--phi-red)]"
  }
} as const

export function PhiPill({ value }: { value: 0 | 1 | 2 | 3 }) {
  const config = phiMap[value]

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-data", config.className)}>
      PHI {value} · {config.label}
    </span>
  )
}
