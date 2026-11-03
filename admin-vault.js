/*
 * 管理画面「アフィリエイト管理（金庫）」
 * ASPのログイン情報と、登録しているアフィリエイト案件の一覧を、金庫のパスワードで暗号化して vault.json に保存します。
 * リポジトリは公開なので、暗号化前の内容はどこにも保存しません（ブラウザのメモリの中だけ）。
 *   暗号化：PBKDF2-SHA256（60万回）で鍵を作り、AES-256-GCM で暗号化
 */
const VAULT_FILE = 'vault.json';
const VAULT_ITER = 600000;
const VAULT_MIN_PASS = 12;
const VAULT_IDLE_MS = 10 * 60 * 1000;   // 10分操作がなければロック

const VAULT_STATUS = ['申請中', '提携中', '否認', '終了'];
// アフィリエイトリンクのホスト名からASPを推測（取り込み時に使う）
const ASP_HOSTS = [
  [/a8\.net$/, 'A8.net'], [/moshimo\.com$/, 'もしもアフィリエイト'], [/valuecommerce\.(com|ne\.jp)$/, 'バリューコマース'],
  [/accesstrade\.net$/, 'アクセストレード'], [/afi-b\.com$/, 'afb'], [/j-a-net\.jp$/, 'JANet'], [/trafficgate\.net$/, 'TGアフィリエイト'],
  [/felmat\.net$/, 'felmat'], [/rentracks\.jp$/, 'レントラックス'], [/stripe\.com$/, 'Stripe（決済）'],
];

