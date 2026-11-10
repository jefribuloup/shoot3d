import os, json, sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__, static_folder="../public", static_url_path="")
URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
if URL:
    import psycopg2
LEVELS = {"easy", "medium", "hard"}
_ready = False


def q(sql, args=(), fetch=False):
    conn = psycopg2.connect(URL) if URL else sqlite3.connect("/tmp/shoot3d.db")
    try:
        cur = conn.cursor()
        cur.execute(sql.replace("?", "%s") if URL else sql, args)
        rows = cur.fetchall() if fetch else None
        conn.commit()
        return rows
    finally:
        conn.close()


@app.before_request
def init():
    global _ready
    if _ready or not request.path.startswith("/api"):
        return
    pk = "SERIAL PRIMARY KEY" if URL else "INTEGER PRIMARY KEY AUTOINCREMENT"
    q("CREATE TABLE IF NOT EXISTS players(name TEXT PRIMARY KEY, prefs TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    q(f"CREATE TABLE IF NOT EXISTS scores(id {pk}, name TEXT, score INTEGER, hits INTEGER, shots INTEGER, "
      "theme TEXT, weapon TEXT, level TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    _ready = True


def nm(v):
    return str(v or "").strip()[:20]


def num(d, k, m):
    try:
        return max(0, min(int(d.get(k) or 0), m))
    except (TypeError, ValueError):
        return 0


@app.errorhandler(Exception)
def on_error(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    return jsonify(error=str(e)[:200]), 500


@app.route("/api/health")
def health():
    q("SELECT 1", fetch=True)
    return jsonify(ok=True, db="postgres" if URL else "sqlite")


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/player", methods=["GET", "POST"])
def player():
    if request.method == "POST":
        d = request.get_json(silent=True) or {}
        n = nm(d.get("name"))
        if not n:
            return jsonify(error="name"), 400
        prefs = {k: str(v)[:20] for k, v in (d.get("prefs") or {}).items() if k in ("theme", "weapon", "level")}
        q("INSERT INTO players(name,prefs) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET prefs=excluded.prefs", (n, json.dumps(prefs)))
        return jsonify(ok=True)
    n = nm(request.args.get("name"))
    r = q("SELECT prefs FROM players WHERE name=?", (n,), True)
    b = q("SELECT level, MAX(score) FROM scores WHERE name=? GROUP BY level", (n,), True)
    return jsonify(prefs=json.loads(r[0][0]) if r else None, best={l: s for l, s in b})


@app.route("/api/score", methods=["POST"])
def score():
    d = request.get_json(silent=True) or {}
    n, lv = nm(d.get("name")), d.get("level")
    if not n or lv not in LEVELS:
        return jsonify(error="bad request"), 400
    q("INSERT INTO scores(name,score,hits,shots,theme,weapon,level) VALUES(?,?,?,?,?,?,?)",
      (n, num(d, "score", 100000), num(d, "hits", 1000), num(d, "shots", 5000),
       str(d.get("theme"))[:20], str(d.get("weapon"))[:20], lv))
    return jsonify(ok=True)


@app.route("/api/leaderboard")
def leaderboard():
    lv = request.args.get("level")
    if lv not in LEVELS:
        return jsonify(rows=[])
    r = q("SELECT name, MAX(score) s FROM scores WHERE level=? GROUP BY name ORDER BY s DESC LIMIT 10", (lv,), True)
    return jsonify(rows=[{"name": a, "score": b} for a, b in r])


if __name__ == "__main__":
    app.run(debug=True)
