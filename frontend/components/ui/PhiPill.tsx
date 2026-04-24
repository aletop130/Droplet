import { cn } from "@/lib/utils"

const phi = {
  0: ["Normal", "bg-[rgba(16,185,129,0.14)] text-[var(--phi-green)] border-[rgba(16,185,129,0.28)]"],
  1: ["Watch", "bg-[rgba(251,191,36,0.14)] text-[var(--phi-yellow)] border-[rgba(251,191,36,0.28)]"],
  2: ["High", "bg-[rgba(251,146,60,0.14)] text-[var(--phi-orange)] border-[rgba(251,146,60,0.28)]"],
  3: ["Critical", "bg-[rgba(244,63,94,0.14)] text-[var(--phi-red)] border-[rgba(244,63,94,0.28)]"]
} as const

export function PhiPill({ value }: { value: 0 | 1 | 2 | 3 }) {
  const [label, className] = phi[value]
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 font-[var(--font-jetbrains)] text-xs", className)}>
      PHI {value} · {label}
    </span>
  )
}
