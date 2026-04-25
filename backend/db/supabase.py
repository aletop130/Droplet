import os
from contextlib import contextmanager

import psycopg
from dotenv import load_dotenv


load_dotenv()


def pooler_url() -> str | None:
    return os.getenv("SUPABASE_DB_POOLER_URL")


@contextmanager
def get_connection():
    password = os.getenv("SUPABASE_DB_PASSWORD")
    if password:
        with psycopg.connect(
            host=os.getenv("SUPABASE_DB_HOST", "aws-1-eu-central-1.pooler.supabase.com"),
            port=int(os.getenv("SUPABASE_DB_PORT", "5432")),
            dbname=os.getenv("SUPABASE_DB_NAME", "postgres"),
            user=os.getenv("SUPABASE_DB_USER", "postgres.cnqwlkkoikcymavbnnfu"),
            password=password,
            sslmode=os.getenv("SUPABASE_DB_SSLMODE", "require"),
            autocommit=True,
        ) as conn:
            yield conn
        return
    url = pooler_url()
    if not url:
        raise RuntimeError("SUPABASE_DB_POOLER_URL is not configured")
    with psycopg.connect(url, autocommit=True) as conn:
        yield conn
