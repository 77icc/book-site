import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
DB_PATH = os.path.join(BASE_DIR, "book.db")

ADMIN_PASSWORD = "lzh233233"

app = Flask(__name__, static_folder=None)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                rating INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/api/reviews", methods=["GET"])
def list_reviews():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, content, rating, created_at FROM reviews ORDER BY id DESC"
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route("/api/reviews", methods=["POST"])
def add_review():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        rating = 0

    if not title or not content:
        return jsonify({"error": "书名和内容都不能为空"}), 400
    if rating < 1 or rating > 5:
        return jsonify({"error": "评分需要在 1 到 5 之间"}), 400
    if len(title) > 80 or len(content) > 2000:
        return jsonify({"error": "书名或内容过长"}), 400

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO reviews (title, content, rating, created_at) VALUES (?, ?, ?, ?)",
            (title, content, rating, created_at),
        )
        review_id = cur.lastrowid
    return jsonify(
        {"id": review_id, "title": title, "content": content, "rating": rating, "created_at": created_at}
    ), 201


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    if data.get("password") == ADMIN_PASSWORD:
        return jsonify({"ok": True})
    return jsonify({"error": "密码不正确"}), 401


@app.route("/api/admin/delete", methods=["POST"])
def admin_delete():
    data = request.get_json(silent=True) or {}
    if data.get("password") != ADMIN_PASSWORD:
        return jsonify({"error": "密码不正确"}), 401

    target = data.get("type")
    with get_db() as conn:
        if target == "review":
            review_id = data.get("id")
            cur = conn.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "评价不存在"}), 404
        elif target == "book":
            title = (data.get("title") or "").strip()
            cur = conn.execute("DELETE FROM reviews WHERE title = ?", (title,))
            if cur.rowcount == 0:
                return jsonify({"error": "书籍不存在"}), 404
        else:
            return jsonify({"error": "未知的删除类型"}), 400
    return jsonify({"ok": True})


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
