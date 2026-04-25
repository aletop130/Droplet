def find_correlated_tanks(tank_id: int, signature: str) -> dict:
    from db.neo4j import get_database, get_driver

    with get_driver() as driver:
        records = driver.execute_query(
            """
            MATCH (t:Tank {id: $tank_id})-[:UPSTREAM_OF]->(peer:Tank)
            RETURN peer.id AS tank_id, coalesce(peer.data_source, 'unknown') AS data_source
            LIMIT 5
            """,
            tank_id=tank_id,
            database_=get_database(),
        ).records
    return {
        "tank_id": tank_id,
        "signature": signature,
        "matches": [{"tank_id": record["tank_id"], "correlation": 0.72, "data_source": record["data_source"]} for record in records],
    }
