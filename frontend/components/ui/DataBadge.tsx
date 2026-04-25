import { cn } from "@/lib/utils"

type DataBadgeProps = {
  label: string
  value: string
  tone?: "cyan" | "teal" | "red" | "yellow" | "neutral"
}

const tones = {
  cyan: "border-[rgba(75,214,255,0.28)] text-[var(--acea-cyan)]",
  teal: "border-[rgba(68,215,192,0.28)] text-[var(--acea-teal)]",
  red: "border-[rgba(244,63,94,0.3)] text-[var(--phi-red)]",
  yellow: "border-[rgba(251,191,36,0.3)] text-[var(--phi-yellow)]",
  neutral: "border-[rgba(173,218,255,0.16)] text-[var(--text-md)]"
}

export function DataBadge({ label, value, tone = "cyan" }: DataBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-data",
        tones[tone]
      )}
    >
      <span className="text-[var(--text-lo)]">{label}</span>
      <span>{value}</span>
    </span>
  )
}
