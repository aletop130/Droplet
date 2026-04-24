export function phiColor(phi: number): [number, number, number, number] {
  if (phi === 0) return [16, 185, 129, 220]
  if (phi === 1) return [251, 191, 36, 230]
  if (phi === 2) return [251, 146, 60, 235]
  return [244, 63, 94, 245]
}

export function phiLabel(phi: number) {
  if (phi === 0) return "Normal"
  if (phi === 1) return "Watch"
  if (phi === 2) return "High"
  return "Critical"
}
