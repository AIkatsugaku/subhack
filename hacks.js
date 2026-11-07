/*
 * 合法ライフハック
 * - 固定費レポートの「あなたに使える裏技」欄（buildHackPanel / bindHackPanel、app.js から呼ぶ）
 * - トップページの紹介欄（renderHackTeaser）
 * - 一覧ページ hacks.html（initHacksPage）
 * データは hacks-data.js、読める条件（シェア／合言葉）は HACKS_GATE（管理画面の settings.json でも上書きできます）。
 */
const HACK_UNLOCK_KEY = 'subhack.hacks.unlocked';

// 番号（#1〜）がカテゴリの並び順どおりになるよう、カテゴリ順に並べ替えておく（同じカテゴリ内は書いた順）
if (typeof HACKS !== 'undefined') {
  const order = id => HACK_CATS.findIndex(c => c.id === id);
  HACKS.sort((a, b) => order(a.cat) - order(b.cat));
}

function hackEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const hackNorm = s => String(s || '').normalize('NFKC').trim().toLowerCase();
// シェアで開く（share が false でなければ）か、合言葉で開く（passcode が入っていれば）
const hackShareOn = () => HACKS_GATE.share !== false;
const hackCodeOn = () => !!hackNorm(HACKS_GATE.passcode);
const hackGateOn = () => hackShareOn() || hackCodeOn();
function hackUnlocked() {
  if (!hackGateOn()) return true;
  let v = null;
  try { v = localStorage.getItem(HACK_UNLOCK_KEY); } catch { /* 読めなければ未解放 */ }
  if (hackUnlockedNow) return true;
  return (hackShareOn() && v === 'share') || (hackCodeOn() && v === hackNorm(HACKS_GATE.passcode));
}
let hackUnlockedNow = false;  // 保存できない環境でも、この画面のあいだは開いたままにする
function hackSave(v) {
  hackUnlockedNow = true;
  try { localStorage.setItem(HACK_UNLOCK_KEY, v); } catch { /* この画面では開く */ }
}
function hackTryUnlock(input) {
  if (!hackCodeOn() || hackNorm(input) !== hackNorm(HACKS_GATE.passcode)) return false;
  hackSave(hackNorm(HACKS_GATE.passcode));
  return true;
}
const hackPageUrl = () => new URL('hacks.html', SITE.url || location.href).href;
const hackShareText = () => `ライフハック${HACKS.length}選。サブスク・電気代・病院代から、児童手当・年金・補助金まで`;
const hackCanRead = h => h.free || hackUnlocked();
const hackNo = h => HACKS.indexOf(h) + 1;
const hackCat = id => HACK_CATS.find(c => c.id === id) || { name: '', emoji: '' };
const hackUrl = h => `hacks.html#h-${h.id}`;

function hackBadges(h) {
  return [
    h.top ? `<span class="hk-badge top">効果Top${h.top}</span>` : '',
    h.unv ? '<span class="hk-badge unv">一部未検証</span>' : '',
    h.free && hackGateOn() ? '<span class="hk-badge free">無料公開</span>' : '',
  ].join('');
}

// 仕組み・手順・注意・出典
function hackBodyHTML(h) {
  const e = hackEsc;
  return `<div class="hk-body">
    <h5>しくみ</h5><p>${e(h.how)}</p>
    ${h.steps?.length ? `<h5>やり方</h5><ol class="hk-steps">${h.steps.map(s => `<li>${e(s)}</li>`).join('')}</ol>` : ''}
    ${h.note ? `<h5>条件・注意</h5><p class="hk-note">${e(h.note)}</p>` : ''}
    ${h.src?.length ? `<p class="hk-src">出典：${h.src.map(([t, u]) => `<a href="${e(u)}" target="_blank" rel="noopener">${e(t)}</a>`).join(' ／ ')}</p>` : ''}
  </div>`;
}

