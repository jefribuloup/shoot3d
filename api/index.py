import os, re, json, sqlite3, urllib.request, urllib.parse
from flask import Flask, request, jsonify
from itsdangerous import URLSafeTimedSerializer
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder="../public", static_url_path="")
URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
if URL:
    import psycopg2

SECRET = os.environ.get("SECRET_KEY") or "dev-only-change-me"
GOOGLE_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
PROGRESSION = os.environ.get("PROGRESSION", "1") != "0"   # 0 = semua level terbuka untuk user terdaftar
ORDER = ["easy", "medium", "hard"]
GOALS = {"easy": 150, "medium": 500, "hard": 1000}        # samakan dengan public/js/config.js
ser = URLSafeTimedSerializer(SECRET, salt="shoot3d-session")
COOKIE, MAXAGE = "s3d_session", 30 * 86400
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
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
def guard():
    global _ready
    if not request.path.startswith("/api"):
        return
    if request.method == "POST" and not request.is_json:      # tolak form lintas-situs (CSRF)
        return jsonify(error="JSON required"), 415
    if _ready:
        return
    pk = "SERIAL PRIMARY KEY" if URL else "INTEGER PRIMARY KEY AUTOINCREMENT"
    q(f"CREATE TABLE IF NOT EXISTS users(id {pk}, email TEXT UNIQUE, name TEXT, pw_hash TEXT, google_id TEXT UNIQUE, "
      "prefs TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    q(f"CREATE TABLE IF NOT EXISTS scores(id {pk}, name TEXT, score INTEGER, hits INTEGER, shots INTEGER, "
      "theme TEXT, weapon TEXT, level TEXT, user_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    try:
        q("ALTER TABLE scores ADD COLUMN user_id INTEGER")     # tabel lama tanpa kolom user_id
    except Exception:
        pass
    _ready = True


@app.errorhandler(Exception)
def on_error(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    return jsonify(error=str(e)[:200]), 500


def err(m, c=400):
    return jsonify(error=m), c


def nm(v):
    return " ".join(str(v or "").split())[:20]


def num(d, k, m):
    try:
        return max(0, min(int(d.get(k) or 0), m))
    except (TypeError, ValueError):
        return 0


def cur_user():
    tok = request.cookies.get(COOKIE)
    if not tok:
        return None
    try:
        uid = ser.loads(tok, max_age=MAXAGE)["uid"]
    except Exception:
        return None
    r = q("SELECT id,name,email,prefs FROM users WHERE id=?", (uid,), True)
    return r[0] if r else None


def unlocked_for(best):
    if not PROGRESSION:
        return ORDER[:]
    un = ["easy"]
    for a, b in zip(ORDER, ORDER[1:]):
        if best.get(a, 0) >= GOALS[a]:
            un.append(b)
        else:
            break
    return un


def bests(uid):
    return {l: s for l, s in q("SELECT level, MAX(score) FROM scores WHERE user_id=? GROUP BY level", (uid,), True)}


def session_resp(uid):
    resp = jsonify(ok=True)
    resp.set_cookie(COOKIE, ser.dumps({"uid": uid}), max_age=MAXAGE, httponly=True, samesite="Lax",
                    secure=request.headers.get("X-Forwarded-Proto") == "https")
    return resp


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/health")
def health():
    q("SELECT 1", fetch=True)
    return jsonify(ok=True, db="postgres" if URL else "sqlite", secret_set=SECRET != "dev-only-change-me", google=bool(GOOGLE_ID))


@app.route("/api/config")
def config():
    return jsonify(googleClientId=GOOGLE_ID, progression=PROGRESSION, goals=GOALS)


@app.route("/api/register", methods=["POST"])
def register():
    d = request.get_json(silent=True) or {}
    name, email, pw = nm(d.get("name")), str(d.get("email", "")).strip().lower()[:120], str(d.get("password", ""))
    if len(name) < 2:
        return err("Nama minimal 2 karakter")
    if not EMAIL.match(email):
        return err("Format email tidak valid")
    if not 6 <= len(pw) <= 100:
        return err("Kata sandi 6–100 karakter")
    if q("SELECT 1 FROM users WHERE email=?", (email,), True):
        return err("Email sudah terdaftar, silakan masuk", 409)
    q("INSERT INTO users(email,name,pw_hash) VALUES(?,?,?)", (email, name, generate_password_hash(pw, method="pbkdf2:sha256")))
    return session_resp(q("SELECT id FROM users WHERE email=?", (email,), True)[0][0])


@app.route("/api/login", methods=["POST"])
def login():
    d = request.get_json(silent=True) or {}
    email, pw = str(d.get("email", "")).strip().lower()[:120], str(d.get("password", ""))
    r = q("SELECT id,pw_hash FROM users WHERE email=?", (email,), True)
    if r and not r[0][1]:
        return err("Akun ini terdaftar lewat Google. Gunakan tombol Google.", 401)
    if not r or not check_password_hash(r[0][1], pw):
        return err("Email atau kata sandi salah", 401)
    return session_resp(r[0][0])


@app.route("/api/auth/google", methods=["POST"])
def google():
    if not GOOGLE_ID:
        return err("Login Google belum dikonfigurasi", 501)
    tok = str((request.get_json(silent=True) or {}).get("credential", ""))
    try:
        with urllib.request.urlopen("https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(tok), timeout=6) as r:
            info = json.loads(r.read())
    except Exception:
        return err("Token Google tidak valid", 401)
    if info.get("aud") != GOOGLE_ID or str(info.get("email_verified")).lower() != "true":
        return err("Token Google tidak valid", 401)
    gid, email = info["sub"], str(info.get("email", "")).lower()
    name = nm(info.get("name") or email.split("@")[0]) or "Pemain"
    r = q("SELECT id FROM users WHERE google_id=?", (gid,), True) or q("SELECT id FROM users WHERE email=?", (email,), True)
    if r:
        uid = r[0][0]
        q("UPDATE users SET google_id=? WHERE id=? AND google_id IS NULL", (gid, uid))
    else:
        q("INSERT INTO users(email,name,google_id) VALUES(?,?,?)", (email, name, gid))
        uid = q("SELECT id FROM users WHERE google_id=?", (gid,), True)[0][0]
    return session_resp(uid)


@app.route("/api/logout", methods=["POST"])
def logout():
    resp = jsonify(ok=True)
    resp.delete_cookie(COOKIE)
    return resp


@app.route("/api/me")
def me():
    u = cur_user()
    if not u:
        return jsonify(user=None)
    b = bests(u[0])
    return jsonify(user={"name": u[1], "email": u[2], "prefs": json.loads(u[3]) if u[3] else {}}, best=b, unlocked=unlocked_for(b))


@app.route("/api/prefs", methods=["POST"])
def prefs():
    u = cur_user()
    if not u:
        return err("Belum masuk", 401)
    p = {k: str(v)[:100] for k, v in ((request.get_json(silent=True) or {}).get("prefs") or {}).items() if k in ("theme", "weapon", "level")}
    q("UPDATE users SET prefs=? WHERE id=?", (json.dumps(p), u[0]))
    return jsonify(ok=True)


@app.route("/api/score", methods=["POST"])
def score():
    u = cur_user()
    if not u:
        return err("Skor hanya tersimpan untuk user terdaftar", 401)
    d = request.get_json(silent=True) or {}
    lv = d.get("level")
    if lv not in ORDER:
        return err("Level tidak valid")
    before = unlocked_for(bests(u[0]))
    if lv not in before:
        return err("Level belum terbuka", 403)
    sc = num(d, "score", 100000)
    q("INSERT INTO scores(name,score,hits,shots,theme,weapon,level,user_id) VALUES(?,?,?,?,?,?,?,?)",
      (u[1], sc, num(d, "hits", 1000), num(d, "shots", 5000), str(d.get("theme"))[:100], str(d.get("weapon"))[:20], lv, u[0]))
    b = bests(u[0])
    return jsonify(ok=True, won=sc >= GOALS[lv], unlocked=unlocked_for(b), best=b)


@app.route("/api/leaderboard")
def leaderboard():
    lv = request.args.get("level")
    if lv not in ORDER:
        return jsonify(rows=[])
    r = q("SELECT u.name, MAX(s.score) AS m FROM scores s JOIN users u ON u.id=s.user_id WHERE s.level=? "
          "GROUP BY u.id, u.name ORDER BY m DESC LIMIT 10", (lv,), True)
    return jsonify(rows=[{"name": a, "score": b} for a, b in r])


if __name__ == "__main__":
    app.run(debug=True)
