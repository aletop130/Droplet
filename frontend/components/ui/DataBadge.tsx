import { cn } from "@/lib/utils"

type DataBadgeProps = {
  label: string
  value: string
  tone?: "cyan" | "teal" | "red" | "yellow"
}

const tones = {
  cyan: "border-[rgba(34,207,255,0.28)] text-[var(--acea-cyan)]",
  teal: "border-[rgba(45,212,191,0.28)] text-[var(--acea-teal)]",
  red: "border-[rgba(244,63,94,0.32)] text-[var(--phi-red)]",
  yellow: "border-[rgba(251,191,36,0.32)] text-[var(--phi-yellow)]"
}

export function DataBadge({ label, value, tone = "cyan" }: DataBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border bg-white/[0.03] px-2.5 py-1 font-[var(--font-jetbrains)] text-xs", tones[tone])}>
      <span className="text-[var(--text-lo)]">{label}</span>
      <span>{value}</span>
    </span>
  )
}
