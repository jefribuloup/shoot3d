import * as THREE from 'three';
import { WEAPONS, LEVELS } from './config.js';
import { THEMES, addCustom, customImgs } from './targets.js';

// ===== efek ledakan + tangan/senjata =====
const parts = [], box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 8, 6);
let pool = [], flashPool = [], qty = 24;
function initFx(scene) {
  for (let i = 0; i < 96; i++) { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; scene.add(m); pool.push(m); }
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, blending: THREE.AdditiveBlending })); m.visible = false; scene.add(m); flashPool.push(m); }
}
const take = a => { for (const m of a) if (!m.visible) { m.visible = true; return m; } return null; };
function explode(scene, t) {
  const cols = []; t.traverse(o => { if (o.isMesh) cols.push(o.material.map ? 0xffffff : o.material.color.getHex()); });
  if (!cols.length) cols.push(0xffffff);
  for (let i = 0; i < qty; i++) {
    const m = take(pool); if (!m) break; const z = .08 + Math.random() * .18;
    m.material.color.setHex(cols[i % cols.length]); m.material.opacity = 1; m.rotation.set(0, 0, 0); m.position.copy(t.position);
    m.scale.set(z * (.5 + Math.random()), z, z * (.5 + Math.random()));
    parts.push({ m, life: .9, max: .9,
      v: new THREE.Vector3(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize().multiplyScalar(3 + Math.random() * 6),
      w: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(12) });
  }
  const f = take(flashPool); if (f) { f.position.copy(t.position); f.material.opacity = .9; parts.push({ m: f, flash: true, life: .25, max: .25, s: t.userData.r }); }
}
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i], k = (q.life -= dt) / q.max;
    if (q.flash) { q.m.scale.setScalar(q.s * (1 + (1 - k) * 2.5)); q.m.material.opacity = Math.max(0, k * .9); }
    else { q.v.y -= 9 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += q.w.x * dt; q.m.rotation.y += q.w.y * dt; q.m.material.opacity = Math.min(1, k * 2); }
    if (q.life <= 0) { q.m.visible = false; parts.splice(i, 1); }
  }
}
function clearFx() { while (parts.length) parts.pop().m.visible = false; }

// ---- tangan + senjata (first person, model menghadap +z) ----
const mat = c => new THREE.MeshLambertMaterial({ color: c });
const B = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };
const C = (r, l, c, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), mat(c)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
const hand = (x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), mat(0xf1c27d)); m.position.set(x, y, z); return m; };

function makeView(type) {
  const g = new THREE.Group(); g.add(C(.06, .9, 0x23407a, 0, -.05, -.5));
  if (type === 'pistol') {
    g.add(B(.055, .17, .08, 0x2b2f36, 0, -.1, -.02), B(.06, .07, .32, 0x2b2f36, 0, .04, .13), C(.015, .1, 0x888888, 0, .04, .32), hand(0, -.04, -.03));
    const fl = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffe066 })); fl.scale.setScalar(.06); fl.position.set(0, .04, .42); g.add(fl); g.userData.flash = fl;
  } else if (type === 'knife') {
    const bl = B(.012, .07, .32, 0xdddddd, 0, 0, .26); g.add(B(.04, .04, .16, 0x5c3b1e, 0, 0, .02), bl, hand(0, 0, 0)); g.userData.proj = bl;
  } else {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(.32, .015, 6, 18, Math.PI), mat(0x8b5a2b)); bow.rotation.set(0, -Math.PI / 2, -Math.PI / 2); bow.position.z = .1;
    const arr = C(.012, .55, 0xc9a066, 0, 0, .3); g.add(bow, C(.004, .64, 0xeeeeee, 0, 0, .1).rotateZ(Math.PI / 2).rotateY(0) && B(.004, .64, .004, 0xeeeeee, 0, 0, .1), arr, hand(0, 0, .1)); g.userData.proj = arr;
  }
  g.userData.flash && (g.userData.flash.visible = false);
  return g;
}
const _v = new THREE.Vector3();
function updateView(g, ndc, cam, kick, ready) {
  const dd = .8, hh = Math.tan(cam.fov * Math.PI / 360) * dd; g.position.set(.45 * hh * cam.aspect, -.52 * hh, -dd + kick * .12);
  const d = 12, ty = Math.tan(cam.fov * Math.PI / 360);
  cam.updateMatrixWorld(true); g.lookAt(cam.localToWorld(_v.set(ndc.x * ty * cam.aspect * d, ndc.y * ty * d, -d)));
  if (g.userData.flash) g.userData.flash.visible = kick > .8;
  if (g.userData.proj) g.userData.proj.visible = ready;
}

