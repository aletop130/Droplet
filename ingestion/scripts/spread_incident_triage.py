from __future__ import annotations

import json

from seed_operational_data import connect_supabase


STATUSES = ["open", "in_progress", "resolved", "open", "in_progress", "resolved", "open"]


def main() -> None:
    with connect_supabase() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, severity
                FROM incidents
                ORDER BY updated_at DESC, id
                """
            )
            rows = cur.fetchall()

            updates = []
            for index, (incident_id, current_severity) in enumerate(rows):
                status = STATUSES[index % len(STATUSES)]
                severity = 3 if index % 8 in {0, 3} else 2 if index % 3 != 0 else 1
                if status == "resolved" and severity == 3:
                    severity = 2
                updates.append((status, severity, incident_id))

            cur.executemany(
                """
                UPDATE incidents
                SET status = %s,
                    severity = %s,
                    updated_at = now() - ((id %% 90) || ' minutes')::interval
                WHERE id = %s
                """,
                updates,
            )

            cur.execute(
                """
                SELECT status, severity, count(*)
                FROM incidents
                GROUP BY status, severity
                ORDER BY status, severity DESC
                """
            )
            print(json.dumps({"updated": len(updates), "distribution": cur.fetchall()}, default=str))


if __name__ == "__main__":
    main()
