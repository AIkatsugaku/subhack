/*
 * サブハック 管理画面
 * settings.json を GitHub API で読み書きします。保存すると GitHub Pages が再公開され、1〜2分で公開サイトに反映されます。
 */
(() => {
  'use strict';

  // 設定を保存するリポジトリ
  const REPO = 'AIkatsugaku/subhack';
  const BRANCH = 'main';
  const FILE = 'settings.json';
  const TOKEN_KEY = 'subhack.admin.token';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flat = s => String(s || '').replace(/\n/g, '');
  const clone = o => JSON.parse(JSON.stringify(o));
  // ひらがな→カタカナ・全角半角をそろえて検索する
  const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/s/g, '');

  const SVC = {}, CAT = {};
  CATEGORIES.forEach(c => { CAT[c.id] = c; c.items.forEach(s => { s.cat = c.id; SVC[s.id] = s; }); });

  let token = '';
  let sha = null;      // settings.json の現在のバージョン
  let state = null;    // 編集中の設定
  let saved = '';      // 最後に読み込み/保存した内容（変更検知用）
  let tab = 'dash';

  // ---------- GitHub API ----------
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(body.message || res.statusText);
      e.status = res.status;
      e.need = res.headers.get('x-accepted-github-permissions') || '';  // 足りない権限（GitHubが教えてくれる場合）
      throw e;
    }
    return body;
  }

  // 保存できる権限があるか確かめる（参照されないデータを1つ作るだけで、サイトの内容は変わらない）
  async function canWrite() {
    try {
      await gh(`/repos/${REPO}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: 'subhack-admin-write-check', encoding: 'utf-8' }) });
      return true;
    } catch (e) {
      if (e.status === 403 || e.status === 404) return false;
      throw e;
    }
  }

  const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens';
  const FIX_PERMISSION = `<b>このトークンには「保存」の権限がありません。</b><br>
    <a href="${TOKEN_PAGE}" target="_blank" rel="noopener">GitHub のトークン一覧</a>で使っているトークンを開き、
    「Repository permissions」の <b>Contents</b> を <b>Read and write</b> に変えて「Update」を押してください。
    トークンの文字列は変わらないので、そのまま もう一度ログインすれば使えます。`;

  // GitHub のエラーを、何をすればいいかが分かる日本語にする
  function explain(e) {
    if (e.status === 401) return `<b>トークンが正しくないか、有効期限が切れています。</b><br><a href="${TOKEN_PAGE}" target="_blank" rel="noopener">GitHub のトークン一覧</a>で期限を確認し、新しく作ってログインし直してください。`;
    if (e.status === 403 && /rate limit/i.test(e.message)) return '<b>短時間に操作が集中しました。</b><br>1分ほど待ってからもう一度お試しください。';
    if (e.status === 403 || (e.status === 404 && e.need)) return FIX_PERMISSION;
    if (e.status === 404) return `<b>リポジトリ（${REPO}）にアクセスできません。</b><br>トークンの「Repository access」で <b>${REPO}</b> が選ばれているか確認してください。`;
    if (e.status === 409 || e.status === 422) return '<b>ほかの人が先に保存しました。</b><br>「元に戻す」で最新を読み込み、もう一度変更して保存してください。';
    if (!e.status) return '<b>GitHub に接続できませんでした。</b><br>インターネット接続を確認して、もう一度お試しください。';
    return `<b>保存できませんでした（${e.status}）。</b><br>${esc(e.message)}`;
  }

  function showError(html) {
    const box = $('#errBox');
    box.querySelector('div').innerHTML = html;
    box.hidden = false;
  }
  const b64encode = str => btoa(unescape(encodeURIComponent(str)));
  const b64decode = b64 => decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));

  function defaults() {
    return clone({ updatedAt: '', SITE, LINE, MEMBERSHIP, AFFILIATE, RECOMMENDS, REPORT });
  }

  async function loadSettings() {
    try {
      const f = await gh(`/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
      sha = f.sha;
      state = { ...defaults(), ...JSON.parse(b64decode(f.content)) };
    } catch (e) {
      if (e.status !== 404) throw e;
      sha = null; state = defaults();
    }
    saved = JSON.stringify(state);
    markDirty();
  }

  async function saveSettings() {
    const btn = $('#btnSave');
    btn.disabled = true; btn.textContent = '保存中…';
    $('#errBox').hidden = true;
    try {
      state.updatedAt = new Date().toISOString();
      const content = JSON.stringify(state, null, 2) + '\n';
      const res = await gh(`/repos/${REPO}/contents/${FILE}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `管理画面から設定を更新（${tabLabel(tab)}）`, content: b64encode(content), branch: BRANCH, ...(sha ? { sha } : {}) }),
      });
      sha = res.content.sha;
      saved = JSON.stringify(state);
      markDirty();
      toast('保存しました。1〜2分で公開サイトに反映されます');
      if (tab === 'dash') render();
    } catch (e) {
      showError(explain(e));
    } finally {
      btn.disabled = false; btn.textContent = '保存して公開';
    }
  }

  // ---------- 値の読み書き（"REPORT.mobile.0.price" のようなパス） ----------
  function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state); }
  function setPath(path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => (o[k] ??= {}), state);
    if (val === '' && keys[0] === 'AFFILIATE') delete obj[last]; else obj[last] = val;
  }
  // data-type: num（数値）/ pct（%で表示し小数で保存）/ csv（カンマ区切り→配列）/ lines（改行→配列）/ bool
  function toView(v, type) {
    if (type === 'pct') return v ? +(v * 100).toFixed(2) : '';
    if (type === 'csv') return (v || []).join(', ');
    if (type === 'lines') return (v || []).join('\n');
    return v ?? '';
  }
  function fromView(el) {
    const type = el.dataset.type, v = el.type === 'checkbox' ? el.checked : el.value;
    if (type === 'num') return v === '' ? 0 : Number(v);
    if (type === 'pct') return v === '' ? 0 : Number(v) / 100;
    if (type === 'csv') return v.split(/[,、\s]+/).map(x => x.trim()).filter(Boolean);
    if (type === 'lines') return v.split('\n').map(x => x.trim()).filter(Boolean);
    return v;
  }
  function inputHTML(path, { type = '', label = '', hint = '', ph = '', area = false, cls = '' } = {}) {
    const v = toView(getPath(path), type);
    const attrs = `data-path="${path}" data-type="${type}" placeholder="${esc(ph)}" class="${cls}"`;
    const control = area
      ? `<textarea ${attrs}>${esc(v)}</textarea>`
      : `<input ${attrs} type="${type === 'num' || type === 'pct' ? 'number' : 'text'}" value="${esc(v)}" step="any">`;
    if (!label) return control;
    return `<label class="field"><span>${esc(label)}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
  }

  function markDirty() {
    const dirty = JSON.stringify(state) !== saved;
    $('#savebar').classList.toggle('dirty', dirty);
    $('#saveState').textContent = dirty ? '保存していない変更があります' : (state.updatedAt ? `最終更新：${new Date(state.updatedAt).toLocaleString('ja-JP')}` : '変更はありません');
    $('#btnSave').disabled = !dirty;
    $('#btnRevert').disabled = !dirty;
  }

  // ---------- 画面 ----------
  const TABS = {
    dash: '📊 ダッシュボード', line: '💬 LINE公式アカウント', member: '⭐ 有料会員', aff: '🔗 アフィリエイト（サービス別）',
    report: '📝 見直しレポート', recs: '📣 おすすめ枠', site: '⚙️ 基本設定',
  };
  const tabLabel = t => TABS[t].replace(/^\S+\s/, '');

  function icon(sid) {
    const s = SVC[sid];
    if (!s) return '<span class="ico" style="background:#999">?</span>';
    const d = ICON_DOMAINS[sid];
    return `<span class="ico" style="background:${s.c}">${esc(s.t ?? flat(s.n).slice(0, 1))}${d ? `<img src="${iconUrl(d)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }

  // ---------- LINEの画像 ----------
  // アップロード直後は公開サイトにまだ出ていないので、プレビューは手元の画像を使う
  const preview = {};
  const IMG = { icon: { path: 'images/line-icon.png', max: 512 }, qr: { path: 'images/line-qr.png', max: 600 } };
  function imageField(kind, label, hint) {
    const src = preview[kind] || state.LINE[kind] || '';
    return `<div class="img-field">
      <span class="img-label">${esc(label)}</span>
      <div class="img-box ${kind}">${src ? `<img src="${esc(src)}" alt="">` : '<span>未設定</span>'}</div>
      <label class="btn sm ghost">画像を選ぶ<input type="file" accept="image/*" data-upload="${kind}" hidden></label>
      ${src ? `<button class="btn sm danger" data-clearimg="${kind}" type="button">外す</button>` : ''}
      <small class="muted">${esc(hint)}</small>
    </div>`;
  }
  // 縮小してPNGにし、リポジトリの images/ に保存する
  async function uploadImage(kind, file) {
    const { path, max } = IMG[kind];
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const dataUrl = cv.toDataURL('image/png');
    let fileSha;
    try { fileSha = (await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    await gh(`/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message: `管理画面からLINEの画像を更新（${kind === 'icon' ? 'アイコン' : 'QRコード'}）`, content: dataUrl.split(',')[1], branch: BRANCH, ...(fileSha ? { sha: fileSha } : {}) }),
    });
    preview[kind] = dataUrl;
    state.LINE[kind] = `${path}?v=${Date.now()}`;  // 差し替えてもすぐ新しい画像が出るように
  }

  const views = {
    dash() {
      const affCount = Object.values(state.AFFILIATE || {}).filter(Boolean).length;
      const reportUrls = ['mobile', 'net', 'electric', 'cards'].reduce((n, k) => n + (state.REPORT[k] || []).filter(o => o.url).length, 0);
      const recUrls = (state.RECOMMENDS || []).filter(r => r.url && r.enabled !== false).length;
      const lineOk = !!(state.LINE.id && state.LINE.addFriendUrl);
      const todos = [
        !lineOk && ['LINE公式アカウントのIDと友だち追加URLを設定する', 'line'],
        !state.MEMBERSHIP.joinUrl && ['有料会員の決済リンクを設定する（未設定ならLINEで申し込み）', 'member'],
        !affCount && ['サービスごとのアフィリエイトリンクを登録する', 'aff'],
        !reportUrls && ['見直しレポートの乗り換え先にリンクを入れる', 'report'],
      ].filter(Boolean);
      return `<div class="panel">
        <h2>ダッシュボード</h2>
        <p class="muted">公開サイト：<a href="${esc(state.SITE.url)}" target="_blank" rel="noopener">${esc(state.SITE.url)}</a></p>
        <div class="stats">
          <div class="stat"><small>LINE公式アカウント</small><b class="${lineOk ? 'ok' : 'ng'}">${lineOk ? '接続済み' : '未設定'}</b></div>
          <div class="stat"><small>有料会員（月額）</small><b>¥${Number(state.MEMBERSHIP.price || 0).toLocaleString()}</b></div>
          <div class="stat"><small>サービス別アフィリエイト</small><b>${affCount}<small style="display:inline">件</small></b></div>
          <div class="stat"><small>レポートの申込リンク</small><b>${reportUrls}<small style="display:inline">件</small></b></div>
          <div class="stat"><small>表示中のおすすめ枠</small><b>${recUrls}<small style="display:inline">件</small></b></div>
          <div class="stat"><small>最終更新</small><b style="font-size:14px">${state.updatedAt ? new Date(state.updatedAt).toLocaleString('ja-JP') : '—'}</b></div>
        </div>
        ${todos.length ? `<h3>やることリスト</h3><ul class="todo">${todos.map(([t, go]) => `<li>⚠️ ${esc(t)}<button class="btn sm ghost" data-go="${go}" type="button">設定する</button></li>`).join('')}</ul>` : '<h3>✅ すべて設定済みです</h3>'}
        <p class="muted" style="margin-top:14px">変更履歴は <a href="https://github.com/${REPO}/commits/${BRANCH}/${FILE}" target="_blank" rel="noopener">GitHub の履歴</a> で確認・復元できます。</p>
      </div>`;
    },

    line() {
      return `<div class="panel">
        <h2>LINE公式アカウント</h2>
        <p class="muted">ここで設定したアカウントに「友だち追加」「通知の予定送信」「有料会員の相談」がつながります。</p>
        <div class="grid2">
          ${inputHTML('LINE.id', { label: 'ベーシックID', ph: '@123abcde', hint: 'LINE Official Account Manager のホーム右上に表示される @ から始まるID' })}
          ${inputHTML('LINE.addFriendUrl', { label: '友だち追加URL', ph: 'https://lin.ee/xxxxxxx', hint: '「友だちを増やす → 友だち追加ガイド」で取得できるURL' })}
        </div>
        ${inputHTML('LINE.name', { label: 'アカウント名（サイトに表示）', ph: 'サブハック公式LINE' })}
        <div class="tools">
          <button class="btn sm line" id="testAdd" type="button">友だち追加リンクを試す</button>
          <button class="btn sm line" id="testMsg" type="button">トーク画面を試す</button>
        </div>
        <h3>LINEの画像</h3>
        <p class="muted">サイトの「LINE登録」の欄に表示されます。QRコードはパソコンで見ている人がスマホで読み取って友だち追加するのに使います。</p>
        <div class="img-fields">
          ${imageField('icon', 'アカウントのアイコン', 'LINE Official Account Manager のプロフィール画像と同じものがおすすめ（正方形）')}
          ${imageField('qr', '友だち追加のQRコード', '「友だちを増やす → 友だち追加ガイド」でダウンロードできるQRコード画像')}
        </div>
        <h3>サイトから届くメッセージ</h3>
        <ul class="todo">
          <li>【通知の登録】… 利用者が通知してほしい解約・見直しの日付</li>
          <li>【有料会員の申し込み】… 有料会員への申し込み（決済リンク未設定の場合）</li>
          <li>【会員相談】… 有料会員からの相談（サブスク一覧つき）</li>
        </ul>
        <p class="muted">予定日に自動でお知らせを送るには、LINE公式アカウントの予約配信や、Messaging API を使った配信の仕組みが別途必要です。</p>
      </div>`;
    },

    member() {
      return `<div class="panel">
        <h2>有料会員</h2>
        <div class="grid2">
          ${inputHTML('MEMBERSHIP.name', { label: 'プラン名' })}
          ${inputHTML('MEMBERSHIP.price', { label: '月額（円・税込）', type: 'num' })}
        </div>
        ${inputHTML('MEMBERSHIP.features', { label: '特典（1行に1つ）', type: 'lines', area: true })}
        ${inputHTML('MEMBERSHIP.joinUrl', { label: '申し込み・決済リンク', ph: 'https://buy.stripe.com/…', hint: '空のままなら、LINEで「有料会員に申し込みたい」とメッセージを送る形になります' })}
      </div>`;
    },

    aff() {
      const cats = CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      const rows = Object.values(SVC).map(s => {
        const v = state.AFFILIATE[s.id] || '';
        return `<tr data-sid="${s.id}" data-cat="${s.cat}" data-q="${esc([flat(s.n), s.id, ...(SEARCH_ALIASES[s.id] || '').split(/s+/)].map(norm).join('|'))}" class="${v ? 'set' : ''}">
          <td><div class="svc">${icon(s.id)}<div>${esc(flat(s.n))}<small>${esc(CAT[s.cat].name)}</small></div></div></td>
          <td>${inputHTML('AFFILIATE.' + s.id, { cls: 'wide', ph: 'https://px.a8.net/…' })}</td>
          <td><button class="btn sm ghost" data-test="${s.id}" type="button">開く</button></td>
        </tr>`;
      }).join('');
      return `<div class="panel">
        <h2>アフィリエイト（サービス別）</h2>
        <p class="muted">URLを入れたサービスには、プラン選択の画面と結果画面に「公式サイトを見る（PR）」ボタンが出ます。</p>
        <div class="tools">
          <input type="search" id="affQ" placeholder="サービス名で絞り込み">
          <select id="affCat"><option value="">すべてのカテゴリ</option>${cats}</select>
          <label class="switch"><input type="checkbox" id="affOnly"> 設定済みだけ</label>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>サービス</th><th>アフィリエイトURL</th><th></th></tr></thead><tbody id="affRows">${rows}</tbody></table></div>
      </div>`;
    },

    report() {
      const svcOpts = cat => Object.values(SVC).filter(s => s.cat === cat);
      const sel = (path, cat) => `<select data-path="${path}">${svcOpts(cat).map(s => `<option value="${s.id}"${getPath(path) === s.id ? ' selected' : ''}>${esc(flat(s.n))}</option>`).join('')}</select>`;
      const table = (key, cols, blank) => {
        const list = state.REPORT[key] || [];
        return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}<th></th></tr></thead><tbody>
          ${list.map((_, i) => `<tr>${cols.map(c => `<td>${c.sel ? sel(`REPORT.${key}.${i}.${c.k}`, c.sel) : inputHTML(`REPORT.${key}.${i}.${c.k}`, { type: c.t || '', cls: c.cls || '' })}</td>`).join('')}
            <td><button class="del" data-del="${key}.${i}" type="button" aria-label="削除">×</button></td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn sm ghost" data-add="${key}" data-blank='${esc(JSON.stringify(blank))}' type="button">＋ 行を追加</button>`;
      };
      return `<div class="panel">
        <h2>見直しレポート</h2>
        <p class="muted">結果画面の「あなたの見直しレポート」に出す乗り換え先です。URLを入れると「申し込む（PR）」ボタンが出ます。「セット」には相性のよいサービスID（カンマ区切り）を入れると優先表示されます。</p>
        <h3>📱 スマホ</h3>
        ${table('mobile', [{ h: 'サービス', k: 'sid', sel: 'mobile' }, { h: 'プラン', k: 'plan' }, { h: '月額', k: 'price', t: 'num', cls: 'num' }, { h: 'データ量', k: 'gb', cls: 'num' }, { h: 'セット', k: 'set', t: 'csv' }, { h: '申込URL', k: 'url', cls: 'wide' }],
          { sid: 'linemo', plan: '', price: 0, gb: '', url: '' })}
        <h3>🌐 光回線</h3>
        ${table('net', [{ h: 'サービス', k: 'sid', sel: 'net' }, { h: '表示名', k: 'name' }, { h: '住まい', k: 'type', cls: 'num' }, { h: '月額', k: 'price', t: 'num', cls: 'num' }, { h: 'キャッシュバック', k: 'cashback', t: 'num', cls: 'num' }, { h: '何か月で割る', k: 'months', t: 'num', cls: 'num' }, { h: 'セット', k: 'set', t: 'csv' }, { h: '申込URL', k: 'url', cls: 'wide' }],
          { sid: 'gmohikari', name: '', type: 'マンション', price: 0, cashback: 0, months: 24, url: '' })}
        <h3>⚡ 電気</h3>
        ${table('electric', [{ h: '会社名', k: 'name' }, { h: '公式ドメイン', k: 'd' }, { h: '色', k: 'c', cls: 'num' }, { h: '文字', k: 't', cls: 'num' }, { h: '割引率%', k: 'rate', t: 'pct', cls: 'num' }, { h: '特徴', k: 'point' }, { h: 'セット', k: 'set', t: 'csv' }, { h: '申込URL', k: 'url', cls: 'wide' }],
          { name: '', d: '', c: '#0F766E', t: '', rate: 0, point: '', url: '' })}
        <h3>💳 クレジットカード</h3>
        ${table('cards', [{ h: 'カード名', k: 'name' }, { h: '公式ドメイン', k: 'd' }, { h: '色', k: 'c', cls: 'num' }, { h: '文字', k: 't', cls: 'num' }, { h: '年会費', k: 'fee', t: 'num', cls: 'num' }, { h: '還元率%', k: 'rate', t: 'pct', cls: 'num' }, { h: 'ポイント名', k: 'point' }, { h: '補足', k: 'note' }, { h: '相性の説明', k: 'setLabel' }, { h: 'セット', k: 'set', t: 'csv' }, { h: '申込URL', k: 'url', cls: 'wide' }],
          { name: '', d: '', c: '#0F766E', t: '', fee: 0, rate: 0.01, point: '', url: '' })}
      </div>`;
    },

    recs() {
      const rules = Object.entries(RECOMMEND_RULES).map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join('');
      return `<div class="panel">
        <h2>おすすめ枠</h2>
        <p class="muted">結果画面の下部に、条件に合う人だけ表示する広告枠です。URLが空の枠は表示されません。</p>
        ${(state.RECOMMENDS || []).map((r, i) => `<div class="rec">
          <div class="rec-head"><b>${esc(r.tag || '枠' + (i + 1))}</b>
            <label class="switch"><input type="checkbox" data-path="RECOMMENDS.${i}.enabled" data-type="bool"${r.enabled !== false ? ' checked' : ''}> 表示する</label>
            <button class="del" data-delrec="${i}" type="button" aria-label="削除">×</button></div>
          <div class="grid2">
            <label class="field"><span>表示する条件</span><select data-path="RECOMMENDS.${i}.id">${rules.replace(`value="${r.id}"`, `value="${r.id}" selected`)}</select></label>
            ${inputHTML(`RECOMMENDS.${i}.tag`, { label: 'ラベル' })}
          </div>
          ${inputHTML(`RECOMMENDS.${i}.title`, { label: '見出し' })}
          ${inputHTML(`RECOMMENDS.${i}.text`, { label: '説明文' })}
          <div class="grid2">
            ${inputHTML(`RECOMMENDS.${i}.cta`, { label: 'ボタンの文字' })}
            ${inputHTML(`RECOMMENDS.${i}.url`, { label: 'リンク先URL', ph: 'https://…' })}
          </div>
        </div>`).join('')}
        <button class="btn sm ghost" id="addRec" type="button" style="margin-top:12px">＋ 枠を追加</button>
      </div>`;
    },

    site() {
      return `<div class="panel">
        <h2>基本設定</h2>
        <div class="grid2">
          ${inputHTML('SITE.name', { label: 'サイト名' })}
          ${inputHTML('SITE.hashtag', { label: 'シェア時のハッシュタグ（#なし）' })}
        </div>
        ${inputHTML('SITE.url', { label: '公開URL', hint: 'Xでシェアしたときに付くURLです' })}
      </div>`;
    },
  };

  function render() {
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#main').innerHTML = views[tab]();
    $('#siteLink').href = state.SITE.url || './';
    bindView();
  }

  function bindView() {
    const main = $('#main');
    $$('[data-path]', main).forEach(el => {
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
        setPath(el.dataset.path, fromView(el));
        el.closest('tr')?.classList.toggle('set', !!el.value && el.dataset.path.startsWith('AFFILIATE.'));
        markDirty();
      });
    });
    $$('[data-go]', main).forEach(b => b.onclick = () => { tab = b.dataset.go; render(); });

    // LINE のテスト
    const openUrl = u => window.open(u, '_blank', 'noopener');
    $('#testAdd')?.addEventListener('click', () => state.LINE.addFriendUrl ? openUrl(state.LINE.addFriendUrl) : toast('友だち追加URLを入れてください'));
    $('#testMsg')?.addEventListener('click', () => state.LINE.id
      ? openUrl(`https://line.me/R/oaMessage/${encodeURIComponent(state.LINE.id)}/?${encodeURIComponent('【テスト】管理画面からの接続確認です')}`)
      : toast('ベーシックIDを入れてください'));

    // LINEの画像
    $$('[data-upload]', main).forEach(inp => inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('10MB以下の画像を選んでください'); return; }
      toast('画像をアップロードしています…');
      try {
        await uploadImage(inp.dataset.upload, file);
        markDirty(); render();
        toast('画像を登録しました。「保存して公開」でサイトに反映されます');
      } catch (e) { showError(explain(e)); }
    });
    $$('[data-clearimg]', main).forEach(b => b.onclick = () => {
      delete preview[b.dataset.clearimg]; state.LINE[b.dataset.clearimg] = ''; markDirty(); render();
    });

    // アフィリエイトの絞り込み
    const filterAff = () => {
      const q = norm($('#affQ')?.value), cat = $('#affCat')?.value, only = $('#affOnly')?.checked;
      $$('#affRows tr').forEach(tr => {
        tr.hidden = (q && !tr.dataset.q.includes(q)) || (cat && tr.dataset.cat !== cat) || (only && !tr.classList.contains('set'));
      });
    };
    ['affQ', 'affCat', 'affOnly'].forEach(id => $('#' + id)?.addEventListener('input', filterAff));
    $$('[data-test]', main).forEach(b => b.onclick = () => {
      const u = state.AFFILIATE[b.dataset.test];
      u ? openUrl(u) : toast('URLが入っていません');
    });

    // レポートの行追加・削除
    $$('[data-add]', main).forEach(b => b.onclick = () => {
      (state.REPORT[b.dataset.add] ||= []).push(JSON.parse(b.dataset.blank)); markDirty(); render();
    });
    $$('[data-del]', main).forEach(b => b.onclick = () => {
      const [key, i] = b.dataset.del.split('.');
      if (!confirm('この行を削除しますか？')) return;
      state.REPORT[key].splice(+i, 1); markDirty(); render();
    });

    // おすすめ枠の追加・削除
    $('#addRec')?.addEventListener('click', () => {
      state.RECOMMENDS.push({ id: 'always', tag: '', title: '', text: '', cta: '詳しく見る', url: '', enabled: true }); markDirty(); render();
    });
    $$('[data-delrec]', main).forEach(b => b.onclick = () => {
      if (!confirm('この枠を削除しますか？')) return;
      state.RECOMMENDS.splice(+b.dataset.delrec, 1); markDirty(); render();
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  }

  // ---------- ログイン ----------
  async function login(t, remember) {
    token = t.trim();
    const err = $('#loginErr');
    err.hidden = true;
    try {
      await gh(`/repos/${REPO}`);
      // アカウントの権限ではなく、トークン自体で保存できるかを確かめる
      if (!(await canWrite())) { const e = new Error('no write'); e.status = 403; throw e; }
      await loadSettings();
      try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch { }
      $('#login').hidden = true; $('#app').hidden = false;
      render();
    } catch (e) {
      token = '';
      err.innerHTML = explain(e);
      err.hidden = false;
      try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { }
    }
  }

  $('#repoName1').textContent = REPO;
  $('#btnLogin').onclick = () => login($('#token').value, $('#remember').checked);
  $('#token').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLogin').click(); });
  $('#btnLogout').onclick = () => {
    if (JSON.stringify(state) !== saved && !confirm('保存していない変更があります。ログアウトしますか？')) return;
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { }
    location.reload();
  };
  $('#nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  $('#btnSave').onclick = saveSettings;
  $('#errClose').onclick = () => { $('#errBox').hidden = true; };
  $('#btnRevert').onclick = async () => {
    if (!confirm('保存していない変更を取り消して、最新の設定を読み込みますか？')) return;
    await loadSettings(); render(); toast('最新の設定を読み込みました');
  };
  addEventListener('beforeunload', e => { if (state && JSON.stringify(state) !== saved) e.preventDefault(); });

  // 保存済みトークンがあれば自動ログイン
  let stored = '';
  try { stored = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { }
  if (stored) login(stored, !!localStorage.getItem(TOKEN_KEY));
})();