// ---------- 暗号化 ----------
const vb64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const vunb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function vaultKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function vaultEncrypt(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey(pass, salt, VAULT_ITER);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: VAULT_ITER, salt: vb64(salt), iv: vb64(iv), data: vb64(data) };
}
async function vaultDecrypt(file, pass) {
  const key = await vaultKey(pass, vunb64(file.salt), file.iter);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vunb64(file.iv) }, key, vunb64(file.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

// ---------- サイトの設定からリンクの使用場所を集める ----------
function siteLinks(state) {
  const out = [];
  const add = (url, where, name) => { if (url) out.push({ url: String(url).trim(), where, name }); };
  Object.entries(state.AFFILIATE || {}).forEach(([sid, url]) => {
    const s = (typeof CATEGORIES !== 'undefined') && CATEGORIES.flatMap(c => c.items).find(x => x.id === sid);
    add(url, `🔗 サービス別：${s ? s.n.replace(/\n/g, '') : sid}`, s ? s.n.replace(/\n/g, '') : sid);
  });
  const RNAME = { mobile: 'スマホ', net: '光回線', electric: '電気', cards: 'クレジットカード', furusato: 'ふるさと納税' };
  Object.entries(state.REPORT || {}).forEach(([k, list]) => (list || []).forEach(o => {
    const name = o.name || ((typeof CATEGORIES !== 'undefined' && CATEGORIES.flatMap(c => c.items).find(x => x.id === o.sid)?.n) || o.sid || '').replace(/\n/g, '');
    add(o.url, `📝 見直しレポート：${RNAME[k] || k}／${name}`, name);
  }));
  (state.RECOMMENDS || []).forEach(r => add(r.url, `📣 おすすめ枠：${r.tag || r.title}`, r.tag || r.title));
  (state.GUIDES || []).forEach(g => (g.links || []).forEach(l => add(l.url, `📰 お悩みガイド：${g.title}／${l.name}`, l.name)));
  add(state.MEMBERSHIP?.joinUrl, '⭐ 有料会員の申込リンク', '有料会員');
  return out;
}
function aspFromUrl(url) {
  try { const h = new URL(url).hostname; return (ASP_HOSTS.find(([re]) => re.test(h)) || [, ''])[1]; } catch { return ''; }
}

// ---------- 画面 ----------
// ctx: { gh, REPO, BRANCH, getState, toast, showError, explain, esc }
function renderVault(root, ctx) {
  const { gh, REPO, BRANCH, getState, toast, showError, explain, esc } = ctx;
  const V = renderVault.mem || (renderVault.mem = { file: null, sha: null, data: null, pass: null, saved: '', timer: null, loaded: false });

  const lock = () => { V.data = null; V.pass = null; clearTimeout(V.timer); draw(); };
  const touch = () => { clearTimeout(V.timer); if (V.data) V.timer = setTimeout(() => { lock(); toast('10分間操作がなかったので金庫をロックしました'); }, VAULT_IDLE_MS); };
  const dirty = () => V.data && JSON.stringify(V.data) !== V.saved;

  async function load() {
    try {
      const f = await gh(`/repos/${REPO}/contents/${VAULT_FILE}?ref=${BRANCH}`);
      V.sha = f.sha;
      V.file = JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\n/g, '')))));
    } catch (e) {
      if (e.status !== 404) throw e;
      V.sha = null; V.file = null;
    }
    V.loaded = true;
  }

  async function persist(pass) {
    const file = await vaultEncrypt(V.data, pass);
    const body = JSON.stringify(file, null, 2) + '\n';
    const res = await gh(`/repos/${REPO}/contents/${VAULT_FILE}`, {
      method: 'PUT',
      body: JSON.stringify({ message: '管理画面からアフィリエイト管理（暗号化）を更新', content: btoa(body), branch: BRANCH, ...(V.sha ? { sha: V.sha } : {}) }),
    });
    V.sha = res.content.sha; V.file = file; V.pass = pass; V.saved = JSON.stringify(V.data);
  }

  function draw() {
    if (!V.loaded) { root.innerHTML = '<div class="panel"><p class="muted">金庫を読み込んでいます…</p></div>'; return; }
    if (!V.file && !V.data) return drawCreate();
    if (!V.data) return drawLocked();
    drawOpen();
  }

  function drawCreate() {
    root.innerHTML = `<div class="panel vault">
      <h2>🗂 アフィリエイト管理（金庫）</h2>
      <p class="muted">ASPのログイン情報と、登録しているアフィリエイト案件をまとめて管理します。中身は「金庫のパスワード」で暗号化して保存され、パスワードを入れないと誰も読めません。</p>
      <div class="vault-warn">⚠️ このサイトのリポジトリは公開されています。暗号化しているので中身は読めませんが、推測されにくい<b>${VAULT_MIN_PASS}文字以上</b>のパスワードにしてください。<b>パスワードを忘れると中身は戻せません。</b>GitHubのトークンとは別のものにしてください。</div>
      <div class="grid2">
        <label class="field"><span>金庫のパスワード</span><input type="password" id="vNew1" autocomplete="new-password"></label>
        <label class="field"><span>もう一度</span><input type="password" id="vNew2" autocomplete="new-password"></label>
      </div>
      <button class="btn" id="vCreate" type="button" style="margin-top:12px">金庫を作る</button>
    </div>`;
    root.querySelector('#vCreate').onclick = async () => {
      const p1 = root.querySelector('#vNew1').value, p2 = root.querySelector('#vNew2').value;
      if (p1.length < VAULT_MIN_PASS) return toast(`パスワードは${VAULT_MIN_PASS}文字以上にしてください`);
      if (p1 !== p2) return toast('2回入れたパスワードが一致しません');
      V.data = { logins: [], programs: [], updatedAt: '' };
      try { await persist(p1); toast('金庫を作りました'); touch(); draw(); }
      catch (e) { V.data = null; showError(explain(e)); }
    };
  }

  function drawLocked() {
    root.innerHTML = `<div class="panel vault">
      <h2>🗂 アフィリエイト管理（金庫）</h2>
      <p class="muted">ASPのログイン情報と、登録しているアフィリエイト案件は暗号化されています。金庫のパスワードを入れると表示されます。</p>
      <div class="vault-lock">🔒
        <label class="field" style="flex:1;margin:0"><span>金庫のパスワード</span><input type="password" id="vPass" autocomplete="current-password"></label>
        <button class="btn" id="vOpen" type="button">開く</button>
      </div>
      <p class="err" id="vErr" hidden></p>
    </div>`;
    const open = async () => {
      const pass = root.querySelector('#vPass').value;
      const btn = root.querySelector('#vOpen');
      btn.disabled = true; btn.textContent = '確認中…';
      try {
        V.data = await vaultDecrypt(V.file, pass);
        V.data.logins ||= []; V.data.programs ||= [];
        V.pass = pass; V.saved = JSON.stringify(V.data);
        touch(); draw();
      } catch {
        const err = root.querySelector('#vErr'); err.textContent = 'パスワードが違います'; err.hidden = false;
        btn.disabled = false; btn.textContent = '開く';
      }
    };
    root.querySelector('#vOpen').onclick = open;
    root.querySelector('#vPass').addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    root.querySelector('#vPass').focus();
  }

  function drawOpen() {
    const d = V.data, state = getState();
    const links = siteLinks(state);
    const usage = url => url ? links.filter(l => l.url === url.trim()).map(l => l.where) : [];
    const inp = (path, val, { cls = '', ph = '', type = 'text' } = {}) =>
      `<input class="${cls}" type="${type}" data-v="${path}" value="${esc(val ?? '')}" placeholder="${esc(ph)}" autocomplete="off">`;
    const counts = VAULT_STATUS.map(s => `${s} ${d.programs.filter(p => p.status === s).length}`).join('・');
    const unlinked = links.filter(l => !d.programs.some(p => p.url && p.url.trim() === l.url)).length;

    root.innerHTML = `<div class="panel vault">
      <div class="vault-head"><h2>🗂 アフィリエイト管理（金庫）</h2>
        <span class="vault-open">🔓 開いています</span>
        <button class="btn sm ghost" id="vLock" type="button">ロックする</button></div>
      <p class="muted">この画面の内容は暗号化して保存されます。変更したら下の「金庫に保存」を押してください（サイトの設定の保存とは別です）。</p>

      <h3>🔑 ASPのログイン情報</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ASP名</th><th>ログインURL</th><th>ID・メール</th><th>パスワード</th><th>メモ</th><th></th></tr></thead><tbody>
        ${d.logins.map((l, i) => `<tr>
          <td>${inp(`logins.${i}.asp`, l.asp, { ph: 'A8.net' })}</td>
          <td><div class="vault-url">${inp(`logins.${i}.loginUrl`, l.loginUrl, { cls: 'wide', ph: 'https://' })}${l.loginUrl ? `<a class="btn sm ghost" href="${esc(l.loginUrl)}" target="_blank" rel="noopener">開く</a>` : ''}</div></td>
          <td><div class="vault-url">${inp(`logins.${i}.user`, l.user)}<button class="btn sm ghost" data-copy="logins.${i}.user" type="button">コピー</button></div></td>
          <td><div class="vault-url">${inp(`logins.${i}.pass`, l.pass, { type: 'password' })}<button class="btn sm ghost" data-show type="button">表示</button><button class="btn sm ghost" data-copy="logins.${i}.pass" type="button">コピー</button></div></td>
          <td>${inp(`logins.${i}.memo`, l.memo)}</td>
          <td><button class="del" data-del="logins.${i}" type="button" aria-label="削除">×</button></td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn sm ghost" data-add="logins" type="button">＋ ASPを追加</button>

      <h3>📋 登録しているアフィリエイト案件 <small class="muted">（${counts}）</small></h3>
      <div class="tools">
        <button class="btn sm ghost" id="vImport" type="button">サイトで使っているリンクを取り込む${unlinked ? `（未登録 ${unlinked}件）` : ''}</button>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ASP</th><th>案件名</th><th>状態</th><th>報酬</th><th>成果条件</th><th>アフィリエイトURL</th><th>サイトでの設置場所</th><th>メモ</th><th></th></tr></thead><tbody>
        ${d.programs.map((p, i) => {
          const used = usage(p.url);
          return `<tr>
          <td>${inp(`programs.${i}.asp`, p.asp)}</td>
          <td>${inp(`programs.${i}.name`, p.name)}</td>
          <td><select data-v="programs.${i}.status">${VAULT_STATUS.map(s => `<option${p.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
          <td>${inp(`programs.${i}.reward`, p.reward, { cls: 'num', ph: '5,000円' })}</td>
          <td>${inp(`programs.${i}.condition`, p.condition, { ph: '新規開通' })}</td>
          <td>${inp(`programs.${i}.url`, p.url, { cls: 'wide', ph: 'https://px.a8.net/…' })}</td>
          <td class="vault-used">${used.length ? used.map(u => `<span>${esc(u)}</span>`).join('') : '<em>未設置</em>'}</td>
          <td>${inp(`programs.${i}.memo`, p.memo)}</td>
          <td><button class="del" data-del="programs.${i}" type="button" aria-label="削除">×</button></td></tr>`;
        }).join('')}
      </tbody></table></div>
      <button class="btn sm ghost" data-add="programs" type="button">＋ 案件を追加</button>

      <div class="vault-save">
        <span id="vState">${dirty() ? '保存していない変更があります' : (d.updatedAt ? `最終保存：${new Date(d.updatedAt).toLocaleString('ja-JP')}` : 'まだ保存していません')}</span>
        <button class="btn sm ghost" id="vChange" type="button">パスワードを変更</button>
        <button class="btn" id="vSave" type="button">金庫に保存</button>
      </div>
    </div>`;

    const set = (path, val) => {
      const keys = path.split('.'), last = keys.pop();
      keys.reduce((o, k) => o[k], d)[last] = val;
      const st = root.querySelector('#vState');
      if (st) st.textContent = dirty() ? '保存していない変更があります' : '変更はありません';
      touch();
    };
    root.querySelectorAll('[data-v]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => set(el.dataset.v, el.value)));
    // URLを変えたら設置場所を更新するため、入力が終わったら描き直す
    root.querySelectorAll('[data-v$=".url"]').forEach(el => el.addEventListener('change', () => draw()));
    root.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
      const i = b.parentElement.querySelector('input');
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? '表示' : '隠す';
      touch();
    });
    root.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      const v = b.dataset.copy.split('.').reduce((o, k) => o[k], d) || '';
      try { await navigator.clipboard.writeText(v); toast('コピーしました'); } catch { toast('コピーできませんでした'); }
      touch();
    });
    root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const k = b.dataset.add;
      d[k].push(k === 'logins' ? { asp: '', loginUrl: '', user: '', pass: '', memo: '' } : { asp: '', name: '', status: '申請中', reward: '', condition: '', url: '', memo: '' });
      touch(); draw();
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('この行を削除しますか？')) return;
      const [k, i] = b.dataset.del.split('.');
      d[k].splice(+i, 1); touch(); draw();
    });
    root.querySelector('#vImport').onclick = () => {
      let n = 0;
      links.forEach(l => {
        if (d.programs.some(p => p.url && p.url.trim() === l.url)) return;
        if (/houterasu\.or\.jp|\.go\.jp|\.lg\.jp/.test(l.url)) return;  // 公的機関へのリンクはアフィリエイトではない
        d.programs.push({ asp: aspFromUrl(l.url), name: l.name, status: '提携中', reward: '', condition: '', url: l.url, memo: '' });
        n++;
      });
      toast(n ? `${n}件を取り込みました。「金庫に保存」を押してください` : '取り込むリンクはありません');
      touch(); draw();
    };
    root.querySelector('#vLock').onclick = () => {
      if (dirty() && !confirm('保存していない変更があります。ロックすると変更は消えます。ロックしますか？')) return;
      lock();
    };
    root.querySelector('#vSave').onclick = async () => {
      const btn = root.querySelector('#vSave');
      btn.disabled = true; btn.textContent = '暗号化して保存中…';
      try { d.updatedAt = new Date().toISOString(); await persist(V.pass); toast('金庫に保存しました'); draw(); }
      catch (e) { showError(explain(e)); btn.disabled = false; btn.textContent = '金庫に保存'; }
    };
    root.querySelector('#vChange').onclick = async () => {
      const p1 = prompt(`新しい金庫のパスワード（${VAULT_MIN_PASS}文字以上）`);
      if (p1 == null) return;
      if (p1.length < VAULT_MIN_PASS) return toast(`パスワードは${VAULT_MIN_PASS}文字以上にしてください`);
      if (prompt('もう一度入力してください') !== p1) return toast('2回入れたパスワードが一致しません');
      try { d.updatedAt = new Date().toISOString(); await persist(p1); toast('パスワードを変更して保存しました'); draw(); }
      catch (e) { showError(explain(e)); }
    };
  }

  draw();
  if (!V.loaded) load().then(draw).catch(e => { root.innerHTML = ''; showError(explain(e)); });
}
