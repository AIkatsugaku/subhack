/*
 * サブハック API（Cloudflare Workers + D1）
 * - 管理画面の ID・パスワードのログイン（メンバーごと）
 * - 管理画面からの保存（GitHub API）を中継する。GitHub のトークンはここだけが持ち、ブラウザには渡さない
 * - 公開サイトのアクセス数を1日ごとに集計し、管理画面に返す（個人を特定する情報は保存しない）
 */

const PBKDF2_ITER = 30000;
const SESSION_HOURS = 12;
const enc = new TextEncoder();

// ---------- 小物 ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const randomB64 = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
const nowIso = () => new Date().toISOString();
// 日付は日本時間で区切る
const jstDay = (offsetDays = 0) => new Date(Date.now() + 9 * 3600e3 - offsetDays * 86400e3).toISOString().slice(0, 10);

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function pbkdf2(password, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(salt), iterations: iter }, key, 256);
  return `${iter}:${b64u(bits)}`;
}
async function verifyPassword(password, user) {
  const iter = Number(user.hash.split(':')[0]) || PBKDF2_ITER;
  return safeEqual(await pbkdf2(password, user.salt, iter), user.hash);
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// ---------- 設定（D1 の config 表） ----------
async function getConfig(env, k) {
  const row = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind(k).first();
  return row ? row.v : null;
}
const setConfig = (env, k, v) => env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run();
async function sessionSecret(env) {
  let s = await getConfig(env, 'session_secret');
  if (!s) { s = randomB64(32); await setConfig(env, 'session_secret', s); }
  return s;
}

// ---------- ログインの券（署名付き） ----------
async function issueSession(env, user) {
  const payload = b64u(enc.encode(JSON.stringify({ u: user.id, exp: Date.now() + SESSION_HOURS * 3600e3 })));
  return `${payload}.${await hmac(await sessionSecret(env), payload)}`;
}
async function readSession(env, req) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)\.(.+)$/);
  if (!m) return null;
  const [, payload, sig] = m;
  if (!safeEqual(await hmac(await sessionSecret(env), payload), sig)) return null;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(fromB64u(payload))); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  // メンバーを消したら、その場で使えなくなるよう毎回確かめる
  return env.DB.prepare('SELECT id, name, role FROM users WHERE id = ?').bind(data.u).first();
}