// ===== game =====
const $ = s => document.querySelector(s);
// ===== preloader =====
const loader = $('#loader'), ltxt = $('#ltxt'), sleep = ms => new Promise(r => setTimeout(r, ms));
let busyN = 1, shownAt = 0; // 1 = boot awal
function showLoad(msg) { busyN++; loader.classList.remove('out', 'fail'); loader.hidden = false; ltxt.textContent = msg; shownAt = performance.now(); }
async function hideLoad(min = 450) {
  const w = min - (performance.now() - shownAt); if (w > 0) await sleep(w);
  if (--busyN > 0) return; busyN = 0;
  loader.classList.add('out'); await sleep(300);
  if (!busyN) { loader.hidden = true; loader.classList.remove('out'); }
}
const pending = t => { const ol = $('#lb'); ol.innerHTML = ''; const li = document.createElement('li'); li.className = 'ld'; li.textContent = t; ol.append(li); };
const showErr = m => { const d = $('#err'); if (d) { d.hidden = false; d.textContent = '⚠ ' + m; } if (!window.__ready) { loader.classList.add('fail'); ltxt.textContent = 'Terjadi kesalahan: ' + m; } };
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason)));
const sel = { theme: 'buah', weapon: 'pistol', level: 'easy' };
const auth = { user: null, unlocked: ['easy'], cfg: null };
const ORDER = Object.keys(LEVELS);
const allowed = k => auth.user ? auth.unlocked.includes(k) : k === ORDER[0];
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

function chips(box, data, key) {
  box.innerHTML = '';
  for (const k in data) {
    const b = document.createElement('button');
    b.className = 'chip' + (sel[key] === k ? ' on' : '');
    b.textContent = (data[k].icon ? data[k].icon + ' ' : '') + data[k].name;
    b.onclick = () => { sel[key] = k; [...box.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); };
    box.append(b);
  }
}
const getThemes = () => sel.theme.split(',').filter(k => THEMES[k]);
let activeThemes = [];
function themeChips() {
  const box = $('#themes'); box.innerHTML = '';
  for (const k in THEMES) {
    const b = document.createElement('button'), d = THEMES[k];
    b.className = 'chip' + (getThemes().includes(k) ? ' on' : ''); b.textContent = d.icon + ' ' + d.name;
    b.onclick = () => {
      let a = getThemes(); a = a.includes(k) ? a.filter(x => x !== k) : [...a, k];
      if (!a.length) a = [k];
      sel.theme = a.join(','); b.classList.toggle('on', a.includes(k)); [...box.children].forEach((c, i) => c.classList.toggle('on', a.includes(Object.keys(THEMES)[i])));
    };
    box.append(b);
  }
}
function levelChips() {
  const box = $('#levels'); box.innerHTML = '';
  if (!allowed(sel.level)) sel.level = ORDER[0];
  for (const k of ORDER) {
    const b = document.createElement('button'), lock = !allowed(k), i = ORDER.indexOf(k);
    b.className = 'chip' + (sel.level === k ? ' on' : '') + (lock ? ' lock' : '');
    b.textContent = (lock ? '🔒 ' : '') + LEVELS[k].name;
    b.onclick = () => {
      if (lock) return toast(auth.user ? `Capai ${LEVELS[ORDER[i - 1]].goal} poin di Level ${LEVELS[ORDER[i - 1]].name} untuk membuka` : 'Masuk atau daftar untuk membuka level ini');
      sel.level = k; [...box.children].forEach(c => c.classList.remove('on')); b.classList.add('on');
    };
    box.append(b);
  }
}
function renderUser() {
  const u = auth.user;
  $('#nameSec').hidden = !!u; $('#guestNote').hidden = !!u; $('#ubOut').hidden = !u;
  $('#ubName').textContent = u ? '👤 ' + u.name : '';
  $('#userbar').hidden = !u;
}
const drawMenu = () => { themeChips(); chips($('#weapons'), WEAPONS, 'weapon'); levelChips(); renderUser(); };
drawMenu();
$('#file').onchange = async e => {
  const files = [...e.target.files]; if (!files.length) return;
  showLoad('Memuat gambar');
  await Promise.all(files.map(f => addCustom(URL.createObjectURL(f))));
  sel.theme = [...new Set([...getThemes(), 'custom'])].join(','); drawMenu(); e.target.value = '';
  await hideLoad(400);
};

