from db.neo4j import get_database, get_driver


def walk_network(segment_id: int, hops: int = 2) -> dict:
    query = """
    MATCH (segment:PipeSegment {id: $segment_id})
    OPTIONAL MATCH (segment)-[:IN_DMA]->(dma:DMA)
    OPTIONAL MATCH (segment)-[:UPSTREAM_OF|DOWNSTREAM_OF]->(tank:Tank)
    OPTIONAL MATCH path = (segment)-[:CONNECTS_TO*1..5]-(neighbor:PipeSegment)
    WHERE length(path) <= $hops
    WITH segment, dma, collect(DISTINCT tank.id) AS tanks, collect(DISTINCT neighbor.id) AS neighbors, collect(DISTINCT path)[0] AS sample_path
    RETURN
      segment.id AS segment_id,
      coalesce(dma.id, -1) AS dma_id,
      [item IN neighbors WHERE item <> segment.id] AS neighbor_segments,
      tanks,
      CASE
        WHEN sample_path IS NULL THEN []
        ELSE [node IN nodes(sample_path) | labels(node)[0] + ':' + toString(node.id)]
      END AS graph_path
    LIMIT 1
    """
    with get_driver() as driver:
        record = driver.execute_query(
            query,
            segment_id=segment_id,
            hops=max(1, hops),
            database_=get_database(),
        ).records
    if not record:
        return {
            "segment_id": segment_id,
            "hops": hops,
            "upstream_segments": [],
            "downstream_segments": [],
            "dma_id": None,
            "tanks": [],
            "graph_path": [],
        }
    row = record[0]
    neighbors = row["neighbor_segments"] or []
    neighbors = [item for item in neighbors if item != segment_id]
    return {
        "segment_id": row["segment_id"],
        "hops": hops,
        "upstream_segments": neighbors[: max(1, min(len(neighbors), hops))],
        "downstream_segments": neighbors[max(1, min(len(neighbors), hops)) : max(2, hops * 2)],
        "dma_id": None if row["dma_id"] == -1 else row["dma_id"],
        "tanks": row["tanks"] or [],
        "graph_path": row["graph_path"] or [],
    }