// 本文の代わりに出す「シェアで読める」案内
function hackLockHTML(compact) {
  const share = hackShareOn(), code = hackCodeOn();
  return `<div class="hk-lock">
    <p class="hk-lock-h">🔒 この続きは${share ? 'シェアすると' : 'LINE登録で'}読めます</p>
    ${compact ? '' : `<p class="hk-lock-tx">${share
      ? `友だちや家族にこのページをシェアすると、${HACKS.length}件すべての手順・注意点・出典が読めるようになります。`
      : `LINEで友だち追加すると「合言葉」が届きます。入れると${HACKS.length}件すべての手順・注意点・出典が読めます。`}</p>`}
    <div class="hk-lock-btns">
      ${share ? `<div class="hk-share">
        <button class="btn hk-sh-line" type="button" data-hk-share="line">LINEで送る</button>
        <button class="btn x" type="button" data-hk-share="x">Xでシェア</button>
        <button class="btn ghost" type="button" data-hk-share="more">その他・リンクをコピー</button>
      </div>` : '<button class="btn line big" type="button" data-hk-line>LINEで友だち追加して合言葉を受け取る（無料）</button>'}
      ${code ? `<form class="hk-code" data-hk-code>
        <input type="text" name="code" placeholder="${share ? '合言葉をお持ちの方はこちら' : 'LINEで届いた合言葉を入力'}" autocomplete="off" aria-label="合言葉">
        <button class="btn" type="submit">読む</button>
      </form>
      ${share && LINE.addFriendUrl ? '<button class="hk-line-link" type="button" data-hk-line>合言葉はLINE公式アカウントで受け取れます（友だち追加）›</button>' : ''}` : ''}
    </div>
  </div>`;
}

function hackLineAdd(toast) {
  window.subTrack?.('ライフハックからLINE登録');
  if (LINE.addFriendUrl) window.open(LINE.addFriendUrl, '_blank', 'noopener');
  else toast('LINE公式アカウントは準備中です');
}

// シェア先を開く。開いたら（シェアしたものとして）解放する
async function hackShare(kind, toast) {
  const url = hackPageUrl(), text = hackShareText();
  if (kind === 'line') {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    return true;
  }
  if (kind === 'x') {
    const u = new URL('https://twitter.com/intent/tweet');
    u.searchParams.set('text', text);
    u.searchParams.set('url', url);
    if (SITE.hashtag) u.searchParams.set('hashtags', SITE.hashtag);
    window.open(u.toString(), '_blank', 'noopener');
    return true;
  }
  // スマホは共有メニュー、パソコンなどはリンクをコピー
  if (navigator.share) {
    try { await navigator.share({ title: document.title, text, url }); return true; } catch (e) { if (e?.name === 'AbortError') return false; }
  }
  try { await navigator.clipboard.writeText(`${text}
${url}`); toast('リンクをコピーしました。送ってあげてください'); return true; } catch { /* 下へ */ }
  window.prompt('このリンクをコピーして送ってください', url);
  return true;
}

// シェアボタン・合言葉フォーム・友だち追加ボタンを動かす。開けたら onOpen を呼ぶ
function bindHackLock(root, { toast, onOpen }) {
  root.querySelectorAll('[data-hk-line]').forEach(b => b.onclick = () => hackLineAdd(toast));
  root.querySelectorAll('[data-hk-share]').forEach(b => b.onclick = async () => {
    if (!(await hackShare(b.dataset.hkShare, toast))) return;
    hackSave('share');
    window.subTrack?.('ライフハック解放（シェア）');
    // シェア画面から戻ってきたときに開いているよう、少し待ってから描き直す
    setTimeout(() => { toast('シェアありがとうございます！ すべてのライフハックが読めます'); onOpen(); }, 600);
  });
  root.querySelectorAll('[data-hk-code]').forEach(f => f.onsubmit = ev => {
    ev.preventDefault();
    if (hackTryUnlock(f.code.value)) { window.subTrack?.('ライフハック解放（合言葉）'); toast('すべてのライフハックが読めるようになりました'); onOpen(); }
    else { toast('合言葉が違います'); f.code.select(); }
  });
}

// ---------- 固定費レポートの欄 ----------
function hacksFor(items) {
  const mine = new Set(items.map(i => i.sid));
  const hit = h => (h.sids || []).filter(s => mine.has(s)).length;
  return HACKS
    .map(h => ({ h, n: hit(h) }))
    .filter(x => x.n || x.h.all)
    .sort((a, b) => b.n - a.n || (a.h.top || 99) - (b.h.top || 99))
    .map(x => x.h);
}