// ---- scene ----
ltxt.textContent = 'Menyiapkan mesin 3D'; await sleep(50);
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const low = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 2;
let maxPr = low ? 1 : coarse ? 1.5 : Math.min(devicePixelRatio, 2), pr = maxPr;
qty = low ? 14 : 24;
const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: devicePixelRatio < 2 && !low });
renderer.setPixelRatio(pr);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1630);
scene.fog = new THREE.Fog(0x0b1630, 15, 48);
const cam = new THREE.PerspectiveCamera(60, 1, .1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.8));
const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(3, 6, 4); scene.add(dl);
{ const p = []; for (let i = 0; i < 250; i++) p.push((Math.random() - .5) * 90, (Math.random() - .5) * 50, -30 - Math.random() * 20);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db4ff, size: .15 }))); }
let vw = innerWidth, vh = innerHeight;
function resize() { vw = innerWidth; vh = innerHeight; renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 1 ? 78 : 60; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---- state ----
let running = false, hits = 0, shots = 0, shake = 0, kick = 0, view, player = 'Pemain', serverBest = {}, score = 0, combo = 0, timeLeft = 0, spawnT = 0, last = 0, ac;
const targets = [], projs = [], fx = [];
const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
const bestKey = () => 'shoot3d-best-' + sel.level;
const best = () => { if (auth.user) return serverBest[sel.level] || 0; let l = 0; try { l = +localStorage.getItem(bestKey()) || 0; } catch {} return l; };
scene.add(cam);
let hudS = '', tracerT = 0, accT = 0, accN = 0, good = 0;
const setPr = v => { pr = v; qty = pr < .9 ? 12 : 24; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); };
const setView = () => { if (view) cam.remove(view); view = makeView(sel.weapon); view.visible = false; cam.add(view); };
async function apix(url, body) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: ctl.signal });
    let data = null; try { data = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: null }; } finally { clearTimeout(tm); }
}
async function api(url, body) { const r = await apix(url, body); return r.ok ? r.data : null; }
async function loadCfg() { auth.cfg = await api('/api/config'); }
async function loadMe() {
  const me = await api('/api/me'); if (!me) return;
  auth.user = me.user || null; auth.unlocked = me.unlocked || [ORDER[0]]; serverBest = me.best || {};
  if (auth.user) {
    const p = auth.user.prefs || {};
    const ts = String(p.theme || '').split(',').filter(k => THEMES[k] && k !== 'custom'); if (ts.length) sel.theme = ts.join(',');
    if (p.weapon in WEAPONS) sel.weapon = p.weapon; if (p.level in LEVELS && allowed(p.level)) sel.level = p.level;
  }
  drawMenu();
}
async function board() {
  pending('Memuat peringkat');
  const r = await api('/api/leaderboard?level=' + sel.level), ol = $('#lb'); ol.innerHTML = '';
  (r?.rows || []).forEach((x, i) => { const li = document.createElement('li'); li.textContent = `${x.name} — ${x.score}`; if (auth.user && x.name === auth.user.name) li.className = 'me'; ol.append(li); });
  if (!ol.children.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = r ? 'Belum ada skor' : 'Peringkat tidak tersedia'; ol.append(li); }
}
try { $('#name').value = localStorage.getItem('shoot3d-name') || ''; } catch {}
$('#name').onchange = () => { try { localStorage.setItem('shoot3d-name', $('#name').value.trim()); } catch {} };
const mePromise = Promise.all([loadCfg(), loadMe()]);

function beep(f) {
  try { ac = ac || new AudioContext(); const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f; o.type = 'square'; g.gain.setValueAtTime(.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .12);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .12); } catch {}
}

const protos = {};
function makeTarget(k) {
  const id = k === 'custom' ? 'custom' + customImgs.length : k;
  const a = protos[id] || (protos[id] = Array.from({ length: k === 'custom' ? Math.max(3, customImgs.length * 3) : 10 }, () => THEMES[k].build()));
  return a[Math.random() * a.length | 0].clone();
}
function spawn() {
  const L = LEVELS[sel.level], key = activeThemes[Math.random() * activeThemes.length | 0], th = THEMES[key];
  const g = makeTarget(key); g.scale.setScalar(L.size);
  const z = -(10 + Math.random() * 12), hh = Math.tan(cam.fov * Math.PI / 360) * -z, hw = hh * cam.aspect + 2, dir = Math.random() < .5 ? 1 : -1;
  g.position.set(-dir * hw, (Math.random() - .5) * hh * 1.3, z);
  Object.assign(g.userData, { vx: dir * L.speed * (.6 + Math.random() * .8), by: g.position.y, amp: Math.random() * 2, f: 1 + Math.random() * 2, age: 0, hw,
    spin: th.flat ? new THREE.Vector3(0, 0, .6) : new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2), r: .8 * L.size, dead: 0 });
  scene.add(g); targets.push(g);
}
function removeFrom(arr, o) { scene.remove(o.m || o); const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); }

