
from datetime import datetime, timezone
import sqlite3

from flask import Flask, jsonify, redirect, render_template, request

from db import get_db_connection, init_db
from helpers import validate_url, validate_alias, generate_code, parse_expiry

app = Flask(__name__)


@app.post("/api/links")
def create_link():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Request body must be JSON"), 400

    url = data.get("url")
    alias = data.get("alias")
    expiry_value = data.get("expires_at")

    if not validate_url(url):
        return jsonify(error="Invalid URL"), 400
    if alias not in (None, "") and not validate_alias(alias):
        return jsonify(error="Invalid or reserved alias"), 400

    try:
        expires_at = parse_expiry(expiry_value)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400

    conn = get_db_connection()
    created_at = datetime.now(timezone.utc).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")

    try:
        for _ in range(5):
            code = alias if alias else generate_code()
            try:
                conn.execute(
                    """
                    INSERT INTO links (original_url, code, created_at, expires_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (url, code, created_at, expires_at),
                )
                conn.commit()
                return jsonify(
                    code=code,
                    short_url=f"{request.host_url.rstrip('/')}/{code}",
                    original_url=url,
                    created_at=created_at,
                    expires_at=expires_at,
                ), 201
            except sqlite3.IntegrityError as exc:
                conn.rollback()
                if alias:
                    return jsonify(error="Alias already taken"), 409
                if "UNIQUE constraint failed" not in str(exc):
                    raise

        return jsonify(error="Could not generate a unique code. Try again."), 503
    finally:
        conn.close()


@app.get("/<code>")
def redirect_link(code):
    conn = get_db_connection()
    try:
        link = conn.execute(
            "SELECT original_url, expires_at FROM links WHERE code = ?",
            (code,),
        ).fetchone()
    finally:
        conn.close()

    if link is None:
        return jsonify(error="Link not found"), 404

    if link["expires_at"]:
        expiry = datetime.fromisoformat(
            link["expires_at"].replace("Z", "+00:00")
        )
        if expiry <= datetime.now(timezone.utc):
            return jsonify(error="This link has expired"), 410

    return redirect(link["original_url"], code=302)

from flask import render_template
@app.get("/")
def home():
    return render_template("index.html")
if __name__ == "__main__":
    init_db()
    app.run(debug=True)