function buildHackPanel({ items }) {
  if (typeof HACKS === 'undefined') return '';
  const e = hackEsc;
  const mine = hacksFor(items).slice(0, 5);
  // 自分に関係するものが少ないときは、効果の大きいものを足す
  const tops = HACKS.filter(h => h.top && !mine.includes(h)).sort((x, y) => x.top - y.top).slice(0, Math.max(0, 5 - mine.length));
  const rows = [...mine.map(h => [h, true]), ...tops.map(h => [h, false])];
  const row = ([h, pick]) => `<button class="hk-row${pick ? ' pick' : ''}" type="button" data-hk="${e(h.id)}">
      <span class="hk-row-ico">${hackCat(h.cat).emoji}</span>
      <span class="hk-row-tx">${pick ? '<em>あなたに使える</em>' : ''}<b>${e(h.t)}</b><small>💰 ${e(h.e)}</small></span>
      <span class="hk-row-go">${hackCanRead(h) ? '読む ›' : '🔒'}</span>
    </button>`;
  // LINE登録を先にお願いする（合言葉で開く設定で、まだ開いていない人）
  const askLine = !hackUnlocked() && hackCodeOn() && !hackShareOn();
  return `<div class="panel hk-panel">
      <h3>見るだけで面白いライフハック</h3>
      ${askLine ? `<div class="hk-line-cta">
        <p><b>LINE登録で${HACKS.length}件ぜんぶ読めます</b><small>友だち追加すると届く合言葉で、手順・注意点まで開きます（無料）</small></p>
        <button class="btn line" type="button" data-hk-line>LINEで友だち追加</button>
      </div>` : ''}
      <div class="hk-rows">${rows.slice(0, 2).map(row).join('')}</div>
      ${rows.length > 2 ? `<details class="hk-more"><summary>ほかに${rows.length - 2}件を見る</summary>
        <div class="hk-rows">${rows.slice(2).map(row).join('')}</div>
      </details>` : ''}
      <a class="hk-all" href="hacks.html">ライフハック${HACKS.length}選をぜんぶ見る ›</a>
    </div>`;
}

function bindHackPanel(root, { openSheet, toast }) {
  const open = h => {
    const can = hackCanRead(h);
    openSheet(`<article class="guide-article hk-article">
        <p class="guide-cat">${hackCat(h.cat).emoji} ${hackEsc(hackCat(h.cat).name)}のライフハック #${hackNo(h)}</p>
        <h3>${hackEsc(h.t)}</h3>
        <div class="hk-badges">${hackBadges(h)}</div>
        <p class="hk-effect">💰 ${hackEsc(h.e)}</p>
        ${can ? hackBodyHTML(h) : hackLockHTML(false)}
        <a class="btn ghost" href="${hackUrl(h)}">一覧ページで見る</a>
      </article>`);
    const sheet = document.getElementById('sheet');
    if (!can && sheet) bindHackLock(sheet, { toast, onOpen: () => { open(h); refresh(); } });
  };
  // 開けたら欄の鍵マークを消す
  const refresh = () => root.querySelectorAll('.hk-row-go').forEach(s => { s.textContent = '読む ›'; });
  root.querySelectorAll('.hk-panel [data-hk-line]').forEach(b => b.onclick = () => hackLineAdd(toast));
  root.querySelectorAll('[data-hk]').forEach(b => b.onclick = () => {
    const h = HACKS.find(x => x.id === b.dataset.hk);
    if (h) open(h);
  });
}

// ---------- トップページの紹介欄 ----------
function renderHackTeaser(el) {
  if (!el || typeof HACKS === 'undefined') return;
  const e = hackEsc;
  const top = HACKS.filter(h => h.top).sort((a, b) => a.top - b.top).slice(0, 6);
  el.innerHTML = `<h2>ライフハック${HACKS.length}選</h2>
    <p>サブスクの一時停止、電気代・病院代の節約から、児童手当・育休・年金・補助金まで。公式の制度やルールを“設計どおり”に使うものだけを集めました。</p>
    <ol class="hk-teaser">${top.map(h => `<li><a href="${hackUrl(h)}"><b>${e(h.t)}</b><small>💰 ${e(h.e)}</small></a></li>`).join('')}</ol>
    <a class="btn" href="hacks.html">${HACKS.length}件をぜんぶ見る${hackGateOn() ? `<small>${hackShareOn() ? 'シェアで全文' : 'LINE登録で全文'}</small>` : ''}</a>`;
}