function hit(t) {
  const u = t.userData; if (u.dead) return; u.dead = 1;
  combo++; hits++; score += 10 * LEVELS[sel.level].mult * Math.min(combo, 5); beep(880); explode(scene, t); shake = .6; removeFrom(targets, t);
}
const knife = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.05, .12, .6), new THREE.MeshBasicMaterial({ color: 0xdddddd })));
  const h = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .3), new THREE.MeshBasicMaterial({ color: 0x5c3b1e })); h.position.z = -.4; g.add(h); return g; };
const arrow = () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xc9a066 }));
  s.rotation.x = Math.PI / 2; const t = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  t.rotation.x = Math.PI / 2; t.position.z = .65; g.add(s, t); return g; };

const tracerGeo = new THREE.BufferGeometry(); tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe066 })); tracer.visible = false; tracer.frustumCulled = false; scene.add(tracer);
let knifeT, arrowT;
function fire() {
  const now = performance.now() / 1000, W = WEAPONS[sel.weapon];
  if (now - last < W.cd) return; last = now; shots++; kick = 1; beep(W.f);
  ray.setFromCamera(ndc, cam);
  const o = ray.ray.origin.clone().add(new THREE.Vector3(0, -.5, -1).applyQuaternion(cam.quaternion)), d = ray.ray.direction.clone();
  if (!W.speed) {
    const h = ray.intersectObjects(targets.filter(t => !t.userData.dead), true)[0];
    const end = h ? h.point : o.clone().addScaledVector(d, 40);
    const pa = tracerGeo.attributes.position; pa.setXYZ(0, o.x, o.y, o.z); pa.setXYZ(1, end.x, end.y, end.z); pa.needsUpdate = true; tracer.visible = true; tracerT = .07;
    if (h) { let t = h.object; while (t.parent !== scene) t = t.parent; hit(t); } else combo = 0;
  } else {
    const m = (W.shape === 'knife' ? (knifeT = knifeT || knife()) : (arrowT = arrowT || arrow())).clone(); m.position.copy(o); m.lookAt(o.clone().add(d)); scene.add(m);
    projs.push({ m, d, v: W.speed, r: W.r, life: 2 });
  }
}
function aim(e) {
  ndc.set(e.clientX / vw * 2 - 1, -(e.clientY / vh) * 2 + 1);
  $('#cross').style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  cam.rotation.set(ndc.y * .06, -ndc.x * .12, 0);
}
addEventListener('pointermove', aim, { passive: true });
$('#c').addEventListener('pointerdown', e => { aim(e); if (running) fire(); });

function clearScene() { for (const a of [targets, projs, fx]) { for (const o of a) scene.remove(o.m || o); a.length = 0; } }