// ---------- 応答 ----------
function corsHeaders(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'X-Accepted-GitHub-Permissions',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const fail = (status, error, message) => json({ error, message }, status);

// ---------- 入力チェック ----------
const ID_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
function checkNewUser({ id, name, password }) {
  if (!ID_RE.test(id || '')) return 'IDは半角英数字（3〜32文字、. _ - も可）にしてください';
  if (!String(name || '').trim()) return '名前を入れてください';
  if (String(password || '').length < 10) return 'パスワードは10文字以上にしてください';
  return '';
}

// ---------- GitHub ----------
async function githubFetch(env, token, path, method = 'GET', body) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'subhack-api',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
// このトークンでリポジトリに保存できるか（参照されないデータを1つ作るだけ）
async function tokenCanWrite(env, token) {
  const r = await githubFetch(env, token, `/repos/${env.REPO}/git/blobs`, 'POST', { content: 'subhack-api-write-check', encoding: 'utf-8' });
  return r.ok;
}

// ---------- ログインの失敗回数（同じ場所からの総当たりを遅らせる） ----------
const failures = new Map();
function tooMany(ip) {
  const f = failures.get(ip);
  return f && f.n >= 8 && Date.now() - f.t < 10 * 60e3;
}
function noteFailure(ip) {
  const f = failures.get(ip);
  if (!f || Date.now() - f.t > 10 * 60e3) failures.set(ip, { n: 1, t: Date.now() });
  else f.n++;
}

// ---------- 処理 ----------
async function handle(req, env, url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  // アクセスの記録（公開サイトから sendBeacon で届く）
  if (path === '/t' && req.method === 'POST') return track(req, env, body);
  if (path === '/hb' && req.method === 'POST') return heartbeat(req, env, body);

  if (path === '/auth/login' && req.method === 'POST') {
    if (tooMany(ip)) return fail(429, 'too_many', 'ログインの失敗が続いています。10分ほど待ってからお試しください');
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(String(body.id || '').trim()).first();
    if (!user || !(await verifyPassword(String(body.password || ''), user))) {
      noteFailure(ip);
      return fail(401, 'bad_login', 'IDかパスワードが違います');
    }
    failures.delete(ip);
    // 書き込みの上限に達した日でもログインはできるように
    try { await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(nowIso(), user.id).run(); } catch (e) { console.error(e); }
    return json({ token: await issueSession(env, user), user: { id: user.id, name: user.name, role: user.role } });
  }

  // 初期設定・管理者の追加：リポジトリに保存できる GitHub トークンを持っている人だけができる
  if (path === '/auth/setup' && req.method === 'POST') {
    if (tooMany(ip)) return fail(429, 'too_many', '失敗が続いています。10分ほど待ってからお試しください');
    const problem = checkNewUser(body);
    if (problem) return fail(400, 'bad_input', problem);
    const gt = String(body.githubToken || '').trim();
    if (!gt || !(await tokenCanWrite(env, gt))) {
      noteFailure(ip);
      return fail(403, 'bad_github', 'このGitHubトークンでは保存できません。Contents の Read and write 権限を確認してください');
    }
    const salt = randomB64(16);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users (id, name, role, salt, hash, created_at) VALUES (?, ?, 'owner', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = 'owner', salt = excluded.salt, hash = excluded.hash`)
        .bind(body.id, String(body.name).trim(), salt, await pbkdf2(body.password, salt), nowIso()),
      env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind('github_token', gt),
    ]);
    const user = { id: body.id, name: String(body.name).trim(), role: 'owner' };
    return json({ token: await issueSession(env, user), user });
  }

  // ここから先はログインが必要
  const me = await readSession(env, req);
  if (!me) return fail(401, 'session', 'ログインの有効期限が切れました。もう一度ログインしてください');
  const isOwner = me.role === 'owner';

  if (path === '/me' && req.method === 'GET') {
    return json({ user: me, githubToken: !!(await getConfig(env, 'github_token')) });
  }

  if (path === '/me/password' && req.method === 'POST') {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
    if (!(await verifyPassword(String(body.current || ''), user))) return fail(400, 'bad_password', '今のパスワードが違います');
    if (String(body.next || '').length < 10) return fail(400, 'bad_input', '新しいパスワードは10文字以上にしてください');
    const salt = randomB64(16);
    await env.DB.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').bind(salt, await pbkdf2(body.next, salt), me.id).run();
    return json({ ok: true });
  }

  // 保存の中継（このリポジトリへの操作だけ）
  if (path === '/gh' && req.method === 'POST') {
    const gt = await getConfig(env, 'github_token');
    if (!gt) return fail(409, 'no_github_token', 'サイトに保存するためのGitHubトークンが登録されていません');
    const p = String(body.path || '');
    const method = String(body.method || 'GET').toUpperCase();
    const prefix = `/repos/${env.REPO}`;
    if (!(p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix + '?')) || p.includes('..')) return fail(400, 'bad_path', 'この操作はできません');
    if (!['GET', 'PUT', 'POST'].includes(method)) return fail(400, 'bad_method', 'この操作はできません');
    let payload = body.body;
    // 履歴で「誰が変更したか」が分かるよう、コミットの説明に名前を付ける
    if (payload && typeof payload.message === 'string') payload = { ...payload, message: `${payload.message}（${me.name}）` };
    const r = await githubFetch(env, gt, p, method, payload);
    const text = await r.text();
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    const need = r.headers.get('X-Accepted-GitHub-Permissions');
    if (need) headers['X-Accepted-GitHub-Permissions'] = need;
    // GitHub 側の 401 は「トークン切れ」なので、ログイン切れと区別する
    return new Response(text, { status: r.status === 401 ? 424 : r.status, headers });
  }

  if (path === '/stats' && req.method === 'GET') return stats(env, url);
  if (path === '/live' && req.method === 'GET') return live(env);

  // ---------- メンバー管理（オーナーだけ） ----------
  if (path === '/users' && req.method === 'GET') {
    if (!isOwner) return fail(403, 'owner_only', 'オーナーだけが見られます');
    const { results } = await env.DB.prepare('SELECT id, name, role, created_at, last_login FROM users ORDER BY created_at').all();
    return json({ users: results });
  }
  if (path === '/users' && req.method === 'POST') {
    if (!isOwner) return fail(403, 'owner_only', 'オーナーだけが追加できます');
    const problem = checkNewUser(body);
    if (problem) return fail(400, 'bad_input', problem);
    if (await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(body.id).first()) return fail(409, 'exists', 'このIDはもう使われています');
    const salt = randomB64(16);
    await env.DB.prepare('INSERT INTO users (id, name, role, salt, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(body.id, String(body.name).trim(), body.role === 'owner' ? 'owner' : 'member', salt, await pbkdf2(body.password, salt), nowIso()).run();
    return json({ ok: true });
  }
  let m = path.match(/^\/users\/([^/]+)$/);
  if (m && req.method === 'DELETE') {
    if (!isOwner) return fail(403, 'owner_only', 'オーナーだけが削除できます');
    const id = decodeURIComponent(m[1]);
    if (id === me.id) return fail(400, 'self', '自分自身は削除できません');
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }
  m = path.match(/^\/users\/([^/]+)\/password$/);
  if (m && req.method === 'POST') {
    if (!isOwner) return fail(403, 'owner_only', 'オーナーだけが変更できます');
    if (String(body.password || '').length < 10) return fail(400, 'bad_input', 'パスワードは10文字以上にしてください');
    const salt = randomB64(16);
    const r = await env.DB.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').bind(salt, await pbkdf2(body.password, salt), decodeURIComponent(m[1])).run();
    if (!r.meta.changes) return fail(404, 'not_found', 'メンバーが見つかりません');
    return json({ ok: true });
  }

  // 保存用の GitHub トークンを入れ替える（オーナーだけ）
  if (path === '/github-token' && req.method === 'POST') {
    if (!isOwner) return fail(403, 'owner_only', 'オーナーだけが変更できます');
    const gt = String(body.githubToken || '').trim();
    if (!gt || !(await tokenCanWrite(env, gt))) return fail(400, 'bad_github', 'このGitHubトークンでは保存できません。Contents の Read and write 権限を確認してください');
    await setConfig(env, 'github_token', gt);
    return json({ ok: true });
  }

  return fail(404, 'not_found', '見つかりません');
}

// ---------- アクセスの記録 ----------
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|quora link|whatsapp|skype|bingpreview/i;
async function track(req, env, b) {
  if (BOT_RE.test(req.headers.get('User-Agent') || '')) return new Response(null, { status: 204 });
  const day = jstDay();
  const clean = (s, max) => String(s || '').slice(0, max).replace(/[\u0000-\u001f]/g, '');
  const stmts = [];
  const add = (kind, key) => stmts.push(env.DB.prepare('INSERT INTO daily (day, kind, key, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind, key) DO UPDATE SET n = n + 1').bind(day, kind, key));
  const page = clean(b.p, 60);
  if (page && /^\/[\w.\-/]*$/.test(page)) {
    add('pv', page);
    if (b.v) add('uv', '');
    const ref = clean(b.r, 80).toLowerCase();
    if (ref && /^[a-z0-9.-]+$/.test(ref)) add('ref', ref);
  }
  // その日はじめての訪問のときだけ、端末・地域・何日目の訪問かを数える（書き込みを少なくするため）
  if (b.v) {
    const pick = (v, list) => (list.includes(v) ? v : '');
    const dev = pick(b.dev, ['スマホ', 'タブレット', 'PC']);
    const os = pick(b.os, ['iPhone・iPad', 'Android', 'Windows', 'Mac', 'その他']);
    const freq = pick(b.freq, ['はじめて', '2〜3日目', '4〜9日目', '10日以上']);
    if (dev) add('dev', dev);
    if (os) add('os', os);
    if (freq) add('freq', freq);
    const cf = req.cf || {};
    const region = cf.country === 'JP' ? clean(cf.region, 40) : (cf.country ? `海外（${clean(cf.country, 4)}）` : '');
    if (region) add('reg', region);
  }
  // ページを見た時間帯（日本時間）
  if (page) add('hour', String(new Date(Date.now() + 9 * 3600e3).getUTCHours()).padStart(2, '0'));
  // 診断で任意に答えてもらった性別・年代
  if (['女性', '男性', 'その他・答えない'].includes(b.sex)) add('sex', b.sex);
  if (['10代', '20代', '30代', '40代', '50代', '60代以上'].includes(b.age)) add('age', b.age);
  const ev = clean(b.e, 40);
  if (ev) add('ev', ev);
  if (stmts.length) await env.DB.batch(stmts);
  return new Response(null, { status: 204 });
}

// ---------- いま見ている人 ----------
const LIVE_MS = 120e3;
async function heartbeat(req, env, b) {
  if (BOT_RE.test(req.headers.get('User-Agent') || '')) return new Response(null, { status: 204 });
  const vid = String(b.vid || '');
  if (!/^[a-z0-9]{8,24}$/.test(vid)) return new Response(null, { status: 204 });
  if (b.bye) {
    await env.DB.prepare('DELETE FROM presence WHERE vid = ?').bind(vid).run();
    return new Response(null, { status: 204 });
  }
  const page = String(b.p || '/').slice(0, 60);
  const now = Date.now();
  const stmts = [env.DB.prepare('INSERT INTO presence (vid, page, seen) VALUES (?, ?, ?) ON CONFLICT(vid) DO UPDATE SET page = excluded.page, seen = excluded.seen')
    .bind(vid, /^\/[\w.\-/]*$/.test(page) ? page : '/', now)];
  // ときどき古い合図を片付ける
  if (Math.random() < 0.02) stmts.push(env.DB.prepare('DELETE FROM presence WHERE seen < ?').bind(now - 10 * 60e3));
  await env.DB.batch(stmts);
  return new Response(null, { status: 204 });
}
async function live(env) {
  const { results } = await env.DB.prepare('SELECT page, COUNT(*) AS n FROM presence WHERE seen > ? GROUP BY page ORDER BY n DESC').bind(Date.now() - LIVE_MS).all();
  return json({ total: results.reduce((a, r) => a + r.n, 0), pages: results.map(r => ({ key: r.page, n: r.n })), at: nowIso() });
}

async function stats(env, url) {
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
  const from = jstDay(days - 1);
  const [daily, tops] = await Promise.all([
    env.DB.prepare("SELECT day, kind, SUM(n) AS n FROM daily WHERE day >= ? AND kind IN ('pv', 'uv') GROUP BY day, kind ORDER BY day").bind(from).all(),
    env.DB.prepare("SELECT kind, key, SUM(n) AS n FROM daily WHERE day >= ? AND kind IN ('pv', 'ref', 'ev', 'dev', 'os', 'freq', 'reg', 'hour', 'sex', 'age') GROUP BY kind, key ORDER BY n DESC").bind(from).all(),
  ]);
  const series = {};
  for (let i = days - 1; i >= 0; i--) series[jstDay(i)] = { pv: 0, uv: 0 };
  daily.results.forEach(r => { if (series[r.day]) series[r.day][r.kind] = r.n; });
  const top = kind => tops.results.filter(r => r.kind === kind).slice(0, 15).map(r => ({ key: r.key, n: r.n }));
  return json({
    days, from, today: jstDay(),
    series: Object.entries(series).map(([day, v]) => ({ day, ...v })),
    pages: top('pv'), refs: top('ref'), events: top('ev'),
    insights: Object.fromEntries(['dev', 'os', 'freq', 'reg', 'hour', 'sex', 'age'].map(k => [k, tops.results.filter(r => r.kind === k).map(r => ({ key: r.key, n: r.n }))])),
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await handle(req, env, url);
    } catch (e) {
      console.error(e);
      res = fail(500, 'server', 'サーバーでエラーが起きました。少し待ってからお試しください');
    }
    const out = new Response(res.body, res);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};