// ---------- 一覧ページ（hacks.html） ----------
function initHacksPage() {
  const app = document.getElementById('hacksApp');
  if (!app) return;
  const e = hackEsc;
  const toastEl = document.getElementById('toast');
  let tId;
  const toast = msg => { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(tId); tId = setTimeout(() => toastEl.classList.remove('on'), 2200); };
  let filter = 'all';

  const card = h => {
    const can = hackCanRead(h);
    return `<details class="hk-card" id="h-${e(h.id)}" data-cat="${e(h.cat)}"${h.top ? ' data-top' : ''}>
      <summary>
        <span class="hk-no">#${hackNo(h)}</span>
        <span class="hk-head"><span class="hk-badges">${hackBadges(h)}${can ? '' : `<span class="hk-badge lock">🔒 ${hackShareOn() ? 'シェアで全文' : 'LINE登録で全文'}</span>`}</span>
          <b>${e(h.t)}</b><small>💰 ${e(h.e)}</small></span>
      </summary>
      ${can ? hackBodyHTML(h) : hackLockHTML(true)}
    </details>`;
  };

  const render = () => {
    const unlocked = hackUnlocked();
    const top = HACKS.filter(h => h.top).sort((a, b) => a.top - b.top);
    app.innerHTML = `
      <section class="hk-hero">
        <p class="hero-eyebrow">${!hackGateOn() ? '無料で全文公開' : hackShareOn() ? 'シェアで全文公開' : 'LINE登録で全文公開'}</p>
        <h1><em>ライフハック</em>${HACKS.length}選</h1>
        <p class="hero-lead">詐欺・うその申告・規約の抜け道ではなく、公式の制度やルールを“設計どおり”に使うものだけを集めました。知っているかどうかで差がつく情報の棚卸しです。</p>
        <ul class="hk-stats"><li><b>${HACKS.length}</b>件</li><li><b>${HACK_CATS.length}</b>カテゴリ</li><li><b>${HACKS_UPDATED.replace(/-/g, '/')}</b>調査</li><li>最大<b>110万円</b>級の補助金も</li></ul>
      </section>

      ${unlocked ? '' : `<div class="panel hk-gate">${hackLockHTML(false)}
        ${hackCodeOn() && LINE.qr ? `<img class="hk-qr" src="${e(LINE.qr)}" alt="LINE友だち追加のQRコード（合言葉を受け取れます）">` : ''}</div>`}

      <section class="panel hk-top">
        <h3>効果の大きい Top10</h3>
        <ol>${top.map(h => `<li><a href="#h-${e(h.id)}" data-jump="${e(h.id)}"><b>${e(h.t)}</b><small>💰 ${e(h.e)}</small></a></li>`).join('')}</ol>
      </section>

      <nav class="hk-chips" aria-label="カテゴリ">
        <button type="button" data-f="all" class="on">すべて</button>
        <button type="button" data-f="top">★ Top10</button>
        ${HACK_CATS.map(c => `<button type="button" data-f="${c.id}">${c.emoji} ${e(c.name)}</button>`).join('')}
      </nav>

      ${HACK_CATS.map(c => {
        const list = HACKS.filter(h => h.cat === c.id);
        return `<section class="hk-sec" data-sec="${c.id}">
          <h2>${c.emoji} ${e(c.name)}<small>${list.length}件</small></h2>
          <p class="hk-sec-lead">${e(c.lead)}</p>
          ${list.map(card).join('')}
        </section>`;
      }).join('')}

      <section class="content hk-notes">
        <h2>使う前に</h2>
        <ul>
          <li>${HACKS_UPDATED.replace(/-/g, '/')}時点のWeb調査をもとにしています。金額・キャンペーン期間・条件は変わるので、実行前に必ず各公式ページで最新情報を確認してください。</li>
          <li>「一部未検証」の印がある項目は、ブログ・掲示板・比較記事などだけが根拠の情報を含みます。</li>
          <li>家電の型落ち時期、eSIMの料金比較、マイル購入セールの単価は、時期・在庫・為替で変わります。</li>
          <li>住宅の省エネ補助の正確な金額は、住宅省エネ2026キャンペーン公式サイトの事業ごとのページで確定させてください。</li>
          <li>X（旧Twitter）やブログで話題のライフハックは、出典に「二次情報」と書いています。公式の情報で裏が取れないものは載せていません。</li>
          <li>運送約款に反するおそれがある方法（ヒドゥンシティ発券など）や、VPNでの地域価格の回避、学割の偽装は載せていません。</li>
        </ul>
      </section>`;

    bindHackLock(app, { toast, onOpen: () => { const y = window.scrollY; render(); window.scrollTo(0, y); } });
    app.querySelectorAll('[data-jump]').forEach(a => a.onclick = ev => { ev.preventDefault(); jump(a.dataset.jump); });
    app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; applyFilter(); });
    applyFilter();
  };

  const applyFilter = () => {
    app.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    app.querySelectorAll('.hk-sec').forEach(sec => {
      let shown = 0;
      sec.querySelectorAll('.hk-card').forEach(c => {
        const ok = filter === 'all' || (filter === 'top' ? c.hasAttribute('data-top') : c.dataset.cat === filter);
        c.hidden = !ok; shown += ok;
      });
      sec.hidden = !shown;
    });
  };

  const jump = id => {
    const el = document.getElementById(`h-${id}`);
    if (!el) return;
    if (el.hidden) { filter = 'all'; applyFilter(); }
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#h-${id}`);
  };

  render();
  const fromHash = () => { const m = location.hash.match(/^#h-(.+)$/); if (m) jump(decodeURIComponent(m[1])); };
  fromHash();
  window.addEventListener('hashchange', fromHash);
}
