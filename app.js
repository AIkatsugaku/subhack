(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const yen = n => Math.round(n).toLocaleString('ja-JP');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flat = s => s.replace(/\n/g, '');
  const STORE_KEY = 'subsc.items.v1';

  // サービス索引
  const SVC = {};
  const CAT = {};
  CATEGORIES.forEach(cat => {
    CAT[cat.id] = cat;
    cat.items.forEach(s => { s.cat = cat.id; SVC[s.id] = s; });
  });
  const totalServices = Object.keys(SVC).length;

  // ---------- 状態 ----------
  let items = load();
  let skipMobile = false;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch { /* 保存できなくても動作は継続 */ }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sum = list => list.reduce((a, b) => a + b.price, 0);
  const catSum = id => sum(items.filter(i => i.cat === id));
  const itemsOf = sid => items.filter(i => i.sid === sid);

  // ---------- アイコン ----------
  function iconOf(it) {
    const s = SVC[it.sid];
    if (s) return { c: s.c, t: s.t ?? flat(s.n).slice(0, 1), img: s.img };
    return { c: it.color || '#64748B', t: (it.name || '?').slice(0, 1) };
  }
  function icoHTML(ic, extra = '') {
    if (ic.img) return `<span class="ico ${extra}" style="background:${ic.c}"><img src="${esc(ic.img)}" alt=""></span>`;
    const t = ic.t || '';
    const small = [...t].length >= 3 ? ' sm' : '';
    return `<span class="ico${small} ${extra}" style="background:${ic.c}">${esc(t)}</span>`;
  }

  // ---------- カタログ描画 ----------
  function renderCatalog() {
    const total = CATEGORIES.length;
    $('#catalog').innerHTML = CATEGORIES.map((cat, idx) => `
      <section class="cat" id="cat-${cat.id}" data-cat="${cat.id}">
        <div class="cat-head">
          <h2>${esc(cat.name)}</h2>${cat.required ? '<span class="req">必須</span>' : ''}
          <span class="rule"></span><span class="num">${idx + 1}/${total}</span>
        </div>
        ${cat.desc ? `<p class="cat-desc">${esc(cat.desc)}</p>` : ''}
        <div class="grid">
          ${cat.items.map(s => `
            <button class="tile${s.multi ? ' multi' : ''}" data-sid="${s.id}" type="button">
              ${icoHTML(iconOf({ sid: s.id }))}
              <span class="tname">${esc(s.n)}</span>
            </button>`).join('')}
          <button class="tile add" data-add="${cat.id}" type="button">
            <span class="ico">＋</span><span class="tname">その他を追加</span>
          </button>
        </div>
        ${cat.note ? `<p class="cat-desc" style="margin-top:8px">${esc(cat.note)}</p>` : ''}
      </section>`).join('');

    $('#chips').innerHTML = CATEGORIES.map(c =>
      `<button class="chip" data-go="${c.id}" type="button">${esc(c.name)}<span class="dot" hidden></span></button>`).join('');

    $('#serviceCount').textContent = totalServices;
    $('.badge-round b').textContent = totalServices + '+';
  }

  function refreshTiles() {
    $$('.tile[data-sid]').forEach(el => {
      const list = itemsOf(el.dataset.sid);
      el.classList.toggle('sel', list.length > 0);
      let pr = el.querySelector('.tprice');
      let cnt = el.querySelector('.cnt');
      if (list.length) {
        if (!pr) { pr = document.createElement('span'); pr.className = 'tprice'; el.appendChild(pr); }
        pr.textContent = '¥' + yen(sum(list));
        if (list.length > 1) {
          if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; el.appendChild(cnt); }
          cnt.textContent = '×' + list.length;
        } else cnt?.remove();
      } else { pr?.remove(); cnt?.remove(); }
    });
    $$('.chip').forEach(ch => {
      const n = items.filter(i => i.cat === ch.dataset.go).length;
      const dot = ch.querySelector('.dot');
      dot.hidden = !n; dot.textContent = n;
    });
  }

  function refreshBar() {
    const total = sum(items);
    const box = $('#barIcons');
    if (!items.length) box.innerHTML = '<span class="bar-empty"></span>';
    else {
      const last = items.slice(-4);
      box.innerHTML = last.map(i => icoHTML(iconOf(i))).join('') + (items.length > 4 ? `<span class="more">+${items.length - 4}</span>` : '');
    }
    const badge = $('#barBadge');
    badge.hidden = !items.length; badge.textContent = items.length;
    $('#barSum').innerHTML = items.length
      ? `<small>¥</small><b>${yen(total)}</b><small>/月</small>`
      : '<small>¥</small><b>- ---</b><small>/月</small>';
    $('#btnCard').classList.toggle('ready', items.length > 0);
  }

  function refresh() { save(); refreshTiles(); refreshBar(); }

  // ---------- シート ----------
  const sheet = $('#sheet'), sheetBg = $('#sheetBg');
  function openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheetBody').scrollTop = 0;
    sheet.classList.add('on'); sheetBg.classList.add('on');
  }
  function closeSheet() { sheet.classList.remove('on'); sheetBg.classList.remove('on'); }
  sheetBg.onclick = closeSheet;
  $('#sheetClose').onclick = closeSheet;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeResult(); } });

  function affBox(sid) {
    const url = AFFILIATE[sid];
    if (!url) return '';
    return `<div class="aff-box">
      <p>料金・キャンペーンの最新情報は公式サイトで確認できます。</p>
      <a class="btn pr" href="${esc(url)}" target="_blank" rel="sponsored noopener">公式サイトを見る<small>PR</small></a>
    </div>`;
  }

  function customBlock({ withName, nameLabel = '名前', submitLabel = '追加する' }) {
    return `<div class="custom" id="customBox">
      <div class="custom-title">＋ リストにないプラン・金額</div>
      ${withName ? `<input type="text" id="cName" placeholder="${esc(nameLabel)}" maxlength="30">` : ''}
      <div class="row">
        <input type="number" id="cPrice" inputmode="numeric" min="0" placeholder="金額（円）">
        <div class="seg" id="cSeg"><button type="button" class="on" data-v="m">月額</button><button type="button" data-v="y">年額</button></div>
      </div>
      <button class="btn" id="cSubmit" type="button">${esc(submitLabel)}</button>
    </div>`;
  }
  function bindCustom(onSubmit) {
    let mode = 'm';
    $$('#cSeg button').forEach(b => b.onclick = () => {
      mode = b.dataset.v; $$('#cSeg button').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#cSubmit').onclick = () => {
      const v = Number($('#cPrice').value);
      if (!(v >= 0) || $('#cPrice').value === '') { toast('金額を入れてください'); return; }
      const name = $('#cName')?.value.trim() || '';
      onSubmit(mode === 'y' ? Math.round(v / 12) : Math.round(v), name, mode);
    };
  }

  function openService(sid, fromEl) {
    const s = SVC[sid];
    const cur = itemsOf(sid);
    const single = !s.multi ? cur[0] : null;
    const active = s.p.filter(p => !p[3]);
    const old = s.p.filter(p => p[3]);
    const planRow = (p, i) => `
      <button class="plan${single && single.plan === p[0] && single.price === p[1] ? ' on' : ''}" data-i="${i}" type="button">
        <span class="radio"></span>
        <span class="pl">${esc(p[0])}${p[2] ? `<small>${esc(p[2])}</small>` : ''}</span>
        <span class="pp">¥<b>${yen(p[1])}</b>/月</span>
      </button>`;

    let html = `<div class="sh-head">${icoHTML(iconOf({ sid }))}<div><h3>${esc(flat(s.n))}</h3>
      <p>${s.multi ? '何件でも追加できます（タップで追加）' : 'プランを選ぶと合計に入ります'}</p></div></div>`;

    if (s.multi && cur.length) {
      html += `<div class="sh-group">登録中（${cur.length}件）</div>` + cur.map(i => `
        <div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(i.label || flat(s.n))}</b><small>${esc(i.plan)}</small></div>
        <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button">×</button></div>`).join('');
      html += `<div class="sh-group">さらに追加する</div>`;
    }
    if (s.multi) html += `<div class="custom" style="margin-top:10px;padding:10px"><input type="text" id="mLabel" placeholder="名前（任意）例：推しの名前・店舗名" maxlength="30" style="margin:0"></div>`;

    html += active.map(p => planRow(p, s.p.indexOf(p))).join('');
    if (old.length) html += `<div class="sh-group">新規受付を終了したプラン</div>` + old.map(p => planRow(p, s.p.indexOf(p))).join('');
    if (!s.multi) {
      html += `<div class="sh-group">そのほか</div>
        <button class="plan${single && single.price === 0 && single.plan === '払っていない' ? ' on' : ''}" data-free type="button">
          <span class="radio"></span><span class="pl">払っていない<small>家族のプランに入っている・特典・無料期間など</small></span><span class="pp">¥<b>0</b>/月</span>
        </button>`;
    }
    html += customBlock({ withName: false, submitLabel: s.multi ? 'この金額で追加' : 'この金額で登録' });
    if (single) html += `<button class="btn danger" id="btnRemove" type="button">リストから外す</button>`;
    html += affBox(sid);

    openSheet(html);

    const label = () => $('#mLabel')?.value.trim() || '';
    const commit = (plan, price) => {
      if (s.multi) items.push({ uid: uid(), sid, cat: s.cat, plan, price, label: label() });
      else {
        const it = { uid: single?.uid || uid(), sid, cat: s.cat, plan, price };
        if (single) items[items.indexOf(single)] = it; else items.push(it);
      }
      const wasNew = !single;
      refresh();
      closeSheet();
      if (wasNew || s.multi) fly(fromEl, iconOf({ sid }));
      hideGuide();
    };
    $$('.plan[data-i]', sheet).forEach(b => b.onclick = () => { const p = s.p[+b.dataset.i]; commit(p[0], p[1]); });
    $('[data-free]', sheet)?.addEventListener('click', () => commit('払っていない', 0));
    bindCustom((price, _n, mode) => commit(mode === 'y' ? `自分で入力（年額 ¥${yen(price * 12)}）` : '自分で入力', price));
    $('#btnRemove')?.addEventListener('click', () => { items = items.filter(i => i !== single); refresh(); closeSheet(); toast('外しました'); });
    $$('[data-del]', sheet).forEach(b => b.onclick = () => {
      items = items.filter(i => i.uid !== b.dataset.del); refresh(); openService(sid, fromEl);
    });
  }

  function openAdd(catId, fromEl) {
    const cat = CAT[catId];
    openSheet(`<div class="sh-head"><span class="ico" style="background:#64748B">＋</span><div><h3>その他を追加</h3><p>${esc(cat.name)}</p></div></div>
      ${customBlock({ withName: true, nameLabel: 'サービス名（例：〇〇プレミアム）', submitLabel: '追加する' })}`);
    $('#customBox').style.marginTop = '0';
    $('#customBox .custom-title').textContent = 'サービス名と金額を入れてください';
    bindCustom((price, name, mode) => {
      if (!name) { toast('サービス名を入れてください'); return; }
      const it = { uid: uid(), sid: 'custom', cat: catId, name, plan: mode === 'y' ? `年額 ¥${yen(price * 12)}` : '自分で入力', price, color: '#64748B' };
      items.push(it); refresh(); closeSheet(); fly(fromEl, iconOf(it)); hideGuide();
    });
  }

  function openList() {
    if (!items.length) {
      openSheet(`<div class="sh-head"><div><h3>リスト確認・編集</h3></div></div><div class="empty-msg">まだ何も選ばれていません。<br>使っているサブスクをタップしてね。</div>`);
      return;
    }
    let html = `<div class="sh-head"><div><h3>リスト確認・編集</h3><p>${items.length}件・タップでプラン変更</p></div></div>`;
    CATEGORIES.forEach(cat => {
      const list = items.filter(i => i.cat === cat.id);
      if (!list.length) return;
      html += `<div class="li-cat">${esc(cat.name)}　¥${yen(sum(list))}</div>` + list.map(i => `
        <div class="li">${icoHTML(iconOf(i))}
          <button class="lt" data-edit="${i.uid}" type="button" style="text-align:left"><b>${esc(i.label || i.name || flat(SVC[i.sid]?.n || ''))}</b><small>${esc(i.plan)}</small></button>
          <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button" aria-label="削除">×</button>
        </div>`).join('');
    });
    html += `<div class="li-sum"><span>合計</span><span>¥${yen(sum(items))}/月</span></div>
      <button class="btn" id="lsCard" type="button">合計カードを見る</button>
      <button class="link-btn" id="lsReset" type="button">すべてリセット</button>`;
    openSheet(html);
    $$('[data-del]', sheet).forEach(b => b.onclick = () => { items = items.filter(i => i.uid !== b.dataset.del); refresh(); openList(); });
    $$('[data-edit]', sheet).forEach(b => b.onclick = () => {
      const it = items.find(i => i.uid === b.dataset.edit);
      if (it && SVC[it.sid] && !SVC[it.sid].multi) openService(it.sid, $(`.tile[data-sid="${it.sid}"]`));
      else if (it && SVC[it.sid]) openService(it.sid, $(`.tile[data-sid="${it.sid}"]`));
    });
    $('#lsCard').onclick = () => { closeSheet(); showCard(); };
    $('#lsReset').onclick = () => {
      if (!confirm('選んだサブスクをすべて消しますか？')) return;
      items = []; refresh(); closeSheet(); toast('リセットしました');
    };
  }

  function openCategories() {
    openSheet(`<div class="sh-head"><div><h3>カテゴリ</h3><p>タップでジャンプ</p></div></div>
      <div class="cat-list">${CATEGORIES.map(c => `<button data-jump="${c.id}" type="button">${esc(c.name)}<small>${c.items.length}サービス${items.some(i => i.cat === c.id) ? '・選択中 ' + items.filter(i => i.cat === c.id).length : ''}</small></button>`).join('')}</div>
      <button class="btn ghost" data-anchor="howto" type="button">契約中のサブスクの確認方法</button>
      <button class="btn ghost" data-anchor="prices" type="button">サブスクの料金一覧</button>
      <button class="btn ghost" data-anchor="faq" type="button">よくある質問</button>`);
    $$('[data-jump]', sheet).forEach(b => b.onclick = () => { closeSheet(); jump(b.dataset.jump); });
    $$('[data-anchor]', sheet).forEach(b => b.onclick = () => { closeSheet(); document.getElementById(b.dataset.anchor).scrollIntoView(); });
  }

  function jump(catId) {
    $('#search').value = ''; applySearch();
    document.getElementById('cat-' + catId).scrollIntoView();
  }

  // ---------- アニメーション ----------
  function fly(fromEl, ic) {
    const src = fromEl?.querySelector('.ico');
    const dst = $('#barIcons');
    if (!src || !dst) return pulse();
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const el = document.createElement('div');
    el.innerHTML = icoHTML(ic);
    const node = el.firstElementChild;
    node.classList.add('fly');
    Object.assign(node.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', transform: 'scale(2.2)' });
    document.body.appendChild(node);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      node.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.8)`;
      node.style.opacity = '.6';
    }));
    setTimeout(() => { node.remove(); pulse(); }, 620);
  }
  function pulse() {
    const bar = $('#bar');
    bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  // ---------- ガイド ----------
  function hideGuide() {
    $('#guide').classList.add('hide');
    try { localStorage.setItem('subsc.guide', '1'); } catch { }
  }
  try { if (localStorage.getItem('subsc.guide') || items.length) $('#guide').classList.add('hide'); } catch { }
  $('#guideClose').onclick = hideGuide;

  // ---------- 合計カード ----------
  function stateApi() {
    return {
      total: sum(items), count: items.length,
      cat: id => catSum(id), has: sid => items.some(i => i.sid === sid),
    };
  }

  function showCard() {
    if (!items.length) { toast('まずはサブスクをタップしてね'); return; }
    if (!skipMobile && !items.some(i => i.cat === 'mobile')) {
      openSheet(`<div class="sh-head"><span class="ico" style="background:#13294b">📱</span><div><h3>スマホ代も入れてね</h3><p>スマホ代も毎月の固定費なので、サブスクとして計算します</p></div></div>
        <button class="btn" id="goMobile" type="button">スマホ代を入れて、合計カードを見る</button>
        <p style="font-size:12px;color:var(--sub);margin:10px 0 0">家族が払っている場合はキャリアを選んで「家族が払っている」を、プランがわからない場合はだいたいの額を入れてね。</p>
        <button class="link-btn" id="skipMobile" type="button">スマホ代なしで合計カードを見る</button>`);
      $('#goMobile').onclick = () => { closeSheet(); jump('mobile'); toast('キャリアをタップしてね'); };
      $('#skipMobile').onclick = () => { skipMobile = true; closeSheet(); showCard(); };
      return;
    }
    renderResult();
    $('#result').hidden = false;
    $('#result').scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function closeResult() { $('#result').hidden = true; document.body.style.overflow = ''; }
  $('#resultBack').onclick = closeResult;

  function shareText() {
    const total = sum(items);
    return `わたしのサブスクは${items.length}件で月¥${yen(total)}（年¥${yen(total * 12)}）でした！`;
  }

  function renderResult() {
    const total = sum(items);
    const sorted = [...items].sort((a, b) => b.price - a.price);
    const shown = sorted.slice(0, 17);
    const rest = sorted.length - shown.length;
    const date = new Date();
    const breakdown = CATEGORIES.map(c => ({ c, v: catSum(c.id), n: items.filter(i => i.cat === c.id).length }))
      .filter(x => x.n).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...breakdown.map(b => b.v));
    const st = stateApi();
    const recs = RECOMMENDS.filter(r => r.url && (() => { try { return r.when(st); } catch { return false; } })());

    $('#resultBody').innerHTML = `
      <div class="card" id="card">
        <div class="card-head"><span>#${esc(SITE.hashtag)}</span><span>${date.getFullYear()}.${date.getMonth() + 1}</span></div>
        <div class="card-grid">${shown.map(i => icoHTML(iconOf(i))).join('')}${rest > 0 ? `<span class="ico more">+${rest}</span>` : ''}</div>
        <div class="card-total"><span class="lbl">月額合計</span><b>¥${yen(total)}</b></div>
        <div class="card-sub"><span>年額 <b>¥${yen(total * 12)}</b></span><span>契約数 <b>${items.length}</b>件</span></div>
        <div class="card-foot">${esc(SITE.name)}</div>
      </div>
      <div class="share-row">
        <button class="btn x" id="shareX" type="button">Xでポスト</button>
        <button class="btn" id="saveImg" type="button">画像を保存</button>
      </div>
      <button class="btn ghost" id="editList" type="button">リストを編集する</button>

      <div class="panel">
        <h3>サブスク代のまとめ</h3>
        <div class="stat-row">
          <div><small>1日あたり</small><b>¥${yen(total / 30)}</b></div>
          <div><small>年間</small><b>¥${yen(total * 12)}</b></div>
          <div><small>10年で</small><b>¥${yen(total * 120)}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>カテゴリ別の内訳</h3>
        ${breakdown.map(b => `<div class="brk"><div class="brk-top"><span>${esc(b.c.name)}（${b.n}）</span><b>¥${yen(b.v)}</b></div>
          <div class="brk-bar"><i style="width:${(b.v / max * 100).toFixed(1)}%"></i></div></div>`).join('')}
      </div>

      <div class="panel">
        <h3>高い順トップ5</h3>
        ${sorted.slice(0, 5).map(i => `<div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(i.label || i.name || flat(SVC[i.sid]?.n || ''))}</b><small>${esc(i.plan)}</small></div><span class="lp">¥${yen(i.price)}</span></div>`).join('')}
      </div>

      ${recs.length ? `<div class="panel">
        <h3>見直しで安くなるかも</h3>
        ${recs.map(r => `<div class="rec"><span class="tag">${esc(r.tag)}・PR</span><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p>
          <a class="btn pr" href="${esc(r.url)}" target="_blank" rel="sponsored noopener">${esc(r.cta)}</a></div>`).join('')}
        <p class="pr-note">※このエリアは広告（アフィリエイト）を含みます。</p>
      </div>` : ''}
      ${affListPanel()}
    `;

    $('#shareX').onclick = () => {
      const u = new URL('https://twitter.com/intent/tweet');
      u.searchParams.set('text', shareText());
      u.searchParams.set('hashtags', SITE.hashtag);
      u.searchParams.set('url', SITE.url);
      window.open(u.toString(), '_blank', 'noopener');
    };
    $('#saveImg').onclick = saveImage;
    $('#editList').onclick = () => { closeResult(); openList(); };
  }

  // 登録中サービスのうちアフィリエイトURLがあるもの
  function affListPanel() {
    const seen = new Set();
    const list = items.filter(i => AFFILIATE[i.sid] && !seen.has(i.sid) && seen.add(i.sid));
    if (!list.length) return '';
    return `<div class="panel"><h3>あなたのサブスクの公式キャンペーン</h3>
      ${list.map(i => `<div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(flat(SVC[i.sid].n))}</b><small>最新の料金・特典をチェック</small></div>
        <a class="btn pr" style="width:auto;height:34px;padding:0 12px;margin:0;font-size:12px" href="${esc(AFFILIATE[i.sid])}" target="_blank" rel="sponsored noopener">見る<small>PR</small></a></div>`).join('')}
    </div>`;
  }

  // ---------- 画像保存 ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  async function saveImage() {
    const W = 1080, H = 1350, cols = 6, pad = 80, gap = 22;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1f3a66'); g.addColorStop(1, '#0f1f3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const font = '"Noto Sans JP", "Hiragino Sans", sans-serif';
    ctx.fillStyle = '#a9bbd9'; ctx.font = `700 36px ${font}`; ctx.textBaseline = 'top';
    ctx.fillText('#' + SITE.hashtag, pad, pad);

    const sorted = [...items].sort((a, b) => b.price - a.price);
    const maxIcons = 23;
    const shown = sorted.slice(0, sorted.length > maxIcons + 1 ? maxIcons : maxIcons + 1);
    const size = (W - pad * 2 - gap * (cols - 1)) / cols;
    const top = pad + 90;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const drawTile = (x, y, color, text) => {
      ctx.fillStyle = color; roundRect(ctx, x, y, size, size, 26); ctx.fill();
      ctx.fillStyle = '#fff';
      const len = [...text].length;
      ctx.font = `900 ${len >= 4 ? 30 : len === 3 ? 36 : 48}px ${font}`;
      ctx.fillText(text, x + size / 2, y + size / 2 + 2);
    };
    shown.forEach((it, k) => {
      const ic = iconOf(it);
      drawTile(pad + (k % cols) * (size + gap), top + Math.floor(k / cols) * (size + gap), ic.c, ic.t || '');
    });
    if (sorted.length > shown.length) {
      const k = shown.length;
      drawTile(pad + (k % cols) * (size + gap), top + Math.floor(k / cols) * (size + gap), 'rgba(255,255,255,.15)', '+' + (sorted.length - shown.length));
    }

    const total = sum(items);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#a9bbd9'; ctx.font = `700 40px ${font}`; ctx.fillText('月額合計', pad, H - 300);
    ctx.fillStyle = '#fff'; ctx.font = `900 150px ${font}`; ctx.fillText('¥' + yen(total), pad, H - 150);
    ctx.fillStyle = '#c9d6ea'; ctx.font = `700 40px ${font}`;
    ctx.fillText(`年額 ¥${yen(total * 12)}　契約数 ${items.length}件`, pad, H - 80);
    ctx.textAlign = 'right'; ctx.fillStyle = '#7f93b5'; ctx.font = `700 30px ${font}`;
    ctx.fillText(SITE.name, W - pad, H - 80);

    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], 'my-subsc.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() + ' #' + SITE.hashtag }); return; } catch { /* キャンセル時はダウンロードへ */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'my-subsc.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('画像を保存しました');
  }

  // ---------- 検索 ----------
  const kana = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const norm = s => kana(flat(s).normalize('NFKC').toLowerCase().replace(/\s/g, ''));
  // 名前・ID・別名（data.js の SEARCH_ALIASES）を | 区切りでまとめた検索キー
  const searchKey = {};
  Object.values(SVC).forEach(s => {
    const words = [s.n, s.id, ...(SEARCH_ALIASES[s.id] || '').split(/\s+/)].filter(Boolean);
    searchKey[s.id] = words.map(norm).join('|');
  });
  function applySearch() {
    const q = norm($('#search').value);
    let any = false;
    $$('.cat').forEach(sec => {
      let hit = 0;
      $$('.tile[data-sid]', sec).forEach(t => {
        const ok = !q || searchKey[t.dataset.sid].includes(q);
        t.hidden = !ok; if (ok) hit++;
      });
      sec.hidden = !!q && !hit;
      if (hit) any = true;
    });
    $('#noResult').hidden = !q || any;
  }
  $('#search').addEventListener('input', applySearch);

  // ---------- 料金一覧 ----------
  function renderPrices() {
    $('#priceTables').innerHTML = CATEGORIES.map(c => `<details><summary>${esc(c.name)}　<small style="color:var(--sub);font-weight:400">${c.items.length}サービス</small></summary>
      <div class="ptable"><table>${c.items.map(s => `<tr><td>${esc(s.n)}</td><td>${s.p.map(p => esc(p[0])).join('<br>')}</td><td>${s.p.map(p => '¥' + yen(p[1])).join('<br>')}</td></tr>`).join('')}</table></div></details>`).join('');
  }

  // ---------- チップの現在地 ----------
  function watchChips() {
    const chips = $('#chips');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.dataset.cat;
        $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.go === id));
        const on = $(`.chip[data-go="${id}"]`);
        // smooth にするとページ側のスムーズスクロールが止まるため即時に動かす
        if (on) chips.scrollLeft = on.offsetLeft - chips.offsetLeft - 8;
      });
    }, { rootMargin: '-120px 0px -60% 0px' });
    $$('.cat').forEach(s => io.observe(s));
  }

  // ---------- イベント ----------
  document.addEventListener('click', e => {
    const tile = e.target.closest('.tile[data-sid]');
    if (tile) return openService(tile.dataset.sid, tile);
    const add = e.target.closest('.tile[data-add]');
    if (add) return openAdd(add.dataset.add, add);
    const chip = e.target.closest('.chip');
    if (chip) return jump(chip.dataset.go);
  });
  $('#btnList').onclick = openList;
  $('#btnCard').onclick = showCard;
  $('#btnCatAll').onclick = openCategories;
  $('#btnMenu').onclick = openCategories;
  $('#btnShareSite').onclick = async () => {
    const data = { title: SITE.name, text: 'サブスクの月額合計をタップで計算できるサイト', url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { } return; }
    try { await navigator.clipboard.writeText(location.href); toast('URLをコピーしました'); } catch { toast(location.href); }
  };
  $('#year').textContent = new Date().getFullYear();

  renderCatalog();
  renderPrices();
  refresh();
  watchChips();
})();
