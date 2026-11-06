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
  const SESSION_KEY = 'subhack.admin.session';
  const API_URL = (typeof API !== 'undefined' && API.url) || 'https://subhack-api.obuchi.workers.dev';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flat = s => String(s || '').replace(/\n/g, '');
  const clone = o => JSON.parse(JSON.stringify(o));
  // ひらがな→カタカナ・全角半角をそろえて検索する
  const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/s/g, '');

  const SVC = {}, CAT = {};
  CATEGORIES.forEach(c => { CAT[c.id] = c; c.items.forEach(s => { s.cat = c.id; SVC[s.id] = s; }); });

  let session = '';  // ログインの券（API が発行。GitHub のトークンはブラウザに来ない）
  let me = null;     // { id, name, role }
  let hasGithubToken = true;
  let sha = null;      // settings.json の現在のバージョン
  let state = null;    // 編集中の設定
  let saved = '';      // 最後に読み込み/保存した内容（変更検知用）
  let tab = 'dash';

  // ---------- GitHub API ----------
  // サブハック API を呼ぶ
  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(API_URL + path, {
        method,
        headers: { ...(session ? { Authorization: `Bearer ${session}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { const e = new Error('network'); e.status = 0; throw e; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(data.message || res.statusText);
      e.status = res.status; e.code = data.error || '';
      e.need = res.headers.get('x-accepted-github-permissions') || '';
      if (data.error === 'session' && me) sessionExpired();  // ログイン切れならログイン画面に戻す
      throw e;
    }
    return data;
  }

  // GitHub API（サーバーが預かっているトークンで中継してもらう）
  async function gh(path, opts = {}) {
    let body;
    if (opts.body) { try { body = JSON.parse(opts.body); } catch { body = opts.body; } }
    return api('/gh', { method: 'POST', body: { path, method: opts.method || 'GET', body } });
  }

  const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens';
  const FIX_PERMISSION = `<b>このトークンには「保存」の権限がありません。</b><br>
    <a href="${TOKEN_PAGE}" target="_blank" rel="noopener">GitHub のトークン一覧</a>で使っているトークンを開き、<br>
    ① 「Repository access」を <b>Only select repositories</b> にして <b>${REPO}</b> を選ぶ<br>
    ② 「Permissions」の <b>Repositories</b> の箱で「＋ Add permissions」→ <b>Contents</b> を <b>Read and write</b> にする<br>
    ③ 「Update」を押す<br>
    トークンの文字列は変わらないので、そのまま もう一度ログインすれば使えます。`;

  // GitHub のエラーを、何をすればいいかが分かる日本語にする
  function explain(e) {
    if (e.code === 'no_github_token') return `<b>サイトに保存するための GitHub トークンが登録されていません。</b><br>${me?.role === 'owner' ? '「👥 メンバー」の「保存用の GitHub トークン」から登録してください。' : 'オーナーに登録を頼んでください。'}`;
    if (e.code === 'session') return '<b>ログインの有効期限が切れました。</b><br>もう一度ログインしてください。';
    if (e.status === 424) return `<b>保存用の GitHub トークンの有効期限が切れたか、無効になっています。</b><br>${me?.role === 'owner' ? `<a href="${TOKEN_PAGE}" target="_blank" rel="noopener">GitHub のトークン一覧</a>で作り直し、「👥 メンバー」から登録し直してください。` : 'オーナーに登録し直しを頼んでください。'}`;
    if (e.code && !e.need) return `<b>${esc(e.message)}</b>`;
    if (e.status === 401) return `<b>トークンが正しくないか、有効期限が切れています。</b><br><a href="${TOKEN_PAGE}" target="_blank" rel="noopener">GitHub のトークン一覧</a>で期限を確認し、新しく作ってログインし直してください。`;
    if (e.status === 403 && /rate limit/i.test(e.message)) return '<b>短時間に操作が集中しました。</b><br>1分ほど待ってからもう一度お試しください。';
    if (e.status === 403 || (e.status === 404 && e.need)) return FIX_PERMISSION;
    if (e.status === 404) return `<b>リポジトリ（${REPO}）にアクセスできません。</b><br>トークンの「Repository access」で <b>${REPO}</b> が選ばれているか確認してください。`;
    if (e.status === 409 || e.status === 422) return '<b>ほかの人が先に保存しました。</b><br>「元に戻す」で最新を読み込み、もう一度変更して保存してください。';
    if (!e.status) return '<b>サーバーに接続できませんでした。</b><br>インターネット接続を確認して、もう一度お試しください。';
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
    return clone({ updatedAt: '', SITE, GA, LINE, MEMBERSHIP, AFFILIATE, RECOMMENDS, REPORT, REPORT_SHOW, GUIDES });
  }

  async function loadSettings() {
    try {
      const f = await gh(`/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
      sha = f.sha;
      state = { ...defaults(), ...JSON.parse(b64decode(f.content)) };
      // 後から増えたレポートの枠（ふるさと納税など）は初期値で補う
      Object.entries(clone(REPORT)).forEach(([k, v]) => { if (!Array.isArray(state.REPORT[k])) state.REPORT[k] = v; });
      if (!Array.isArray(state.GUIDES)) state.GUIDES = clone(GUIDES);
      state.REPORT_SHOW = { ...clone(REPORT_SHOW), ...(state.REPORT_SHOW || {}) };
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
    dash: '📊 ダッシュボード', vault: '🗂 アフィリエイト管理', line: '💬 LINE公式アカウント', member: '⭐ 有料会員', aff: '🔗 アフィリエイト（サービス別）',
    report: '📝 見直しレポート', recs: '📣 おすすめ枠', guides: '📰 お悩みガイド', site: '⚙️ 基本設定',
    stats: '📈 アクセス数', members: '👥 メンバー',
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
      const reportUrls = ['mobile', 'net', 'electric', 'cards', 'furusato'].reduce((n, k) => n + (state.REPORT[k] || []).filter(o => o.url).length, 0);
      const recUrls = (state.RECOMMENDS || []).filter(r => r.url && r.enabled !== false).length;
      const guideUrls = (state.GUIDES || []).reduce((n, g) => n + (g.links || []).filter(l => l.url && !/houterasu\.or\.jp/.test(l.url)).length, 0);
      const lineOk = !!(state.LINE.id && state.LINE.addFriendUrl);
      const todos = [
        !lineOk && ['LINE公式アカウントのIDと友だち追加URLを設定する', 'line'],
        !state.MEMBERSHIP.joinUrl && ['有料会員の決済リンクを設定する（未設定ならLINEで申し込み）', 'member'],
        !affCount && ['サービスごとのアフィリエイトリンクを登録する', 'aff'],
        !reportUrls && ['見直しレポートの乗り換え先にリンクを入れる', 'report'],
        !guideUrls && ['お悩みガイド（副業・転職・保険など）に申込リンクを入れる', 'guides'],
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
          <div class="stat"><small>お悩みガイドの申込リンク</small><b>${guideUrls}<small style="display:inline">件</small></b></div>
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
        const range = key !== 'furusato';
        return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>表示</th>${cols.map(c => `<th>${c.h}</th>`).join('')}${range ? '<th>表示する金額帯（今の月額）</th>' : ''}<th></th></tr></thead><tbody>
          ${list.map((o, i) => `<tr class="${o.show === false ? 'off' : ''}"><td><input type="checkbox" class="show-chk" data-path="REPORT.${key}.${i}.show" data-type="bool"${o.show !== false ? ' checked' : ''} aria-label="表示"></td>${cols.map(c => `<td>${c.sel ? sel(`REPORT.${key}.${i}.${c.k}`, c.sel) : inputHTML(`REPORT.${key}.${i}.${c.k}`, { type: c.t || '', cls: c.cls || '' })}</td>`).join('')}
            ${range ? `<td><div class="range">¥${inputHTML(`REPORT.${key}.${i}.min`, { cls: 'num', ph: '下限なし' })}〜¥${inputHTML(`REPORT.${key}.${i}.max`, { cls: 'num', ph: '上限なし' })}</div></td>` : ''}
            <td><button class="del" data-del="${key}.${i}" type="button" aria-label="削除">×</button></td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn sm ghost" data-add="${key}" data-blank='${esc(JSON.stringify(blank))}' type="button">＋ 行を追加</button>`;
      };
      return `<div class="panel">
        <h2>見直しレポート</h2>
        <p class="muted">結果画面の「あなたの見直しレポート」に出す乗り換え先です。URLを入れると申込ボタンが出て、リンクのある候補が優先して表示されます。「セット」には相性のよいサービスID（カンマ区切り）を入れると優先表示されます。</p>
        <h3>レポートに出す項目</h3>
        <div class="show-sections">${[['mobile', '📱 スマホ'], ['net', '🌐 光回線'], ['electric', '⚡ 電気代'], ['cards', '💳 クレジットカード'], ['furusato', '🎁 ふるさと納税']].map(([k, l]) =>
          `<label class="switch"><input type="checkbox" data-path="REPORT_SHOW.${k}" data-type="bool"${state.REPORT_SHOW?.[k] !== false ? ' checked' : ''}> ${l}</label>`).join('')}</div>
        <p class="muted">「表示」のチェックを外した候補はレポートに出ません。「表示する金額帯」を入れると、その項目の今の月額（クレジットカードはカードで払える毎月の支払い）がその範囲の人にだけ出ます。空欄なら制限なしです。</p>
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
        <h3>🎁 ふるさと納税（ポータルサイト）</h3>
        ${table('furusato', [{ h: 'サイト名', k: 'name' }, { h: '公式ドメイン', k: 'd' }, { h: '色', k: 'c', cls: 'num' }, { h: '文字', k: 't', cls: 'num' }, { h: '特徴', k: 'point' }, { h: '申込URL', k: 'url', cls: 'wide' }],
          { name: '', d: '', c: '#E11D48', t: '', point: '', url: '' })}
      </div>`;
    },

    guides() {
      const rules = k => Object.entries(GUIDE_RULES).map(([id, r]) => `<option value="${id}"${id === k ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
      return `<div class="panel">
        <h2>お悩み別ガイド</h2>
        <p class="muted">固定費レポートに出るブログ風の記事です。記事の最後に申込ボタン（アフィリエイトリンク）が並びます。URLが空のボタンは表示されません。条件に合う人には「あなたにおすすめ」として上に出ます。</p>
        <p class="muted">本文の書き方：空行で段落を分ける／「## 」で始まる行は見出し／「- 」で始まる行は箇条書き</p>
        ${(state.GUIDES || []).map((g, i) => `<div class="rec">
          <div class="rec-head"><b>${esc(g.emoji || '📄')} ${esc(g.title || '記事' + (i + 1))}</b>
            <label class="switch"><input type="checkbox" data-path="GUIDES.${i}.enabled" data-type="bool"${g.enabled !== false ? ' checked' : ''}> 表示する</label>
            <button class="del" data-delguide="${i}" type="button" aria-label="削除">×</button></div>
          <div class="grid2">
            ${inputHTML(`GUIDES.${i}.title`, { label: 'タイトル' })}
            <label class="field"><span>「あなたにおすすめ」にする条件</span><select data-path="GUIDES.${i}.when">${rules(g.when)}</select></label>
          </div>
          <div class="grid2">
            ${inputHTML(`GUIDES.${i}.emoji`, { label: '絵文字' })}
            <label class="field"><span>LINE相談（月額¥${Number(state.MEMBERSHIP.price || 0).toLocaleString()}）のボタン</span>
              <label class="switch" style="height:40px"><input type="checkbox" data-path="GUIDES.${i}.line" data-type="bool"${g.line !== false ? ' checked' : ''}> 記事の最後に出す</label></label>
          </div>
          ${inputHTML(`GUIDES.${i}.lead`, { label: 'リード文（カードと記事の冒頭に出る）' })}
          ${inputHTML(`GUIDES.${i}.body`, { label: '本文', area: true, cls: 'tall' })}
          <h3>申込ボタン</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ボタンの文字</th><th>説明</th><th>リンク先URL</th><th></th></tr></thead><tbody>
            ${(g.links || []).map((_, j) => `<tr>
              <td>${inputHTML(`GUIDES.${i}.links.${j}.name`)}</td>
              <td>${inputHTML(`GUIDES.${i}.links.${j}.desc`)}</td>
              <td>${inputHTML(`GUIDES.${i}.links.${j}.url`, { cls: 'wide', ph: 'https://px.a8.net/…' })}</td>
              <td><button class="del" data-dellink="${i}.${j}" type="button" aria-label="削除">×</button></td></tr>`).join('')}
          </tbody></table></div>
          <button class="btn sm ghost" data-addlink="${i}" type="button">＋ ボタンを追加</button>
        </div>`).join('')}
        <button class="btn sm ghost" id="addGuide" type="button" style="margin-top:12px">＋ 記事を追加</button>
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

    vault() { return '<div id="vaultRoot"></div>'; },

    site() {
      return `<div class="panel">
        <h2>基本設定</h2>
        <div class="grid2">
          ${inputHTML('SITE.name', { label: 'サイト名' })}
          ${inputHTML('SITE.hashtag', { label: 'シェア時のハッシュタグ（#なし）' })}
        </div>
        ${inputHTML('SITE.url', { label: '公開URL', hint: 'Xでシェアしたときに付くURLです' })}
        ${inputHTML('GA.id', { label: 'Google アナリティクスの測定ID', ph: 'G-XXXXXXXXXX', hint: '入れると公開サイトで Google アナリティクスが動きます。男女・年代は Google アナリティクスの管理画面で「Google シグナル」を有効にすると、推定で見られます' })}
      </div>`;
    },
    stats() {
      return `<div class="panel">
        <h2>アクセス数</h2>
        <p class="muted">公開サイトの表示回数・訪問者数（同じ人は1日1回まで）・流入元・押されたボタンです。日付は日本時間。個人を特定する情報は記録していません。</p>
        <div class="seg" id="statDays">
          ${[7, 30, 90].map(d => `<button type="button" data-days="${d}" class="${statDays === d ? 'on' : ''}">${d}日</button>`).join('')}
        </div>
        <div class="live" id="liveBox"><span class="live-dot"></span><div><small>いま見ている人</small><b id="liveNum">…</b></div><p class="muted" id="livePages"></p></div>
        <div id="statBody"><p class="muted">読み込み中…</p></div>
      </div>`;
    },
    members() {
      const owner = me.role === 'owner';
      return `<div class="panel">
        <h2>メンバー</h2>
        <p class="muted">管理画面にログインできる人です。ログイン中：<b>${esc(me.name)}</b>（ID：${esc(me.id)}・${owner ? 'オーナー' : 'メンバー'}）</p>
        <div id="memberList">${owner ? '<p class="muted">読み込み中…</p>' : ''}</div>
        ${owner ? `<h3>メンバーを追加</h3>
          <div class="grid2">
            <label class="field"><span>ログインID</span><input id="nmId" autocomplete="off" placeholder="半角英数字 3文字以上"></label>
            <label class="field"><span>名前</span><input id="nmName" autocomplete="off" placeholder="例：山田"></label>
            <label class="field"><span>最初のパスワード</span><input id="nmPw" type="text" autocomplete="off" placeholder="10文字以上"><small>本人に伝え、ログイン後に変えてもらってください</small></label>
            <label class="field"><span>権限</span><select id="nmRole"><option value="member">メンバー（設定の編集・保存・アクセス数）</option><option value="owner">オーナー（メンバーの管理もできる）</option></select></label>
          </div>
          <button class="btn" id="nmAdd" type="button" style="margin-top:12px">追加する</button>` : ''}
        <h3>自分のパスワードを変える</h3>
        <div class="grid2">
          <label class="field"><span>今のパスワード</span><input id="pwCur" type="password" autocomplete="current-password"></label>
          <label class="field"><span>新しいパスワード（10文字以上）</span><input id="pwNew" type="password" autocomplete="new-password"></label>
        </div>
        <button class="btn ghost" id="pwSave" type="button" style="margin-top:12px">パスワードを変える</button>
        ${owner ? `<h3>保存用の GitHub トークン</h3>
          <p class="muted">設定を保存するとき、サーバーがこのトークンを使います（ブラウザには渡しません）。状態：<b class="${hasGithubToken ? 'ok' : 'ng'}">${hasGithubToken ? '登録済み' : '未登録'}</b><br>期限が切れたら、作り直して登録し直してください。</p>
          <label class="field"><span>GitHub のトークン（github_pat_…）</span><input id="ghTok" type="password" autocomplete="off"></label>
          <button class="btn ghost" id="ghSave" type="button" style="margin-top:12px">登録する</button>` : ''}
      </div>`;
    },
  };
  let statDays = 30;

  function render() {
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#main').innerHTML = views[tab]();
    $('#siteLink').href = state.SITE.url || './';
    $('#savebar').hidden = tab === 'stats' || tab === 'members';
    bindView();
  }

  function bindView() {
    if (tab === 'stats') bindStats();
    if (tab === 'members') bindMembers();
    if (tab === 'vault') renderVault($('#vaultRoot'), { gh, REPO, BRANCH, getState: () => state, toast, showError, explain, esc });
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
    // お悩みガイドの追加・削除
    $('#addGuide')?.addEventListener('click', () => {
      state.GUIDES.push({ id: 'g' + Date.now().toString(36), emoji: '📄', enabled: true, when: 'always', title: '新しい記事', lead: '', body: '', links: [{ name: '', desc: '', url: '' }], line: true });
      markDirty(); render();
    });
    $$('[data-delguide]', main).forEach(b => b.onclick = () => {
      if (!confirm('この記事を削除しますか？')) return;
      state.GUIDES.splice(+b.dataset.delguide, 1); markDirty(); render();
    });
    $$('[data-addlink]', main).forEach(b => b.onclick = () => {
      (state.GUIDES[+b.dataset.addlink].links ||= []).push({ name: '', desc: '', url: '' }); markDirty(); render();
    });
    $$('[data-dellink]', main).forEach(b => b.onclick = () => {
      const [i, j] = b.dataset.dellink.split('.').map(Number);
      state.GUIDES[i].links.splice(j, 1); markDirty(); render();
    });

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

  // ---------- アクセス数 ----------
  const num = n => Number(n || 0).toLocaleString('ja-JP');
  // Cloudflare の地域名（英語）を都道府県名に
  const PREF = { Hokkaido: '北海道', Aomori: '青森県', Iwate: '岩手県', Miyagi: '宮城県', Akita: '秋田県', Yamagata: '山形県', Fukushima: '福島県', Ibaraki: '茨城県', Tochigi: '栃木県', Gunma: '群馬県', Saitama: '埼玉県', Chiba: '千葉県', Tokyo: '東京都', Kanagawa: '神奈川県', Niigata: '新潟県', Toyama: '富山県', Ishikawa: '石川県', Fukui: '福井県', Yamanashi: '山梨県', Nagano: '長野県', Gifu: '岐阜県', Shizuoka: '静岡県', Aichi: '愛知県', Mie: '三重県', Shiga: '滋賀県', Kyoto: '京都府', Osaka: '大阪府', Hyogo: '兵庫県', Nara: '奈良県', Wakayama: '和歌山県', Tottori: '鳥取県', Shimane: '島根県', Okayama: '岡山県', Hiroshima: '広島県', Yamaguchi: '山口県', Tokushima: '徳島県', Kagawa: '香川県', Ehime: '愛媛県', Kochi: '高知県', Fukuoka: '福岡県', Saga: '佐賀県', Nagasaki: '長崎県', Kumamoto: '熊本県', Oita: '大分県', Miyazaki: '宮崎県', Kagoshima: '鹿児島県', Okinawa: '沖縄県' };
  const prefName = k => PREF[k] || k;
  const PAGE_NAMES = { '/': 'トップ（診断）', '/index.html': 'トップ（診断）', '/hacks.html': 'ライフハック78選' };
  // いま見ている人（このタブを開いている間、15秒ごとに更新）
  let liveTimer = null;
  async function refreshLive() {
    if (tab !== 'stats' || !$('#liveNum')) { clearInterval(liveTimer); liveTimer = null; return; }
    try {
      const d = await api('/live');
      if (!$('#liveNum')) return;
      $('#liveNum').textContent = `${num(d.total)}人`;
      $('#livePages').textContent = d.total ? d.pages.map(p => `${PAGE_NAMES[p.key] || p.key}：${p.n}人`).join('　') + `（${new Date(d.at).toLocaleTimeString('ja-JP')} 時点）` : `いまは誰も見ていません（${new Date(d.at).toLocaleTimeString('ja-JP')} 時点）`;
    } catch { /* 次の更新で取り直す */ }
  }
  async function bindStats() {
    refreshLive();
    if (!liveTimer) liveTimer = setInterval(refreshLive, 15e3);
    $$('#statDays [data-days]').forEach(b => b.onclick = () => { statDays = +b.dataset.days; render(); });
    const box = $('#statBody');
    let d;
    try { d = await api(`/stats?days=${statDays}`); } catch (e) { box.innerHTML = `<p class="err">${explain(e)}</p>`; return; }
    if (tab !== 'stats') return;
    const sum = k => d.series.reduce((a, r) => a + r[k], 0);
    const ins = d.insights || { dev: [], os: [], freq: [], reg: [], hour: [], sex: [], age: [] };
    const hourMax = Math.max(1, ...ins.hour.map(r => r.n));
    // 割合の横棒（order があればその順で、なければ多い順）
    const insight = (title, rows, order, unit = '人') => {
      const list = order ? order.map(k => ({ key: k, n: (rows.find(r => r.key === k) || {}).n || 0 })) : rows;
      const total = list.reduce((a, r) => a + r.n, 0);
      return `<div class="ins"><h4>${esc(title)}<small>${total ? `計 ${num(total)}${unit === '回答' ? '件の回答' : unit === '来た日数' ? '人' : '人'}` : ''}</small></h4>
        ${total ? list.map(r => { const p = Math.round(r.n / total * 100); return `<div class="ins-row"><span>${esc(r.key)}</span><div class="ins-bar"><i style="width:${p}%"></i></div><b>${p}%</b></div>`; }).join('') : '<p class="muted">まだデータがありません</p>'}
      </div>`;
    };
    const todayRow = d.series[d.series.length - 1] || { pv: 0, uv: 0 };
    const max = Math.max(1, ...d.series.map(r => r.pv));
    const list = (rows, label, fmt = k => esc(k)) => rows.length
      ? `<table class="tbl rank"><thead><tr><th>${label}</th><th class="n">回数</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmt(r.key)}</td><td class="n">${num(r.n)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">まだデータがありません</p>';
    box.innerHTML = `
      <div class="stats">
        <div class="stat"><small>今日の表示回数</small><b>${num(todayRow.pv)}</b></div>
        <div class="stat"><small>今日の訪問者</small><b>${num(todayRow.uv)}</b></div>
        <div class="stat"><small>${d.days}日間の表示回数</small><b>${num(sum('pv'))}</b></div>
        <div class="stat"><small>${d.days}日間の訪問者（のべ）</small><b>${num(sum('uv'))}</b></div>
      </div>
      <div class="chart" role="img" aria-label="1日ごとの表示回数と訪問者">
        ${d.series.map(r => `<div class="bar" title="${r.day}：表示 ${r.pv}・訪問者 ${r.uv}"><i style="height:${Math.round(r.pv / max * 100)}%"></i><s style="height:${Math.round(r.uv / max * 100)}%"></s></div>`).join('')}
      </div>
      <p class="muted chart-legend"><span class="lg pv"></span>表示回数　<span class="lg uv"></span>訪問者　（${esc(d.from)} 〜 ${esc(d.today)}）</p>
      <div class="grid2 rank-grid">
        <div><h3>よく見られたページ</h3>${list(d.pages, 'ページ', k => esc(PAGE_NAMES[k] || k))}</div>
        <div><h3>どこから来たか</h3>${list(d.refs, '流入元')}</div>
      </div>
      <h3>押されたボタン・操作</h3>${list(d.events, '操作')}
      <h2 class="ins-h">インサイト</h2>
      <p class="muted">端末・地域・何日目の訪問かは「その日はじめて来た人」1人1回で数えています。性別・年代は、診断の結果画面で任意に答えてくれた人の分です。</p>
      <div class="ins-grid">
        ${insight('新規・リピーター', ins.freq, ['はじめて', '2〜3日目', '4〜9日目', '10日以上'], '来た日数')}
        ${insight('端末', ins.dev, ['スマホ', 'PC', 'タブレット'])}
        ${insight('性別', ins.sex, ['女性', '男性', 'その他・答えない'], '回答')}
        ${insight('年代', ins.age, ['10代', '20代', '30代', '40代', '50代', '60代以上'], '回答')}
        ${insight('OS', ins.os, ['iPhone・iPad', 'Android', 'Windows', 'Mac', 'その他'])}
        ${insight('地域（多い順）', ins.reg.slice(0, 10).map(r => ({ ...r, key: prefName(r.key) })))}
      </div>
      <h3>見られた時間帯（日本時間）</h3>
      <div class="hours">${Array.from({ length: 24 }, (_, h) => { const k = String(h).padStart(2, '0'); const n = (ins.hour.find(r => r.key === k) || {}).n || 0; return `<div title="${h}時台：${n}回"><i style="height:${Math.round(n / hourMax * 100)}%"></i><small>${h % 3 === 0 ? h : ''}</small></div>`; }).join('')}</div>`;
  }

  // ---------- メンバー ----------
  async function bindMembers() {
    const listBox = $('#memberList');
    const loadList = async () => {
      if (me.role !== 'owner') return;
      try {
        const { users } = await api('/users');
        if (tab !== 'members') return;
        const t = v => (v ? new Date(v).toLocaleString('ja-JP') : '—');
        listBox.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>名前</th><th>ID</th><th>権限</th><th>最後のログイン</th><th></th></tr></thead><tbody>
          ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.id)}</td><td>${u.role === 'owner' ? 'オーナー' : 'メンバー'}</td><td>${t(u.last_login)}</td>
            <td style="white-space:nowrap">${u.id === me.id ? '<span class="muted">あなた</span>' : `<button class="btn sm ghost" data-reset="${esc(u.id)}" type="button">パスワード再設定</button> <button class="btn sm danger" data-deluser="${esc(u.id)}" type="button">削除</button>`}</td></tr>`).join('')}
        </tbody></table></div>`;
        $$('[data-deluser]', listBox).forEach(b => b.onclick = async () => {
          if (!confirm(`${b.dataset.deluser} を削除しますか？ すぐにログインできなくなります`)) return;
          try { await api(`/users/${encodeURIComponent(b.dataset.deluser)}`, { method: 'DELETE' }); toast('削除しました'); loadList(); } catch (e) { showError(explain(e)); }
        });
        $$('[data-reset]', listBox).forEach(b => b.onclick = async () => {
          const pw = prompt(`${b.dataset.reset} の新しいパスワード（10文字以上）`);
          if (!pw) return;
          try { await api(`/users/${encodeURIComponent(b.dataset.reset)}/password`, { method: 'POST', body: { password: pw } }); toast('パスワードを変えました。本人に伝えてください'); } catch (e) { showError(explain(e)); }
        });
      } catch (e) { listBox.innerHTML = `<p class="err">${explain(e)}</p>`; }
    };
    loadList();
    $('#nmAdd')?.addEventListener('click', async () => {
      try {
        await api('/users', { method: 'POST', body: { id: $('#nmId').value.trim(), name: $('#nmName').value.trim(), password: $('#nmPw').value, role: $('#nmRole').value } });
        toast('追加しました。IDとパスワードを本人に伝えてください');
        ['#nmId', '#nmName', '#nmPw'].forEach(q => { $(q).value = ''; });
        loadList();
      } catch (e) { showError(explain(e)); }
    });
    $('#pwSave').onclick = async () => {
      try {
        await api('/me/password', { method: 'POST', body: { current: $('#pwCur').value, next: $('#pwNew').value } });
        toast('パスワードを変えました'); $('#pwCur').value = ''; $('#pwNew').value = '';
      } catch (e) { showError(explain(e)); }
    };
    $('#ghSave')?.addEventListener('click', async () => {
      const v = $('#ghTok').value.trim();
      if (!v) { toast('トークンを入れてください'); return; }
      try {
        await api('/github-token', { method: 'POST', body: { githubToken: v } });
        const first = !hasGithubToken;
        hasGithubToken = true;
        if (first) await loadSettings();
        toast('登録しました'); render();
      } catch (e) { showError(explain(e)); }
    });
  }

  // ---------- ログイン ----------
  function storeSession(remember) {
    try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session); } catch { }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { }
  }
  function sessionExpired() {
    clearSession();
    me = null; session = '';
    $('#app').hidden = true; $('#login').hidden = false;
    const err = $('#loginErr');
    err.innerHTML = '<b>ログインの有効期限が切れました。</b>もう一度ログインしてください。';
    err.hidden = false;
  }
  // ログイン後：自分の情報 → 設定の読み込み → 画面
  async function enter() {
    const info = await api('/me');
    me = info.user; hasGithubToken = info.githubToken;
    $('#meName').textContent = `${me.name}さん`;
    $$('#nav [data-owner]').forEach(el => { el.hidden = me.role !== 'owner'; });
    if (hasGithubToken) await loadSettings();
    else { state = defaults(); saved = JSON.stringify(state); markDirty(); }
    $('#login').hidden = true; $('#app').hidden = false;
    if (!hasGithubToken) { tab = 'members'; render(); showError(explain({ code: 'no_github_token' })); return; }
    render();
  }
  async function login(id, password, remember) {
    const err = $('#loginErr');
    err.hidden = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: { id: id.trim(), password } });
      session = r.token; storeSession(remember);
      await enter();
    } catch (e) {
      session = ''; clearSession();
      err.innerHTML = explain(e); err.hidden = false;
    }
  }
  async function setup() {
    const err = $('#setupErr');
    err.hidden = true;
    try {
      const r = await api('/auth/setup', { method: 'POST', body: { githubToken: $('#suToken').value.trim(), id: $('#suId').value.trim(), name: $('#suName').value.trim(), password: $('#suPw').value } });
      session = r.token; storeSession(true);
      $('#suToken').value = ''; $('#suPw').value = '';
      await enter();
      toast('オーナーとして登録しました。次からはIDとパスワードでログインできます');
    } catch (e) {
      session = '';
      err.innerHTML = explain(e); err.hidden = false;
    }
  }

  $('#repoName1').textContent = REPO;
  $('#btnLogin').onclick = () => login($('#loginId').value, $('#loginPw').value, $('#remember').checked);
  $('#loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLogin').click(); });
  $('#btnSetup').onclick = setup;
  $('#btnLogout').onclick = () => {
    if (state && JSON.stringify(state) !== saved && !confirm('保存していない変更があります。ログアウトしますか？')) return;
    clearSession();
    location.reload();
  };
  $('#nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  $('#btnSave').onclick = saveSettings;
  $('#errClose').onclick = () => { $('#errBox').hidden = true; };
  $('#btnRevert').onclick = async () => {
    if (!confirm('保存していない変更を取り消して、最新の設定を読み込みますか？')) return;
    await loadSettings(); render(); toast('最新の設定を読み込みました');
  };
  addEventListener('beforeunload', e => {
    const vm = renderVault.mem;
    if ((state && JSON.stringify(state) !== saved) || (vm && vm.data && JSON.stringify(vm.data) !== vm.saved)) e.preventDefault();
  });

  // 前のログインが残っていれば、そのまま入る（古い GitHub トークンの保存は消す）
  try { localStorage.removeItem('subhack.admin.token'); sessionStorage.removeItem('subhack.admin.token'); } catch { }
  let stored = '';
  try { stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || ''; } catch { }
  if (stored) {
    session = stored;
    enter().catch(e => { session = ''; clearSession(); if (e.code !== 'session') { $('#loginErr').innerHTML = explain(e); $('#loginErr').hidden = false; } });
  }
})();
