/*
 * アクセス数の記録（サブハック API の /t に送る）
 * 送るのは「ページ名・その日の初めての訪問か・どのサイトから来たか・押したボタンの種類」だけです。
 * 入力した内容や、個人を特定する情報は送りません。
 */
(() => {
  const url = (typeof API !== 'undefined' && API.url) ? `${API.url}/t` : '';
  if (!url || /^(localhost|127\.)/.test(location.hostname) && !/[?&]track=1/.test(location.search)) {
    window.subTrack = () => {};
    return;
  }
  const send = data => {
    const body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    } catch { /* 下で送る */ }
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  };

  // ページの表示（同じ人は1日1回だけ「訪問者」として数える）
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let first = 1;
  try { first = localStorage.getItem('subhack.seen') === today ? 0 : 1; localStorage.setItem('subhack.seen', today); } catch { }
  let ref = '';
  try { const h = new URL(document.referrer).hostname; if (h && !/sabu-hack\.com$|github\.io$/.test(h)) ref = h; } catch { }
  const page = location.pathname.replace(/^\/subhack/, '') || '/';
  send({ p: page, v: first, r: ref });

  // いま見ている人：開いている間だけ45秒ごとに合図を送る（タブごとのでたらめな番号だけ）
  const hbUrl = url.replace(/\/t$/, '/hb');
  let vid = '';
  try { vid = sessionStorage.getItem('subhack.vid') || ''; } catch { }
  if (!vid) { vid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); try { sessionStorage.setItem('subhack.vid', vid); } catch { } }
  vid = vid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  const beat = bye => {
    const body = JSON.stringify(bye ? { vid, bye: 1 } : { vid, p: page });
    try { if (navigator.sendBeacon && navigator.sendBeacon(hbUrl, new Blob([body], { type: 'text/plain' }))) return; } catch { }
    fetch(hbUrl, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  };
  let timer = null;
  const start = () => { if (timer) return; beat(false); timer = setInterval(() => beat(false), 45e3); };
  const stop = bye => { clearInterval(timer); timer = null; if (bye) beat(true); };
  if (document.visibilityState === 'visible') start();
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? start() : stop(true)));
  addEventListener('pagehide', () => stop(true));

  // ボタン・操作（名前は管理画面の「押されたボタン・操作」にそのまま出ます）
  window.subTrack = name => send({ e: String(name).slice(0, 40) });

  // 外へのリンク：LINE・X・PRリンク
  const kindOf = href => {
    let u;
    try { u = new URL(href, location.href); } catch { return ''; }
    if (u.hostname === 'lin.ee' || /^\/R\/ti\/p\//.test(u.pathname) && u.hostname === 'line.me') return 'LINE友だち追加';
    if (u.hostname === 'line.me' && /oaMessage/.test(u.pathname)) return 'LINEで相談・送信';
    if (u.hostname === 'social-plugins.line.me') return 'LINEでシェア';
    if (/(^|\.)twitter\.com$|(^|\.)x\.com$/.test(u.hostname) && /intent/.test(u.pathname)) return 'Xでシェア';
    return '';
  };
  const open = window.open;
  window.open = function (href, ...rest) {
    const k = kindOf(href);
    if (k) window.subTrack(k);
    return open.call(window, href, ...rest);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const k = kindOf(a.href);
    if (k) { window.subTrack(k); return; }
    if (/\bsponsored\b/.test(a.rel)) {
      let host = '';
      try { host = new URL(a.href).hostname.replace(/^www\./, ''); } catch { }
      window.subTrack(`PRリンク：${host}`);
    }
  }, true);
})();