let starting = false;
async function start() {
  if (starting) return; starting = true; showLoad('Menyiapkan objek & senjata'); if (!allowed(sel.level)) sel.level = ORDER[0];
  await sleep(80);
  try {
  activeThemes = getThemes().filter(k => k !== 'custom' || customImgs.length); if (!activeThemes.length) activeThemes = ['campur'];
  activeThemes.forEach(k => makeTarget(k));
  try { ac = ac || new AudioContext(); ac.resume(); } catch {}
  clearScene(); clearFx(); try { setView(); } catch (e) { console.error(e); view = null; } hits = 0; shots = 0; score = 0; combo = 0; spawnT = 0; timeLeft = LEVELS[sel.level].time;
  player = auth.user ? auth.user.name : ($('#name').value.trim() || 'Tamu').slice(0, 20);
  if (auth.user) api('/api/prefs', { prefs: sel });
  if (view) view.visible = true; $('#menu').hidden = $('#end').hidden = true; $('#hud').hidden = false; $('#bs').textContent = best();
  } catch (e) { showErr(e.message); }
  await hideLoad(550); running = true; starting = false;
}
async function end() {
  running = false; if (view) view.visible = false; $('#hud').hidden = true;
  const b = Math.max(best(), score); if (!auth.user) try { localStorage.setItem(bestKey(), b); } catch {}
  serverBest[sel.level] = b;
  $('#endt').textContent = score >= LEVELS[sel.level].goal ? '🏆 Menang!' : '💥 Waktu Habis';
  $('#es').textContent = score; $('#eb').textContent = b; $('#end').hidden = false;
  const won = score >= LEVELS[sel.level].goal, note = $('#endnote'), i = ORDER.indexOf(sel.level);
  note.hidden = true; $('#endcta').hidden = true;
  if (auth.user) {
    pending('Menyimpan skor');
    const r = await api('/api/score', { score, hits, shots, theme: sel.theme, weapon: sel.weapon, level: sel.level });
    if (r) {
      const before = auth.unlocked; auth.unlocked = r.unlocked || before;
      const fresh = auth.unlocked.filter(k => !before.includes(k));
      if (fresh.length) note.textContent = '🔓 Level ' + fresh.map(k => LEVELS[k].name).join(', ') + ' terbuka!';
      else if (!won && ORDER[i + 1] && !auth.unlocked.includes(ORDER[i + 1])) note.textContent = `Capai ${LEVELS[sel.level].goal} poin untuk membuka Level ${LEVELS[ORDER[i + 1]].name}`;
      else note.textContent = '✅ Skor tersimpan';
      drawMenu();
    } else note.textContent = '⚠ Skor gagal disimpan (periksa koneksi)';
    note.hidden = false;
  } else {
    note.textContent = '👤 Mode Tamu: skor tidak disimpan & hanya Level Mudah.'; note.hidden = false; $('#endcta').hidden = false;
  }
  board();
}
$('#start').onclick = $('#again').onclick = start;
$('#home').onclick = () => { $('#end').hidden = true; $('#menu').hidden = false; };
$('#quit').onclick = () => { running = false; if (view) view.visible = false; $('#hud').hidden = true; $('#menu').hidden = false; };

