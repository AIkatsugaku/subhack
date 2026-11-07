(async () => {
  'use strict';
  await window.settingsReady;  // 管理画面の設定を先に反映

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
  // カテゴリを移したサービスも、今のカテゴリで集計する
  items.forEach(i => { if (SVC[i.sid]) i.cat = SVC[i.sid].cat; });

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
    if (s) return { c: s.c, t: s.t ?? flat(s.n).slice(0, 1), img: s.img || (ICON_DOMAINS[s.id] && iconUrl(ICON_DOMAINS[s.id])) };
    return { c: it.color || '#64748B', t: (it.name || '?').slice(0, 1) };
  }
  // 公式アイコンを重ねて表示し、読み込めなければ文字アイコンのまま
  function icoHTML(ic, extra = '') {
    const t = ic.t || '';
    const small = [...t].length >= 3 ? ' sm' : '';
    const img = ic.img ? `<img class="fav" src="${esc(ic.img)}" alt="" loading="lazy" onload="icoLoaded(this)" onerror="this.remove()">` : '';
    return `<span class="ico${small} ${extra}" style="background:${ic.c}">${esc(t)}${img}</span>`;
  }
  // アイコン取得先は不明なドメインに 16px の既定アイコンを返すので、それは使わない
  window.icoLoaded = img => {
    if (img.naturalWidth <= 16) img.remove();
    else img.parentElement.classList.add('has-img');
  };

  // ---------- カタログ描画 ----------
  // 見直し効果の大きい通信費から並べる
  const ORDER = ['mobile', 'net', 'video', 'music', 'ai', 'book', 'game', 'cloud', 'tool', 'learn', 'gym', 'money', 'shop', 'oshi', 'fixed', 'hoken', 'loan', 'tax'];
  const CATS = [...ORDER.map(id => CAT[id]).filter(Boolean), ...CATEGORIES.filter(c => !ORDER.includes(c.id))];
  // 「家族が払っている」などの0円プランは除いた最安値
  const minPrice = s => {
    const paid = s.p.map(p => p[1]).filter(v => v > 0);
    return paid.length ? Math.min(...paid) : 0;
  };

  function renderCatalog() {
    $('#catalog').innerHTML = CATS.map(cat => `
      <section class="cat" id="cat-${cat.id}" data-cat="${cat.id}">
        <div class="cat-head">
          <span class="emo">${cat.emoji || '・'}</span><h2>${esc(cat.name)}</h2>
          <span class="picked" hidden></span>
        </div>
        ${cat.desc ? `<p class="cat-desc">${esc(cat.desc)}</p>` : ''}
        <div class="grid">
          ${cat.items.map(s => `
            <button class="tile" data-sid="${s.id}" type="button">
              ${icoHTML(iconOf({ sid: s.id }))}
              <span class="tx"><span class="tname">${esc(flat(s.n))}</span><span class="tfrom">${minPrice(s) ? `¥${yen(minPrice(s))}〜/月` : '¥0〜'}</span></span>
              ${s.multi ? '<span class="tag-multi">複数OK</span>' : ''}
            </button>`).join('')}
          <button class="tile add" data-add="${cat.id}" type="button">
            <span class="ico">＋</span><span class="tx"><span class="tname">自分で追加</span><span class="tfrom">名前と金額を入力</span></span>
          </button>
        </div>
      </section>`).join('');

    $('#chips').innerHTML = CATS.map(c =>
      `<button class="chip" data-go="${c.id}" type="button">${c.emoji || ''} ${esc(c.name)}<span class="dot" hidden></span></button>`).join('');

    $('#serviceCount').textContent = totalServices;
  }

  function refreshTiles() {
    $$('.tile[data-sid]').forEach(el => {
      const list = itemsOf(el.dataset.sid);
      el.classList.toggle('sel', list.length > 0);
      let pr = el.querySelector('.tprice');
      let cnt = el.querySelector('.cnt');
      if (list.length) {
        if (!pr) { pr = document.createElement('span'); pr.className = 'tprice'; el.querySelector('.tx').appendChild(pr); }
        pr.textContent = `¥${yen(sum(list))}/月`;
        if (list.length > 1) {
          if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; el.appendChild(cnt); }
          cnt.textContent = list.length + '件';
        } else cnt?.remove();
      } else { pr?.remove(); cnt?.remove(); }
    });
    $$('.chip').forEach(ch => {
      const n = items.filter(i => i.cat === ch.dataset.go).length;
      const dot = ch.querySelector('.dot');
      dot.hidden = !n; dot.textContent = n;
    });
    $$('.cat').forEach(sec => {
      const list = items.filter(i => i.cat === sec.dataset.cat);
      const p = sec.querySelector('.picked');
      p.hidden = !list.length; p.textContent = `${list.length}件・¥${yen(sum(list))}`;
    });
  }

  function refreshBar() {
    const total = sum(items);
    $('#barIcons').innerHTML = items.slice(-3).reverse().map(i => icoHTML(iconOf(i))).join('');
    $('#barBadge').textContent = items.length + '件';
    $('#barSum').innerHTML = `<small>毎月の合計</small><b>¥${yen(total)}<i>/月</i></b>`;
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
      <p>料金・キャンペーンの最新情報は公式サイトで確認できます。<span class="pr-mini">※PRを含みます</span></p>
      <a class="btn pr" href="${esc(url)}" target="_blank" rel="sponsored noopener">公式サイトを見る</a>
    </div>`;
  }

  function customBlock({ withName, nameLabel = '名前', submitLabel = '追加する' }) {
    return `<div class="custom" id="customBox">
      <div class="custom-title">✎ 金額を直接入力</div>
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
      <p>${s.multi ? '複数OK：選ぶたびに1件追加されます' : '使っている料金プランを選択'}</p></div></div>`;

    if (s.multi && cur.length) {
      html += `<div class="sh-group">登録中（${cur.length}件）</div>` + cur.map(i => `
        <div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(i.label || flat(s.n))}</b><small>${esc(i.plan)}</small></div>
        <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button">×</button></div>`).join('');
      html += `<div class="sh-group">もう1件追加する</div>`;
    }
    if (s.multi) html += `<div class="custom" style="margin-top:10px;padding:10px"><input type="text" id="mLabel" placeholder="メモ（任意）例：推しの名前・店舗名・家族の名前" maxlength="30" style="margin:0"></div>`;

    html += `<div class="sh-group">料金プラン</div><div class="plans">` + active.map(p => planRow(p, s.p.indexOf(p))).join('') + `</div>`;
    if (old.length) html += `<div class="sh-group">旧プラン（いまは申し込めないもの）</div><div class="plans">` + old.map(p => planRow(p, s.p.indexOf(p))).join('') + `</div>`;
    if (!s.multi) {
      html += `<div class="sh-group">自分では払っていない</div><div class="plans">
        <button class="plan${single && single.price === 0 && single.plan === '支払いなし' ? ' on' : ''}" data-free type="button">
          <span class="radio"></span><span class="pl">使っているけど支払いなし<small>家族払い・カードやスマホの特典・無料体験中</small></span><span class="pp">¥<b>0</b></span>
        </button></div>`;
    }
    html += customBlock({ withName: false, submitLabel: s.multi ? 'この金額で1件追加' : 'この金額にする' });
    if (single) html += `<button class="btn danger" id="btnRemove" type="button">選択を解除する</button>`;
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
    $('[data-free]', sheet)?.addEventListener('click', () => commit('支払いなし', 0));
    bindCustom((price, _n, mode) => commit(mode === 'y' ? `自分で入力（年額 ¥${yen(price * 12)}）` : '自分で入力', price));
    $('#btnRemove')?.addEventListener('click', () => { items = items.filter(i => i !== single); refresh(); closeSheet(); toast('選択を解除しました'); });
    $$('[data-del]', sheet).forEach(b => b.onclick = () => {
      items = items.filter(i => i.uid !== b.dataset.del); refresh(); openService(sid, fromEl);
    });
  }

  function openAdd(catId, fromEl) {
    const cat = CAT[catId];
    openSheet(`<div class="sh-head"><span class="ico" style="background:#64748B">＋</span><div><h3>自分で追加</h3><p>${esc(cat.name)}に、一覧にないサービスを追加</p></div></div>
      ${customBlock({ withName: true, nameLabel: 'サービス名（例：〇〇プレミアム）', submitLabel: '追加する' })}`);
    $('#customBox').style.marginTop = '0';
    $('#customBox .custom-title').textContent = 'サービス名と金額';
    bindCustom((price, name, mode) => {
      if (!name) { toast('サービス名を入れてください'); return; }
      const it = { uid: uid(), sid: 'custom', cat: catId, name, plan: mode === 'y' ? `年額 ¥${yen(price * 12)}` : '自分で入力', price, color: '#64748B' };
      items.push(it); refresh(); closeSheet(); fly(fromEl, iconOf(it)); hideGuide();
    });
  }

  function openList() {
    if (!items.length) {
      openSheet(`<div class="sh-head"><div><h3>マイリスト</h3></div></div><div class="empty-msg">まだ何も選ばれていません。<br>一覧から使っているものを選んでください。</div>`);
      return;
    }
    let html = `<div class="sh-head"><div><h3>マイリスト</h3><p>${items.length}件・名前を押すとプランを変更できます</p></div></div>`;
    CATS.forEach(cat => {
      const list = items.filter(i => i.cat === cat.id);
      if (!list.length) return;
      html += `<div class="li-cat">${esc(cat.name)}　¥${yen(sum(list))}</div>` + list.map(i => `
        <div class="li">${icoHTML(iconOf(i))}
          <button class="lt" data-edit="${i.uid}" type="button" style="text-align:left"><b>${esc(i.label || i.name || flat(SVC[i.sid]?.n || ''))}</b><small>${esc(i.plan)}</small></button>
          <span class="lp">¥${yen(i.price)}</span><button class="lx" data-del="${i.uid}" type="button" aria-label="削除">×</button>
        </div>`).join('');
    });
    html += `<div class="li-sum"><span>毎月の合計</span><span>¥${yen(sum(items))}/月</span></div>
      <button class="btn" id="lsCard" type="button">結果を見る</button>
      <button class="link-btn" id="lsReset" type="button">すべて削除</button>`;
    openSheet(html);
    $$('[data-del]', sheet).forEach(b => b.onclick = () => { items = items.filter(i => i.uid !== b.dataset.del); refresh(); openList(); });
    $$('[data-edit]', sheet).forEach(b => b.onclick = () => {
      const it = items.find(i => i.uid === b.dataset.edit);
      if (it && SVC[it.sid] && !SVC[it.sid].multi) openService(it.sid, $(`.tile[data-sid="${it.sid}"]`));
      else if (it && SVC[it.sid]) openService(it.sid, $(`.tile[data-sid="${it.sid}"]`));
    });
    $('#lsCard').onclick = () => { closeSheet(); showCard(); };
    $('#lsReset').onclick = () => {
      if (!confirm('マイリストをすべて削除しますか？')) return;
      items = []; refresh(); closeSheet(); toast('すべて削除しました');
    };
  }

  function openCategories() {
    openSheet(`<div class="sh-head"><div><h3>カテゴリから探す</h3><p>押すとその場所へ移動します</p></div></div>
      <div class="cat-list">${CATS.map(c => `<button data-jump="${c.id}" type="button">${c.emoji || ''} ${esc(c.name)}<small>${c.items.length}サービス${items.some(i => i.cat === c.id) ? '・選択中 ' + items.filter(i => i.cat === c.id).length : ''}</small></button>`).join('')}</div>
      <button class="btn ghost" data-anchor="howto" type="button">忘れているサブスクの見つけ方</button>
      <button class="btn ghost" data-anchor="prices" type="button">対応サービスと料金の目安</button>
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
    if (!items.length) { toast('まずは使っているものを選んでください'); return; }
    askDemo(openResult);
  }
  function openResult() {
    renderResult();
    window.subTrack?.('結果を見た');
    $('#result').hidden = false;
    $('#result').scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function closeResult() { $('#result').hidden = true; document.body.style.overflow = ''; }
  $('#resultBack').onclick = closeResult;

  function shareText() {
    const total = sum(items);
    return `毎月の固定費・サブスクを診断したら、${items.length}件で月¥${yen(total)}（年¥${yen(total * 12)}）でした`;
  }

  function renderResult() {
    const total = sum(items);
    const sorted = [...items].sort((a, b) => b.price - a.price);
    const date = new Date();
    const PALETTE = ['#0F766E', '#F0623C', '#14B8A6', '#F5B841', '#6C8EBF', '#B57EDC', '#7FB77E'];
    const byCat = CATEGORIES.map(c => ({ c, v: catSum(c.id), n: items.filter(i => i.cat === c.id).length }))
      .filter(x => x.n).sort((a, b) => b.v - a.v);
    // 7番目以降は「その他」にまとめる
    const slices = byCat.slice(0, 6).map((b, k) => ({ name: b.c.name, v: b.v, color: PALETTE[k] }));
    const restV = byCat.slice(6).reduce((a, b) => a + b.v, 0);
    if (restV) slices.push({ name: 'その他', v: restV, color: '#C9C2B3' });
    let acc = 0;
    const stops = total ? slices.map(sl => { const a = acc; acc += sl.v / total * 360; return `${sl.color} ${a}deg ${acc}deg`; }).join(', ') : '#E6E1D6 0deg 360deg';
    const st = stateApi();
    const recs = RECOMMENDS.filter(r => r.url && r.enabled !== false && (() => { try { return RECOMMEND_RULES[r.id]?.when(st); } catch { return false; } })());

    $('#resultBody').innerHTML = `
      <div class="summary" id="card">
        <div class="summary-head"><span>MY FIXED COST</span><span>${date.getFullYear()}年${date.getMonth() + 1}月</span></div>
        <div class="summary-main">
          <div class="donut" style="background:conic-gradient(${stops})">
            <div class="donut-c"><small>毎月</small><b>¥${yen(total)}</b><small>${items.length}件</small></div>
          </div>
          <ul class="legend">${slices.map(sl => `<li><i style="background:${sl.color}"></i><span>${esc(sl.name)}</span><b>¥${yen(sl.v)}</b></li>`).join('')}</ul>
        </div>
        <div class="summary-stats">
          <div><small>1年で</small><b>¥${yen(total * 12)}</b></div>
          <div><small>1日あたり</small><b>¥${yen(total / 30)}</b></div>
          <div><small>5年で</small><b>¥${yen(total * 60)}</b></div>
        </div>
        <div class="summary-icons">${sorted.slice(0, 20).map(i => icoHTML(iconOf(i))).join('')}</div>
      </div>
      <div class="share-row">
        <button class="btn x" id="shareX" type="button">Xでシェア</button>
        <button class="btn" id="saveImg" type="button">画像で保存</button>
      </div>
      <button class="btn ghost" id="editList" type="button">マイリストを編集</button>

      <div class="panel">
        <h3>金額の大きいもの</h3>
        ${sorted.slice(0, 5).map(i => `<div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(i.label || i.name || flat(SVC[i.sid]?.n || ''))}</b><small>${esc(i.plan)}</small></div><span class="lp">¥${yen(i.price)}</span></div>`).join('')}
      </div>

      ${buildReport({ items, SVC, icoHTML, iconOf, yen, esc })}
      ${buildMember({ items, SVC, yen, esc, icoHTML, iconOf })}
      ${buildGuides({ st, esc })}
      ${buildHackPanel({ items })}

      ${recs.length ? `<div class="panel">
        <h3>見直しで安くなるかも<span class="pr-mini">※PRを含みます</span></h3>
        ${recs.map(r => `<div class="rec"><span class="tag">${esc(r.tag)}</span><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p>
          <a class="btn pr" href="${esc(r.url)}" target="_blank" rel="sponsored noopener">${esc(r.cta)}</a></div>`).join('')}
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
    $('#saveImg').onclick = () => { window.subTrack?.('画像で保存'); saveImage(); };
    $('#editList').onclick = () => { closeResult(); openList(); };
    $$('[data-goto]', $('#resultBody')).forEach(b => b.onclick = () => { closeResult(); jump(b.dataset.goto); });
    bindMember($('#resultBody'), { getItems: () => items, save, yen, SVC, toast });
    bindReport($('#resultBody'), { items, yen });
    bindGuides($('#resultBody'), { openSheet, esc, yen });
    bindHackPanel($('#resultBody'), { openSheet, toast });
  }

  // 性別・年代（任意）。一度答えるか閉じたら、このブラウザでは出さない
  const DEMO_KEY = 'subhack.demo';
  function askDemo(next) {
    let answered = '';
    try { answered = localStorage.getItem(DEMO_KEY) || ''; } catch { answered = 'x'; }
    if (answered) { next(); return; }
    const chips = (name, list) => list.map(v => `<button type="button" class="demo-chip" data-demo="${name}" data-v="${v}">${v}</button>`).join('');
    const wrap = document.createElement('div');
    wrap.className = 'demo-pop';
    wrap.innerHTML = `<div class="demo" role="dialog" aria-modal="true" aria-labelledby="demoH">
        <p class="demo-h" id="demoH">よければ教えてください<small>（任意・サイトの改善にだけ使います）</small></p>
        <div class="demo-row"><span>性別</span>${chips('sex', ['女性', '男性', 'その他・答えない'])}</div>
        <div class="demo-row"><span>年代</span>${chips('age', ['10代', '20代', '30代', '40代', '50代', '60代以上'])}</div>
        <button class="btn" type="button" data-demo-go disabled>結果を見る</button>
        <button class="demo-skip" type="button" data-demo-skip>答えずに結果を見る</button>
      </div>`;
    document.body.appendChild(wrap);
    const pick = {};
    const go = wrap.querySelector('[data-demo-go]');
    const close = () => { wrap.remove(); next(); };
    wrap.querySelectorAll('[data-demo]').forEach(btn => btn.onclick = () => {
      pick[btn.dataset.demo] = btn.dataset.v;
      wrap.querySelectorAll(`[data-demo="${btn.dataset.demo}"]`).forEach(x => x.classList.toggle('on', x === btn));
      go.disabled = !(pick.sex || pick.age);
      // 両方選んだら、そのまま結果へ
      if (pick.sex && pick.age) setTimeout(go.onclick, 250);
    });
    go.onclick = () => {
      if (!wrap.isConnected) return;
      try { localStorage.setItem(DEMO_KEY, '1'); } catch { }
      window.subTrackDemo?.(pick.sex, pick.age);
      close();
    };
    wrap.querySelector('[data-demo-skip]').onclick = () => {
      try { localStorage.setItem(DEMO_KEY, 'skip'); } catch { }
      if (pick.sex || pick.age) window.subTrackDemo?.(pick.sex, pick.age);
      close();
    };
  }

  // 登録中サービスのうちアフィリエイトURLがあるもの
  function affListPanel() {
    const seen = new Set();
    const list = items.filter(i => AFFILIATE[i.sid] && !seen.has(i.sid) && seen.add(i.sid));
    if (!list.length) return '';
    return `<div class="panel"><h3>あなたのサブスクの公式キャンペーン<span class="pr-mini">※PRを含みます</span></h3>
      ${list.map(i => `<div class="li">${icoHTML(iconOf(i))}<div class="lt"><b>${esc(flat(SVC[i.sid].n))}</b><small>最新の料金・特典をチェック</small></div>
        <a class="btn pr" style="width:auto;height:34px;padding:0 12px;margin:0;font-size:12px" href="${esc(AFFILIATE[i.sid])}" target="_blank" rel="sponsored noopener">見る</a></div>`).join('')}
    </div>`;
  }

  // ---------- 画像保存 ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  async function saveImage() {
    const W = 1080, H = 1350, pad = 80;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const font = '"Zen Maru Gothic", "Noto Sans JP", "Hiragino Sans", sans-serif';
    const total = sum(items);
    ctx.fillStyle = '#F7F5F0'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; roundRect(ctx, 50, 50, W - 100, H - 100, 48); ctx.fill();

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#0F766E'; ctx.font = `900 40px ${font}`; ctx.fillText(SITE.name, pad + 30, 160);
    ctx.fillStyle = '#6E7672'; ctx.font = `700 32px ${font}`; ctx.fillText('わたしの毎月の固定費', pad + 30, 215);

    // 円グラフ
    const PALETTE = ['#0F766E', '#F0623C', '#14B8A6', '#F5B841', '#6C8EBF', '#B57EDC', '#7FB77E'];
    const byCat = CATEGORIES.map(c => ({ name: c.name, v: catSum(c.id) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const slices = byCat.slice(0, 6).map((x, k) => ({ ...x, color: PALETTE[k] }));
    const restV = byCat.slice(6).reduce((a, b) => a + b.v, 0);
    if (restV) slices.push({ name: 'その他', v: restV, color: '#C9C2B3' });
    const cx = 330, cy = 560, r = 210;
    let ang = -Math.PI / 2;
    if (!total) { ctx.fillStyle = '#E6E1D6'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
    slices.forEach(sl => {
      const d = sl.v / total * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, ang, ang + d); ctx.closePath();
      ctx.fillStyle = sl.color; ctx.fill(); ang += d;
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r - 62, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6E7672'; ctx.font = `700 30px ${font}`; ctx.fillText('毎月', cx, cy - 34);
    ctx.fillStyle = '#134E48'; ctx.font = `900 56px ${font}`; ctx.fillText('¥' + yen(total), cx, cy + 26);
    ctx.fillStyle = '#6E7672'; ctx.font = `700 28px ${font}`; ctx.fillText(items.length + '件', cx, cy + 72);

    // 凡例
    ctx.textAlign = 'left';
    slices.forEach((sl, k) => {
      const y = 400 + k * 52;
      ctx.fillStyle = sl.color; roundRect(ctx, 600, y - 22, 26, 26, 6); ctx.fill();
      ctx.fillStyle = '#4B5551'; ctx.font = `700 28px ${font}`;
      const name = sl.name.length > 8 ? sl.name.slice(0, 8) + '…' : sl.name;
      ctx.fillText(name, 640, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#134E48'; ctx.fillText('¥' + yen(sl.v), W - pad - 30, y); ctx.textAlign = 'left';
    });

    // 年額など
    const stats = [['1年で', total * 12], ['1日あたり', total / 30], ['5年で', total * 60]];
    stats.forEach(([label, v], k) => {
      const w = (W - pad * 2 - 60 - 40) / 3, x = pad + 30 + k * (w + 20), y = 840;
      ctx.fillStyle = '#F0EDE5'; roundRect(ctx, x, y, w, 130, 24); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6E7672'; ctx.font = `700 26px ${font}`; ctx.fillText(label, x + w / 2, y + 50);
      ctx.fillStyle = '#134E48'; ctx.font = `900 38px ${font}`; ctx.fillText('¥' + yen(v), x + w / 2, y + 100);
    });

    // アイコン（公式アイコンは CORS で読めたものだけ）
    const loadImg = src => new Promise(res => {
      if (!src) return res(null);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im.naturalWidth > 16 ? im : null); im.onerror = () => res(null);
      im.src = src;
    });
    const shown = [...items].sort((a, b) => b.price - a.price).slice(0, 10);
    const imgs = await Promise.all(shown.map(it => loadImg(iconOf(it).img)));
    const size = 70, gap = 14, x0 = (W - (shown.length * size + (shown.length - 1) * gap)) / 2;
    shown.forEach((it, k) => {
      const ic = iconOf(it), x = x0 + k * (size + gap), y = 1030;
      if (imgs[k]) {
        ctx.fillStyle = '#fff'; roundRect(ctx, x, y, size, size, 18); ctx.fill();
        ctx.strokeStyle = '#E6E1D6'; ctx.lineWidth = 2; ctx.stroke();
        ctx.drawImage(imgs[k], x + 8, y + 8, size - 16, size - 16);
      } else {
        ctx.fillStyle = ic.c; roundRect(ctx, x, y, size, size, 18); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${[...(ic.t || '')].length >= 3 ? 20 : 28}px ${font}`; ctx.fillText(ic.t || '', x + size / 2, y + size / 2 + 1);
        ctx.textBaseline = 'alphabetic';
      }
    });

    ctx.textAlign = 'center'; ctx.fillStyle = '#0F766E'; ctx.font = `700 28px ${font}`;
    ctx.fillText('#' + SITE.hashtag, W / 2, H - 110);

    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], 'subsc-matome.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() + ' #' + SITE.hashtag }); return; } catch { /* キャンセル時はダウンロードへ */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'subsc-matome.png'; a.click();
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
    $('#priceTables').innerHTML = CATS.map(c => `<details><summary>${esc(c.name)}　<small style="color:var(--sub);font-weight:400">${c.items.length}サービス</small></summary>
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
    const data = { title: SITE.name, text: 'サブスクと固定費の毎月の合計がわかる無料ツール', url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { } return; }
    try { await navigator.clipboard.writeText(location.href); toast('URLをコピーしました'); } catch { toast(location.href); }
  };
  $('#year').textContent = new Date().getFullYear();

  renderCatalog();
  renderPrices();
  refresh();
  watchChips();

  // カード明細のスクショ読み取り
  const scanner = initScan({ SVC, CAT, getItems: () => items, refresh, openSheet, closeSheet, icoHTML, iconOf, yen, esc, toast, uid, flat });
  $('#btnScan').onclick = () => { scanner.open(); hideGuide(); };
})();
