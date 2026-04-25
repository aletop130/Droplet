from datetime import date


def today_digest() -> dict:
    return {
        "day": date.today().isoformat(),
        "trend_summary": "Frosinone has 3 red segments overnight in the scaffold digest.",
        "top_incidents": [{"incident_id": 1, "severity": 3}],
        "intervention_recs": [],
        "audit_log_id": None,
    }
