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
PROGRESSION = os.environ.get("PROGRESSION", "0") == "1"   # 1 = user terdaftar harus menang level sebelumnya (default: semua level terbuka)
ORDER = ["easy", "medium", "hard"]
GOALS = {"easy": 150, "medium": 500, "hard": 1000}        # samakan dengan public/js/config.js
ser = URLSafeTimedSerializer(SECRET, salt="shoot3d-session")
COOKIE, MAXAGE = "s3d_session", 30 * 86400
GCOOKIE, GMAXAGE = "s3d_guest", 365 * 86400
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
      "theme TEXT, weapon TEXT, level TEXT, user_id INTEGER, pkey TEXT, country TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    q(f"CREATE TABLE IF NOT EXISTS guests(id {pk}, name TEXT, name_key TEXT UNIQUE, country TEXT, "
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    for col in ("user_id INTEGER", "pkey TEXT", "country TEXT"):    # migrasi tabel lama
        try:
            q("ALTER TABLE scores ADD COLUMN " + col)
        except Exception:
            pass
    q("UPDATE scores SET pkey='u'||CAST(user_id AS TEXT) WHERE pkey IS NULL AND user_id IS NOT NULL")
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


def country():
    c = (request.headers.get("x-vercel-ip-country") or request.headers.get("cf-ipcountry") or "").upper()
    return c if re.fullmatch(r"[A-Z]{2}", c) and c not in ("XX", "T1") else ""


def cur_guest():
    tok = request.cookies.get(GCOOKIE)
    if not tok:
        return None
    try:
        gid = ser.loads(tok, max_age=GMAXAGE)["gid"]
    except Exception:
        return None
    r = q("SELECT id,name,country FROM guests WHERE id=?", (gid,), True)
    return r[0] if r else None


def taken(name, gid=None):
    k = name.lower()
    if q("SELECT 1 FROM users WHERE LOWER(name)=?", (k,), True):
        return True
    r = q("SELECT id FROM guests WHERE name_key=?", (k,), True)
    return bool(r) and r[0][0] != gid


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
    if taken(name):
        return err("Nama sudah dipakai pemain lain", 409)
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
    if taken(name):
        name = nm(name[:16] + str(__import__("random").randint(100, 999)))
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
        g = cur_guest()
        return jsonify(user=None, guest={"name": g[1], "country": g[2]} if g else None, unlocked=ORDER)
    b = bests(u[0])
    return jsonify(user={"name": u[1], "email": u[2], "prefs": json.loads(u[3]) if u[3] else {}}, best=b, unlocked=unlocked_for(b))


@app.route("/api/name")
def name_check():
    name = nm(request.args.get("name"))
    g = cur_guest()
    return jsonify(available=len(name) >= 2 and not taken(name, g[0] if g else None))


@app.route("/api/guest", methods=["POST"])
def guest():
    name = nm((request.get_json(silent=True) or {}).get("name"))
    if len(name) < 2:
        return err("Isi nama minimal 2 karakter")
    g, cn = cur_guest(), country()
    if taken(name, g[0] if g else None):
        return err("Nama sudah dipakai pemain lain, pilih nama lain", 409)
    if g:
        q("UPDATE guests SET name=?, name_key=?, country=? WHERE id=?", (name, name.lower(), cn or g[2], g[0]))
        q("UPDATE scores SET name=? WHERE pkey=?", (name, f"g{g[0]}"))
        gid = g[0]
    else:
        try:
            q("INSERT INTO guests(name,name_key,country) VALUES(?,?,?)", (name, name.lower(), cn))
        except Exception:
            return err("Nama sudah dipakai pemain lain, pilih nama lain", 409)
        gid = q("SELECT id FROM guests WHERE name_key=?", (name.lower(),), True)[0][0]
    resp = jsonify(ok=True, name=name, country=cn)
    resp.set_cookie(GCOOKIE, ser.dumps({"gid": gid}), max_age=GMAXAGE, httponly=True, samesite="Lax",
                    secure=request.headers.get("X-Forwarded-Proto") == "https")
    return resp


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
    g = None if u else cur_guest()
    if not u and not g:
        return err("Isi nama pemain dulu", 401)
    d = request.get_json(silent=True) or {}
    lv = d.get("level")
    if lv not in ORDER:
        return err("Level tidak valid")
    if u and lv not in unlocked_for(bests(u[0])):
        return err("Level belum terbuka", 403)
    sc, cn = num(d, "score", 100000), country()
    pkey, name = (f"u{u[0]}", u[1]) if u else (f"g{g[0]}", g[1])
    q("INSERT INTO scores(name,score,hits,shots,theme,weapon,level,user_id,pkey,country) VALUES(?,?,?,?,?,?,?,?,?,?)",
      (name, sc, num(d, "hits", 1000), num(d, "shots", 5000), str(d.get("theme"))[:100], str(d.get("weapon"))[:20], lv,
       u[0] if u else None, pkey, cn))
    if g and cn:
        q("UPDATE guests SET country=? WHERE id=?", (cn, g[0]))
    if u:
        bs = bests(u[0])
        return jsonify(ok=True, won=sc >= GOALS[lv], unlocked=unlocked_for(bs), best=bs)
    return jsonify(ok=True, won=sc >= GOALS[lv], unlocked=ORDER)


@app.route("/api/leaderboard")
def leaderboard():
    lv = request.args.get("level")
    if lv not in ORDER:
        return jsonify(rows=[], countries=[])
    u = cur_user()
    g = None if u else cur_guest()
    mine = f"u{u[0]}" if u else (f"g{g[0]}" if g else None)
    rows = q("SELECT s.pkey, s.name, s.country, s.score FROM scores s JOIN "
             "(SELECT pkey, MAX(score) AS m FROM scores WHERE level=? AND pkey IS NOT NULL GROUP BY pkey) t "
             "ON t.pkey=s.pkey AND t.m=s.score WHERE s.level=? ORDER BY s.score DESC, s.id ASC LIMIT 200", (lv, lv), True)
    seen, out = set(), []
    for pk, n, c, sc in rows:
        if pk in seen:
            continue
        seen.add(pk)
        out.append({"name": n, "score": sc, "country": c or "", "me": pk == mine})
        if len(out) == 10:
            break
    cs = q("SELECT country, COUNT(*) AS n FROM (SELECT pkey, MAX(country) AS country FROM scores WHERE pkey IS NOT NULL "
           "GROUP BY pkey) t WHERE country IS NOT NULL AND country<>'' GROUP BY country ORDER BY n DESC LIMIT 8", fetch=True)
    return jsonify(rows=out, countries=[{"country": c, "n": n} for c, n in cs])


if __name__ == "__main__":
    app.run(debug=True)
