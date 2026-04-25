def vision_annotate(raster_chip_url: str, question: str) -> dict:
    from services.regolo import MODEL_VL

    return {
        "raster_chip_url": raster_chip_url,
        "question": question,
        "model": MODEL_VL,
        "annotation": "Raster context unavailable in backend bootstrap; use hydraulic and anomaly evidence as primary signal.",
    }
