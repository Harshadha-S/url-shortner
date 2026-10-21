import sqlite3
from pathlib import Path

base_dir = Path(__file__).resolve().parent
db_path = base_dir / "shortly.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY,
    original_url TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT
);

CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY,
    link_id INTEGER NOT NULL,
    clicked_at TEXT NOT NULL,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
"""


def init_db() -> None:
    conn = get_db_connection()
    try:
        with conn:
            conn.executescript(SCHEMA)
            columns = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(links)")
            }
            if "expires_at" not in columns:
                conn.execute("ALTER TABLE links ADD COLUMN expires_at TEXT")
    finally:
        conn.close()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def migrate_db(conn: sqlite3.Connection) -> None:
    links_columns = {row["name"] for row in conn.execute("PRAGMA table_info(links);")}
    if "expires_at" not in links_columns:
        conn.execute("ALTER TABLE links ADD COLUMN expires_at TEXT;")

def verify_foreign_keys() -> bool:
    conn = get_db_connection()
    try:
        enabled = conn.execute("PRAGMA foreign_keys;").fetchone()[0]==1
        try:
            conn.execute("INSERT INTO clicks (link_id, clicked_at) VALUES (?, ?)",
                         (-1, "2026-01-01T00:00:0Z"),)
            conn.rollback()
            return False
        except sqlite3.IntegrityError:
            return enabled
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {db_path}")
    print(f"Foreign key support enabled: {verify_foreign_keys()}")