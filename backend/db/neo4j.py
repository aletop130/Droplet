import atexit
import os

from neo4j import GraphDatabase
from dotenv import load_dotenv


load_dotenv()

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            os.environ["NEO4J_URI"],
            auth=(os.getenv("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"]),
        )
    return _driver


def _close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


atexit.register(_close_driver)


def get_database() -> str:
    return os.getenv("NEO4J_DATABASE", "neo4j")
