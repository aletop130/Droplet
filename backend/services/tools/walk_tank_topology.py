from db.neo4j import get_database, get_driver


def walk_tank_topology(tank_id: int, hops: int = 2) -> dict:
    query = """
    MATCH (tank:Tank {id: $tank_id})
    OPTIONAL MATCH (source:Source)-[feed_rel]->(tank)
    WHERE type(feed_rel) = 'FEEDS'
    OPTIONAL MATCH (tank)-[:SUPPLIES]->(dma:DMA)
    OPTIONAL MATCH path = (tank)-[:UPSTREAM_OF*1..5]->(peer:Tank)
    WHERE length(path) <= $hops
    OPTIONAL MATCH (segment:PipeSegment)-[:UPSTREAM_OF|DOWNSTREAM_OF]->(tank)
    WITH tank, source, dma,
         collect(DISTINCT peer.id) AS peers,
         collect(DISTINCT segment.id) AS segments
    RETURN
      tank.id AS tank_id,
      source.id AS upstream_source_id,
      replace(source.node_type, 'source_', '') AS upstream_source_kind,
      coalesce(dma.id, -1) AS dma_id,
      peers,
      segments
    LIMIT 1
    """
    with get_driver() as driver:
        records = driver.execute_query(
            query,
            tank_id=tank_id,
            hops=max(1, hops),
            database_=get_database(),
        ).records
    if not records:
        return {
            "tank_id": tank_id,
            "hops": hops,
            "upstream_source": None,
            "siblings": [],
            "downstream_dmas": [],
            "downstream_segments": [],
        }
    row = records[0]
    upstream_source = None
    if row["upstream_source_id"] is not None:
        upstream_source = f"source_{row['upstream_source_kind']}:{row['upstream_source_id']}"
    peers = [item for item in (row["peers"] or []) if item != tank_id]
    return {
        "tank_id": row["tank_id"],
        "hops": hops,
        "upstream_source": upstream_source,
        "siblings": peers[: max(1, min(len(peers), hops + 1))],
        "downstream_dmas": [] if row["dma_id"] == -1 else [row["dma_id"]],
        "downstream_segments": row["segments"] or [],
    }
