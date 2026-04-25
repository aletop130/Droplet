type GaugeProps = {
  value: number
  max?: number
  label: string
  unit?: string
  color?: string
}

export function Gauge({ value, max = 100, label, unit = "%", color = "var(--acea-cyan)" }: GaugeProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const angle = 180 * (clamped / max)
  const radius = 64
  const circumference = Math.PI * radius
  const dash = (angle / 180) * circumference

  return (
    <div className="grid gap-2">
      <svg viewBox="0 0 180 110" className="w-full">
        <path
          d="M 26 90 A 64 64 0 0 1 154 90"
          fill="none"
          stroke="rgba(173,218,255,0.12)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 26 90 A 64 64 0 0 1 154 90"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <circle cx="90" cy="90" r="5" fill={color} />
        <text x="90" y="68" textAnchor="middle" className="fill-[var(--text-hi)] text-[24px] font-semibold">
          {Math.round(clamped)}
        </text>
        <text x="90" y="84" textAnchor="middle" className="fill-[var(--text-lo)] text-[12px]">
          {unit}
        </text>
      </svg>
      <div className="text-center text-data text-[var(--text-lo)]">{label}</div>
    </div>
  )
}