function loop(ts) {
  requestAnimationFrame(loop);
  const raw = (ts - (loop.p || ts)) / 1000, dt = Math.min(raw, .05); loop.p = ts;
  const L = LEVELS[sel.level];
  if (running) {
    timeLeft -= dt; spawnT -= dt;
    if (spawnT <= 0) { if (targets.length < 14) spawn(); spawnT = L.spawn * (.7 + Math.random() * .6); }
    if (timeLeft <= 0) end();
    const hs = score + '|' + Math.max(0, timeLeft | 0) + '|' + Math.min(combo, 5);
    if (hs !== hudS) { hudS = hs; $('#sc').textContent = score; $('#tm').textContent = Math.max(0, timeLeft | 0); $('#cb').textContent = Math.min(combo, 5); }
  }
  for (const t of [...targets]) {
    const u = t.userData; u.age += dt;
    if (u.dead) { u.dead += dt; const s = L.size * (u.dead < .1 ? 1 + u.dead * 4 : Math.max(0, 1.4 - (u.dead - .1) * 5.6)); t.scale.setScalar(Math.max(s, .0001)); if (s <= 0) removeFrom(targets, t); continue; }
    t.position.x += u.vx * dt; t.position.y = u.by + Math.sin(u.age * u.f) * u.amp;
    t.rotation.x += u.spin.x * dt; t.rotation.y += u.spin.y * dt; t.rotation.z += u.spin.z * dt;
    if (u.age > 1 && Math.abs(t.position.x) > u.hw + 1) removeFrom(targets, t);
  }
  for (const p of [...projs]) {
    p.m.position.addScaledVector(p.d, p.v * dt); p.life -= dt;
    const t = targets.find(t => !t.userData.dead && t.position.distanceTo(p.m.position) < t.userData.r + p.r);
    if (t) { hit(t); removeFrom(projs, p); } else if (p.life <= 0) { combo = 0; removeFrom(projs, p); }
  }
  if (tracerT > 0 && (tracerT -= dt) <= 0) tracer.visible = false;
  updateFx(dt); kick = Math.max(0, kick - dt * 6); shake = Math.max(0, shake - dt * 3);
  cam.position.set((Math.random() - .5) * shake * .2, (Math.random() - .5) * shake * .2, 0);
  if (view) updateView(view, ndc, cam, kick, performance.now() / 1000 - last >= WEAPONS[sel.weapon].cd * .9);
  for (const f of [...fx]) { f.life -= dt; if (f.life <= 0) removeFrom(fx, f); }
  if (!running && !targets.length && !projs.length && !parts.length) return;
  renderer.render(scene, cam);
  if (running && raw < .5) {
    accT += raw; accN++;
    if (accT >= 1.5) { const fps = accN / accT; accT = accN = 0;
      if (fps < 40 && pr > .5) { good = 0; setPr(pr - .25); } else if (fps > 56 && pr < maxPr && ++good >= 3) { good = 0; setPr(pr + .25); } }
  }
}
// ===== autentikasi =====
let amode = 'in';
const guestSess = () => { try { return sessionStorage.getItem('s3d-guest') === '1'; } catch { return false; } };
const setGuestSess = v => { try { v ? sessionStorage.setItem('s3d-guest', '1') : sessionStorage.removeItem('s3d-guest'); } catch {} };
function setMode(m) {
  amode = m; $('#tabIn').classList.toggle('on', m === 'in'); $('#tabUp').classList.toggle('on', m === 'up');
  $('#aName').hidden = m === 'in'; $('#aSubmit').textContent = m === 'in' ? 'Masuk' : 'Daftar'; $('#aMsg').textContent = '';
  $('#aPass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
}
const showAuth = () => { $('#menu').hidden = $('#end').hidden = true; $('#auth').hidden = false; };
const showMenu = () => { $('#auth').hidden = true; $('#menu').hidden = false; drawMenu(); };
const route = () => { (auth.user || guestSess()) ? showMenu() : showAuth(); };
async function afterLogin() { setGuestSess(false); await loadMe(); showMenu(); await hideLoad(500); }
$('#tabIn').onclick = () => setMode('in'); $('#tabUp').onclick = () => setMode('up');
$('#authForm').onsubmit = async e => {
  e.preventDefault(); const msg = $('#aMsg'); msg.textContent = '';
  const em = $('#aEmail').value.trim(), pw = $('#aPass').value;
  if (!em || !pw || (amode === 'up' && $('#aName').value.trim().length < 2)) { msg.textContent = amode === 'up' ? 'Lengkapi nama, email, dan kata sandi' : 'Isi email dan kata sandi'; return; }
  showLoad(amode === 'in' ? 'Sedang masuk' : 'Membuat akun');
  const r = await apix(amode === 'in' ? '/api/login' : '/api/register', { name: $('#aName').value, email: em, password: pw });
  if (!r.ok) { msg.textContent = r.data?.error || 'Gagal terhubung ke server'; await hideLoad(300); return; }
  $('#aPass').value = ''; await afterLogin();
};
$('#guestBtn').onclick = () => { setGuestSess(true); showMenu(); };
$('#gnIn').onclick = $('#endcta').onclick = showAuth;
$('#ubOut').onclick = async () => {
  showLoad('Keluar'); await api('/api/logout', {});
  auth.user = null; auth.unlocked = [ORDER[0]]; serverBest = {}; setGuestSess(false); setMode('in'); showAuth(); await hideLoad(400);
};
async function initGoogle() {
  const id = auth.cfg?.googleClientId; if (!id) { $('#gwrap').hidden = true; return; }
  try {
    await new Promise((res, rej) => { const el = document.createElement('script'); el.src = 'https://accounts.google.com/gsi/client'; el.async = true; el.onload = res; el.onerror = rej; document.head.append(el); });
    google.accounts.id.initialize({ client_id: id, callback: async resp => {
      showLoad('Masuk dengan Google');
      const r = await apix('/api/auth/google', { credential: resp.credential });
      if (!r.ok) { $('#aMsg').textContent = r.data?.error || 'Login Google gagal'; await hideLoad(300); return; }
      await afterLogin(); } });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
  } catch { $('#gwrap').hidden = true; }
}

ltxt.textContent = 'Menyiapkan efek & senjata'; await sleep(50);
initFx(scene);
try { setView(); view.visible = true; tracer.visible = true; [...pool, ...flashPool].forEach(m => { m.visible = true; }); renderer.compile(scene, cam); } catch (e) { console.warn(e); }
if (view) view.visible = false; tracer.visible = false; [...pool, ...flashPool].forEach(m => { m.visible = false; });
requestAnimationFrame(loop);
ltxt.textContent = 'Menyambung ke server'; await Promise.race([mePromise, sleep(2500)]);
route(); window.__ready = true; await hideLoad(700); initGoogle();
