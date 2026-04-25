def classify_phi(subsidence: float, ndvi: float, thermal: float, hydraulic: float, tank_signal: float) -> int:
    score = (subsidence * 0.24) + (ndvi * 0.18) + (thermal * 0.18) + (hydraulic * 0.24) + (tank_signal * 0.16)
    if score >= 0.72:
        return 3
    if score >= 0.52:
        return 2
    if score >= 0.30:
        return 1
    return 0
