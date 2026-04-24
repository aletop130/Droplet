import os
from pathlib import Path

from dotenv import dotenv_values
from huggingface_hub import HfApi


TOKEN = os.environ.get("HF_TOKEN")
SPACE = "Alessandro0709/Droplet"

SECRET_KEYS = {
    "REGOLO_API_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_DB_POOLER_URL",
    "QDRANT_API_KEY",
    "NEO4J_URI",
    "NEO4J_PASSWORD",
    "CDS_API_KEY",
    "CDSE_CLIENT_ID",
    "CDSE_CLIENT_SECRET",
    "EARTHDATA_USER",
    "EARTHDATA_PASSWORD",
    "HF_TOKEN",
    "VERCEL_TOKEN",
    "EGMS_USER",
    "EGMS_PASSWORD",
}

VARIABLE_KEYS = {
    "REGOLO_API_BASE",
    "REGOLO_MODEL_ORCHESTRATOR",
    "REGOLO_MODEL_VL",
    "REGOLO_MODEL_EMBED",
    "REGOLO_MODEL_RERANK",
    "REGOLO_MODEL_CHATBOT",
    "DROPLET_ENABLE_CHAT",
    "DROPLET_ENABLE_OMNISEARCH",
    "SUPABASE_URL",
    "QDRANT_URL",
    "QDRANT_COLLECTION_REGS",
    "QDRANT_COLLECTION_AI",
    "QDRANT_COLLECTION_CASES",
    "NEO4J_USER",
    "NEO4J_DATABASE",
    "CDS_API_URL",
    "OPENEO_URL",
    "CDSE_REGION",
    "HF_SPACE_OWNER",
    "HF_SPACE_NAME",
    "HF_SPACE_URL",
    "ALLOWED_ORIGINS",
    "PILOT_BBOX_W",
    "PILOT_BBOX_S",
    "PILOT_BBOX_E",
    "PILOT_BBOX_N",
    "PILOT_PLACE",
    "PILOT_EGMS_TILES",
    "PILOT_ECOSTRESS_COLLECTION",
    "PILOT_ECOSTRESS_COLLECTION_NDVI",
    "PILOT_S2_COLLECTION",
    "PILOT_S3_COLLECTION",
    "PILOT_GRACE_COLLECTION",
    "PILOT_GSW_TILE",
}


def main():
    if not TOKEN:
        raise RuntimeError("HF_TOKEN is required")
    env = dotenv_values(Path(__file__).parent.parent / "backend" / ".env")
    api = HfApi(token=TOKEN)
    for key, value in env.items():
        if not value:
            print(f"[skip empty] {key}")
            continue
        if key in SECRET_KEYS:
            api.add_space_secret(repo_id=SPACE, key=key, value=value)
            print(f"[secret ] {key}")
        elif key in VARIABLE_KEYS:
            api.add_space_variable(repo_id=SPACE, key=key, value=value)
            print(f"[var    ] {key}")
        else:
            print(f"[unknown] {key} - NOT pushed (add to SECRET_KEYS or VARIABLE_KEYS)")


if __name__ == "__main__":
    main()
