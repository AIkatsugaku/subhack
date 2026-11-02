(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const yen = n => Math.round(n).toLocaleString('ja-JP');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flat = s => s.replace(/\n/g, '');
  const STORE_KEY = 'subsc.items.v1';

  // 定番 TOP10 の並び（ランキング行に表示）
  const TOP10 = ['netflix', 'amazonprime', 'youtubepremium', 'spotify', 'disneyplus', 'unext', 'chatgpt', 'icloud', 'applemusic', 'nso'];

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
  const itemName = i => i.label || i.name || flat(SVC[i.sid]?.n || '');

  // ---------- アイコン ----------
  function iconOf(it) {
    const s = SVC[it.sid];
    if (s) return { c: s.c, t: s.t ?? flat(s.n).slice(0, 1), img: s.img };
    return { c: it.color || '#555', t: (it.name || '?').slice(0, 1) };
  }
  const isSmall = t => [...(t || '')].length >= 3;
  function icoHTML(ic, extra = '') {
    if (ic.img) return `<span class="ico ${extra}" style="background:${ic.c}"><img src="${esc(ic.img)}" alt=""></span>`;
    return `<span class="ico${isSmall(ic.t) ? ' sm' : ''} ${extra}" style="background:${ic.c}">${esc(ic.t || '')}</span>`;
  }
  function glyphHTML(ic) {
    if (ic.img) return `<span class="glyph"><img src="${esc(ic.img)}" alt=""></span>`;
    return `<span class="glyph${isSmall(ic.t) ? ' sm' : ''}">${esc(ic.t || '')}</span>`;
  }
  function cardHTML(s) {
    return `<button class="tile${s.multi ? ' multi' : ''}" data-sid="${s.id}" style="--c:${s.c}" type="button" aria-label="${esc(flat(s.n))}">
      ${glyphHTML(iconOf({ sid: s.id }))}<span class="tname">${esc(flat(s.n))}</span></button>`;
  }
  const rowHTML = ({ id, cls = '', title, extra = '', desc = '', track }) => `
    <section class="row ${cls}" ${id ? `id="${id}"` : ''}>
      <div class="row-head"><h2>${title}</h2>${extra}</div>
      ${desc ? `<p class="row-desc">${desc}</p>` : ''}
      <div class="row-wrap">
        <button class="arrow l" type="button" aria-label="前へ">‹</button>
        <div class="track">${track}</div>
        <button class="arrow r" type="button" aria-label="次へ">›</button>
      </div>
    </section>`;

  // ---------- 描画 ----------
  function renderHeroBg() {
    const pool = Object.values(SVC).filter(s => !s.multi);
    const pick = [];
    for (let i = 0; i < 64; i++) pick.push(pool[(i * 37) % pool.length]);
    $('#heroBg').innerHTML = pick.map(s => `<i style="background:${s.c}">${esc(iconOf({ sid: s.id }).t)}</i>`).join('');
  }

  function renderRows() {
    const my = rowHTML({ id: 'rowMy', cls: 'my', title: 'マイリスト', extra: '<span class="more" id="myMeta"></span>', track: '' });
    const top = rowHTML({
      cls: 'top', title: '定番サブスク TOP 10',
      track: TOP10.filter(id => SVC[id]).map((id, i) => `<div class="rank"><span class="num">${i + 1}</span>${cardHTML(SVC[id])}</div>`).join(''),
    });
    const cats = CATEGORIES.map(cat => rowHTML({
      id: 'cat-' + cat.id, cls: 'cat',
      title: esc(cat.name),
      extra: (cat.required ? '<span class="req">必須</span>' : '') + `<span class="more">${cat.items.length}件${cat.note ? ' ' + esc(cat.note) : ''}</span>`,
      desc: cat.desc ? esc(cat.desc) : '',
      track: cat.items.map(cardHTML).join('') +
        `<button class="tile add" data-add="${cat.id}" type="button"><span class="glyph">＋</span><span class="tname">その他を追加</span></button>`,
    })).join('');
    $('#rows').innerHTML = my + top + cats;
    $$('.row.cat').forEach((el, i) => el.dataset.cat = CATEGORIES[i].id);

    $('#chips').innerHTML = `<button class="chip all" id="chipAll" type="button">ジャンル</button>` +
      CATEGORIES.map(c => `<button class="chip" data-go="${c.id}" type="button">${esc(c.name)}<span class="dot" hidden></span></button>`).join('');

    $('#serviceCount').textContent = totalServices;
  }

  function renderMyList() {
    const row = $('#rowMy');
    row.hidden = !items.length;
    if (!items.length) return;
    const seen = new Set();
    const cards = [];
    items.forEach(i => {
      if (SVC[i.sid]) {
        if (seen.has(i.sid)) return;
        seen.add(i.sid); cards.push(cardHTML(SVC[i.sid]));
      } else {
        cards.push(`<button class="tile sel" data-custom="${i.uid}" style="--c:${i.color || '#555'}" type="button">${glyphHTML(iconOf(i))}<span class="tname">${esc(i.name)}</span><span class="tprice"><b>¥${yen(i.price)}</b></span></button>`);
      }
    });
    $('.track', row).innerHTML = cards.join('');
    $('#myMeta').textContent = `${items.length}件・月¥${yen(sum(items))}`;
  }

  function refreshTiles() {
    $$('.tile[data-sid]').forEach(el => {
      const list = itemsOf(el.dataset.sid);
      el.classList.toggle('sel', list.length > 0);
      let pr = el.querySelector('.tprice');
      let cnt = el.querySelector('.cnt');
      if (list.length) {
        if (!pr) { pr = document.createElement('span'); pr.className = 'tprice'; el.appendChild(pr); }
        pr.innerHTML = `<b>¥${yen(sum(list))}</b>`;
        if (list.length > 1) {
          if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; el.appendChild(cnt); }
          cnt.textContent = '×' + list.length;
        } else cnt?.remove();
      } else { pr?.remove(); cnt?.remove(); }
    });
    $$('.chip[data-go]').forEach(ch => {
      const n = items.filter(i => i.cat === ch.dataset.go).length;
      const dot = ch.querySelector('.dot');
      dot.hidden = !n; dot.textContent = n;
    });
  }

  function refreshBar() {
    const total = sum(items);
    const last = items.slice(-4).reverse();
    $('#barIcons').innerHTML = last.map(i => icoHTML(iconOf(i))).join('') + (items.length > 4 ? `<span class="more">+${items.length - 4}</span>` : '');
    $('#barCount').textContent = items.length ? `${items.length}件・年¥${yen(total * 12)}` : 'まだ選ばれていません';
    $('#barSum').innerHTML = `¥${yen(total)}<small>/月</small>`;
    $('#btnCard').classList.toggle('ready', items.length > 0);
  }

  function refresh() { save(); renderMyList(); refreshTiles(); refreshBar(); }

  // ---------- モーダル ----------
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
      <a class="btn red" href="${esc(url)}" target="_blank" rel="sponsored noopener">公式サイトを見る<small>PR</small></a>
    </div>`;
  }

  function customBlock({ withName, nameLabel = '名前', title = '＋ リストにないプラン・金額', submitLabel = '追加する' }) {
    return `<div class="custom" id="customBox">
      <div class="custom-title">${esc(title)}</div>
      ${withName ? `<input class="field" type="text" id="cName" placeholder="${esc(nameLabel)}" maxlength="30">` : ''}
      <div class="row2">
        <input class="field" type="number" id="cPrice" inputmode="numeric" min="0" placeholder="金額（円）">
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

  function bannerHTML(ic, title) {
    const g = ic.img ? `<img src="${esc(ic.img)}" alt="">` : esc(ic.t || '');
    return `<div class="sh-banner" style="--c:${ic.c}"><span class="bg-glyph">${g}</span><h3>${esc(title)}</h3></div>`;
  }

  function openService(sid, fromEl) {
    const s = SVC[sid];
    const cur = itemsOf(sid);
    const single = !s.multi ? cur[0] : null;
    const active = s.p.filter(p => !p[3]);
    const old = s.p.filter(p => p[3]);
    const min = Math.min(...s.p.map(p => p[1]));
    const planRow = (p, i) => `
      <button class="plan${single && single.plan === p[0] && single.price === p[1] ? ' on' : ''}" data-i="${i}" type="button">
        <span class="radio"></span>
        <span class="pl">${esc(p[0])}${p[2] ? `<small>${esc(p[2])}</small>` : ''}</span>
        <span class="pp">¥<b>${yen(p[1])}</b>/月</span>
      </button>`;

    let html = bannerHTML(iconOf({ sid }), flat(s.n)) + `
      <div class="sh-meta">
        ${cur.length ? `<span class="match">登録中 ¥${yen(sum(cur))}/月</span>` : `<span class="match">月¥${yen(min)}〜</span>`}
        <span class="meta-box">${esc(CAT[s.cat].name)}</span>
        <span>${s.multi ? '何件でも追加できます' : 'プランを選ぶと合計に入ります'}</span>
      </div>`;

    if (s.multi && cur.length) {
      html += `<div class="sh-group">登録中（${cur.length}件）</div><div class="sh-pad">` + cur.map(i => `
        <div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(i.label || flat(s.n))}</b><small>${esc(i.plan)}</small></div>
        <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button" aria-label="削除">×</button></div>`).join('') + '</div>';
      html += `<div class="sh-group">さらに追加する</div>`;
    }
    if (s.multi) html += `<div class="sh-pad" style="margin-top:8px"><input class="field" type="text" id="mLabel" placeholder="名前（任意）例：推しの名前・店舗名" maxlength="30"></div>`;

    html += `<div class="sh-group">プランを選ぶ</div>` + active.map(p => planRow(p, s.p.indexOf(p))).join('');
    if (old.length) html += `<div class="sh-group">新規受付を終了したプラン</div>` + old.map(p => planRow(p, s.p.indexOf(p))).join('');
    if (!s.multi) {
      html += `<div class="sh-group">そのほか</div>
        <button class="plan${single && single.price === 0 && single.plan === '払っていない' ? ' on' : ''}" data-free type="button">
          <span class="radio"></span><span class="pl">払っていない<small>家族のプランに入っている・特典・無料期間など</small></span><span class="pp">¥<b>0</b>/月</span>
        </button>`;
    }
    html += customBlock({ withName: false, submitLabel: s.multi ? 'この金額で追加' : 'この金額で登録' });
    if (single) html += `<div class="sh-actions"><button class="btn danger" id="btnRemove" type="button">マイリストから外す</button></div>`;
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

  function openAdd(catId, fromEl, presetName = '') {
    const cat = CAT[catId];
    openSheet(bannerHTML({ c: '#3a3a3a', t: '＋' }, 'その他を追加') +
      `<div class="sh-meta"><span class="meta-box">${esc(cat.name)}</span><span>リストにないサービスを自由に登録</span></div>
      ${customBlock({ withName: true, nameLabel: 'サービス名（例：〇〇プレミアム）', title: 'サービス名と金額', submitLabel: 'マイリストに追加' })}`);
    if (presetName) $('#cName').value = presetName;
    bindCustom((price, name, mode) => {
      if (!name) { toast('サービス名を入れてください'); return; }
      const it = { uid: uid(), sid: 'custom', cat: catId, name, plan: mode === 'y' ? `年額 ¥${yen(price * 12)}` : '自分で入力', price, color: '#555' };
      items.push(it); refresh(); closeSheet(); fly(fromEl, iconOf(it)); hideGuide();
    });
  }

  function openList() {
    if (!items.length) {
      openSheet(`<div class="sh-simple"><h3>マイリスト</h3></div><div class="empty-msg">まだ何も選ばれていません。<br>使っているサブスクをタップしてね。</div>`);
      return;
    }
    let html = `<div class="sh-simple"><h3>マイリスト</h3><p>${items.length}件・タップでプラン変更</p></div><div class="sh-pad">`;
    CATEGORIES.forEach(cat => {
      const list = items.filter(i => i.cat === cat.id);
      if (!list.length) return;
      html += `<div class="li-cat">${esc(cat.name)}　¥${yen(sum(list))}</div>` + list.map(i => `
        <div class="li">${icoHTML(iconOf(i))}
          <button class="lt" data-edit="${i.uid}" type="button"><b>${esc(itemName(i))}</b><small>${esc(i.plan)}</small></button>
          <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button" aria-label="削除">×</button>
        </div>`).join('');
    });
    html += `<div class="li-sum"><span>合計</span><span>¥${yen(sum(items))}/月</span></div>
      <button class="btn red" id="lsCard" type="button">合計カードを見る</button>
      <button class="link-btn" id="lsReset" type="button">すべてリセット</button></div>`;
    openSheet(html);
    $$('[data-del]', sheet).forEach(b => b.onclick = () => { items = items.filter(i => i.uid !== b.dataset.del); refresh(); openList(); });
    $$('[data-edit]', sheet).forEach(b => b.onclick = () => {
      const it = items.find(i => i.uid === b.dataset.edit);
      if (it && SVC[it.sid]) openService(it.sid, $(`.row.cat .tile[data-sid="${it.sid}"]`));
    });
    $('#lsCard').onclick = () => { closeSheet(); showCard(); };
    $('#lsReset').onclick = () => {
      if (!confirm('選んだサブスクをすべて消しますか？')) return;
      items = []; refresh(); closeSheet(); toast('リセットしました');
    };
  }

  function openCategories() {
    openSheet(`<div class="sh-simple"><h3>ジャンル</h3><p>タップでジャンプ</p></div><div style="height:12px"></div>
      <div class="cat-list">${CATEGORIES.map(c => {
        const n = items.filter(i => i.cat === c.id).length;
        return `<button data-jump="${c.id}" type="button">${esc(c.name)}<small>${c.items.length}サービス${n ? '・選択中 ' + n : ''}</small></button>`;
      }).join('')}</div>
      <div class="sh-actions" style="margin-top:8px">
        <button class="btn ghost" data-anchor="howto" type="button">契約中のサブスクの確認方法</button>
        <button class="btn ghost" data-anchor="prices" type="button">サブスクの料金一覧</button>
        <button class="btn ghost" data-anchor="faq" type="button">よくある質問</button>
      </div>`);
    $$('[data-jump]', sheet).forEach(b => b.onclick = () => { closeSheet(); jump(b.dataset.jump); });
    $$('[data-anchor]', sheet).forEach(b => b.onclick = () => { closeSheet(); clearSearch(); document.getElementById(b.dataset.anchor).scrollIntoView(); });
  }

  function openHowto() {
    openSheet(`<div class="sh-simple"><h3>使い方</h3><p>30秒で月額の合計がわかります</p></div><div style="height:12px"></div>
      <div class="howto-steps">
        <div><b>1</b><span><strong>使っているサービスをタップ</strong>ジャンルごとに横にスクロールできます</span></div>
        <div><b>2</b><span><strong>プランを選ぶ</strong>わからなければ「だいたいの金額」でOK</span></div>
        <div><b>3</b><span><strong>合計カードを見る</strong>月額・年額を画像で保存してシェア</span></div>
      </div>
      <div class="sh-actions"><button class="btn red" id="howtoGo" type="button">さっそく選ぶ</button></div>`);
    $('#howtoGo').onclick = () => { closeSheet(); startPicking(); };
  }

  function jump(catId) {
    clearSearch();
    document.getElementById('cat-' + catId).scrollIntoView();
  }
  function startPicking() {
    clearSearch();
    $('.row.top').scrollIntoView();
  }

  // ---------- アニメーション ----------
  function fly(fromEl, ic) {
    const src = fromEl?.querySelector('.glyph') || fromEl;
    const dst = $('#barIcons');
    if (!src || !dst || !src.getClientRects().length) return pulse();
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const size = Math.min(a.width, a.height, 60);
    const el = document.createElement('div');
    el.innerHTML = icoHTML(ic);
    const node = el.firstElementChild;
    node.classList.add('fly');
    const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2;
    Object.assign(node.style, { left: x0 + 'px', top: y0 + 'px', width: size + 'px', height: size + 'px', transform: 'scale(1.3)' });
    document.body.appendChild(node);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      node.style.transform = `translate(${b.left + 15 - x0 - size / 2}px, ${b.top + 15 - y0 - size / 2}px) scale(${30 / size})`;
      node.style.opacity = '.7';
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
      openSheet(bannerHTML({ c: '#5a0a10', t: '📱' }, 'スマホ代も入れてね') + `
        <div class="sh-meta"><span>スマホ代も毎月の固定費なので、サブスクとして計算します</span></div>
        <div class="sh-actions">
          <button class="btn red" id="goMobile" type="button">スマホ代を入れて、合計カードを見る</button>
          <p style="font-size:12px;color:var(--sub);margin:12px 0 0">家族が払っている場合はキャリアを選んで「家族が払っている」を、プランがわからない場合はだいたいの額を入れてね。</p>
          <button class="link-btn" id="skipMobile" type="button">スマホ代なしで合計カードを見る</button>
        </div>`);
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
        <div class="card-foot"><span class="brand-s">${esc(SITE.name)}</span></div>
      </div>
      <div class="share-row">
        <button class="btn x" id="shareX" type="button">Xでポスト</button>
        <button class="btn gray" id="saveImg" type="button">画像を保存</button>
      </div>
      <button class="btn ghost" id="editList" type="button">マイリストを編集する</button>

      <div class="panel">
        <h3>サブスク代のまとめ</h3>
        <div class="stat-row">
          <div><small>1日あたり</small><b>¥${yen(total / 30)}</b></div>
          <div><small>年間</small><b>¥${yen(total * 12)}</b></div>
          <div><small>10年で</small><b>¥${yen(total * 120)}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>ジャンル別の内訳</h3>
        ${breakdown.map(b => `<div class="brk"><div class="brk-top"><span>${esc(b.c.name)}（${b.n}）</span><b>¥${yen(b.v)}</b></div>
          <div class="brk-bar"><i style="width:${(b.v / max * 100).toFixed(1)}%"></i></div></div>`).join('')}
      </div>

      <div class="panel">
        <h3>高い順 TOP 5</h3>
        ${sorted.slice(0, 5).map(i => `<div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(itemName(i))}</b><small>${esc(i.plan)}</small></div><span class="lp">¥${yen(i.price)}</span></div>`).join('')}
      </div>

      ${recs.length ? `<div class="panel">
        <h3>見直しで安くなるかも</h3>
        ${recs.map(r => `<div class="rec"><span class="tag">${esc(r.tag)}・PR</span><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p>
          <a class="btn red" href="${esc(r.url)}" target="_blank" rel="sponsored noopener">${esc(r.cta)}</a></div>`).join('')}
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
        <a class="btn red" style="width:auto;height:34px;padding:0 12px;margin:0;font-size:12px" href="${esc(AFFILIATE[i.sid])}" target="_blank" rel="sponsored noopener">見る<small>PR</small></a></div>`).join('')}
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
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.1);
    glow.addColorStop(0, 'rgba(160,10,20,.75)'); glow.addColorStop(1, 'rgba(160,10,20,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const font = '"Noto Sans JP", "Hiragino Sans", sans-serif';
    ctx.fillStyle = '#bbbbbb'; ctx.font = `700 36px ${font}`; ctx.textBaseline = 'top';
    ctx.fillText('#' + SITE.hashtag, pad, pad);

    const sorted = [...items].sort((a, b) => b.price - a.price);
    const maxIcons = 23;
    const shown = sorted.slice(0, sorted.length > maxIcons + 1 ? maxIcons : maxIcons + 1);
    const size = (W - pad * 2 - gap * (cols - 1)) / cols;
    const top = pad + 90;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const drawTile = (x, y, color, text) => {
      ctx.fillStyle = color; roundRect(ctx, x, y, size, size, 18); ctx.fill();
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
      drawTile(pad + (k % cols) * (size + gap), top + Math.floor(k / cols) * (size + gap), '#333', '+' + (sorted.length - shown.length));
    }

    const total = sum(items);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#bbbbbb'; ctx.font = `700 40px ${font}`; ctx.fillText('月額合計', pad, H - 300);
    ctx.fillStyle = '#fff'; ctx.font = `900 150px ${font}`; ctx.fillText('¥' + yen(total), pad, H - 150);
    ctx.fillStyle = '#cccccc'; ctx.font = `700 40px ${font}`;
    ctx.fillText(`年額 ¥${yen(total * 12)}　契約数 ${items.length}件`, pad, H - 80);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e50914'; ctx.font = `900 34px ${font}`;
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
  // 名前・ID・ジャンル名・別名（data.js の SEARCH_ALIASES）を | 区切りでまとめた検索キー
  const searchKey = {};
  Object.values(SVC).forEach(s => {
    const words = [s.n, s.id, CAT[s.cat].name, ...(SEARCH_ALIASES[s.id] || '').split(/\s+/)].filter(Boolean);
    searchKey[s.id] = words.map(norm).join('|');
  });
  const searchBox = $('#hdrSearch'), searchInput = $('#search');
  function applySearch() {
    const raw = searchInput.value.trim();
    const q = norm(raw);
    document.body.classList.toggle('searching', !!q);
    let any = false;
    $$('.row.cat').forEach(sec => {
      let hit = 0;
      $$('.tile[data-sid]', sec).forEach(t => {
        const ok = !q || searchKey[t.dataset.sid].includes(q);
        t.hidden = !ok; if (ok) hit++;
      });
      const add = $('.tile.add', sec);
      if (add) add.hidden = !!q;
      sec.hidden = !!q && !hit;
      if (hit) any = true;
    });
    $('#noResult').hidden = !q || any;
    $('#noResultQ').textContent = raw;
    if (q) window.scrollTo({ top: 0, behavior: 'instant' });
    dispatchEvent(new Event('scroll'));
  }
  function clearSearch() {
    if (!searchInput.value) return;
    searchInput.value = ''; applySearch();
    searchBox.classList.remove('open');
  }
  searchInput.addEventListener('input', applySearch);
  $('#btnSearch').onclick = () => {
    if (searchBox.classList.contains('open') && !searchInput.value) { searchBox.classList.remove('open'); return; }
    searchBox.classList.add('open'); searchInput.focus();
  };
  searchInput.addEventListener('blur', () => { if (!searchInput.value) searchBox.classList.remove('open'); });
  $('#noResultAdd').onclick = () => openAdd('tool', null, searchInput.value.trim());

  // ---------- 料金一覧 ----------
  function renderPrices() {
    $('#priceTables').innerHTML = CATEGORIES.map(c => `<details><summary>${esc(c.name)}　<small style="color:var(--sub);font-weight:400">${c.items.length}サービス</small></summary>
      <div class="ptable"><table>${c.items.map(s => `<tr><td>${esc(s.n)}</td><td>${s.p.map(p => esc(p[0])).join('<br>')}</td><td>${s.p.map(p => '¥' + yen(p[1])).join('<br>')}</td></tr>`).join('')}</table></div></details>`).join('');
  }

  // ---------- ヘッダー・チップ ----------
  function watchScroll() {
    const hdr = $('#hdr');
    const onScroll = () => hdr.classList.toggle('solid', scrollY > 30 || document.body.classList.contains('searching'));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const chips = $('#chips');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.dataset.cat;
        $$('.chip[data-go]').forEach(c => c.classList.toggle('on', c.dataset.go === id));
        const on = $(`.chip[data-go="${id}"]`);
        // smooth にするとページ側のスムーズスクロールが止まるため即時に動かす
        if (on) chips.scrollLeft = on.offsetLeft - chips.offsetLeft - 60;
      });
    }, { rootMargin: '-120px 0px -60% 0px' });
    $$('.row.cat').forEach(s => io.observe(s));
  }

  // ---------- イベント ----------
  document.addEventListener('click', e => {
    const tile = e.target.closest('.tile[data-sid]');
    if (tile) return openService(tile.dataset.sid, tile);
    const add = e.target.closest('.tile[data-add]');
    if (add) return openAdd(add.dataset.add, add);
    if (e.target.closest('.tile[data-custom]')) return openList();
    const chip = e.target.closest('.chip[data-go]');
    if (chip) return jump(chip.dataset.go);
    const arrow = e.target.closest('.arrow');
    if (arrow) {
      const track = arrow.parentElement.querySelector('.track');
      track.scrollBy({ left: (arrow.classList.contains('l') ? -1 : 1) * track.clientWidth * .85, behavior: 'smooth' });
    }
  });
  $('#chips').addEventListener('click', e => { if (e.target.closest('#chipAll')) openCategories(); });
  $('#btnList').onclick = openList;
  $('#btnCard').onclick = showCard;
  $('#btnMenu').onclick = openCategories;
  $('#btnStart').onclick = startPicking;
  $('#btnHowto').onclick = openHowto;
  $('#btnShareSite').onclick = async () => {
    const data = { title: SITE.name, text: 'サブスクの月額合計をタップで計算できるサイト', url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { } return; }
    try { await navigator.clipboard.writeText(location.href); toast('URLをコピーしました'); } catch { toast(location.href); }
  };
  $('#year').textContent = new Date().getFullYear();

  renderHeroBg();
  renderRows();
  renderPrices();
  refresh();
  watchScroll();
})();
