/*
 * カード明細のスクショ読み取り
 * 画像はブラウザ内の文字認識（Tesseract.js）で読むだけで、外部には送りません。
 * 読み取った各行からサービス名と金額を探し、確認してからマイリストに追加します。
 */

// 明細での表記 → サービスID（サービス名・読み仮名からの自動判定に加えて使う）
const STATEMENT_KEYS = {
  netflix: ['NETFLIX', 'ネットフリックス'],
  amazonprime: ['AMAZONPRIME', 'アマゾンプライム', 'プライム会費', 'PRIMEVIDEO'],
  kindleu: ['KINDLEUNLIMITED', 'KINDLEUNLTD', 'キンドルアンリミテッド'],
  amazonmusic: ['AMAZONMUSIC', 'アマゾンミュージック'],
  audible: ['AUDIBLE', 'オーディブル'],
  youtubepremium: ['YOUTUBEPREMIUM', 'GOOGLE*YOUTUBE', 'GOOGLEYOUTUBE', 'YOUTUBEPREM'],
  ytmusic: ['YOUTUBEMUSIC'],
  googleone: ['GOOGLEONE', 'GOOGLESTORAGE', 'GOOGLE*GOOGLEONE'],
  spotify: ['SPOTIFY', 'スポティファイ'],
  applemusic: ['APPLEMUSIC'],
  unext: ['U-NEXT', 'UNEXT', 'ユーネクスト'],
  disneyplus: ['DISNEYPLUS', 'DISNEY+', 'ディズニープラス'],
  hulu: ['HULU', 'フールー'],
  dazn: ['DAZN', 'ダゾーン'],
  abema: ['ABEMA', 'アベマ'],
  dmmtv: ['DMMTV', 'DMMプレミアム', 'DMM.COM'],
  danime: ['Dアニメ', 'DANIME'],
  lemino: ['LEMINO', 'レミノ'],
  fod: ['FODプレミアム', 'フジテレビオンデマンド'],
  telasa: ['TELASA', 'テラサ'],
  wowow: ['WOWOW'],
  niconico: ['ニコニコ', 'NICONICO', 'DWANGO', 'ドワンゴ'],
  chatgpt: ['OPENAI', 'CHATGPT'],
  claude: ['ANTHROPIC', 'CLAUDE.AI', 'CLAUDEAI'],
  perplexity: ['PERPLEXITY'],
  githubcopilot: ['GITHUB'],
  cursor: ['CURSOR', 'ANYSPHERE'],
  midjourney: ['MIDJOURNEY'],
  adobecc: ['ADOBE', 'アドビ'],
  m365: ['MICROSOFT365', 'MICROSOFT*365', 'MSBILL', 'マイクロソフト'],
  canva: ['CANVA'],
  dropbox: ['DROPBOX'],
  notion: ['NOTION'],
  zoom: ['ZOOM.US', 'ZOOMVIDEO'],
  xpremium: ['XCORP', 'TWITTER', 'XPREMIUM'],
  discordnitro: ['DISCORD'],
  nso: ['NINTENDO', '任天堂', 'ニンテンドー'],
  psplus: ['PLAYSTATION', 'SONYINTERACTIVE', 'ソニーインタラクティブ', 'PSN'],
  gamepass: ['XBOX'],
  duolingo: ['DUOLINGO'],
  nikkei: ['日経', 'NIKKEI'],
  rakutenmagazine: ['楽天マガジン'],
  cmoa: ['コミックシーモア', 'CMOA'],
  radiko: ['RADIKO', 'ラジコ'],
  uberone: ['UBERONE', 'ウーバーワン'],
  costco: ['コストコ年会費', 'COSTCOMEMBERSHIP'],
  chocozap: ['CHOCOZAP', 'チョコザップ', 'RIZAP', 'ライザップ'],
  anytime: ['ANYTIMEFITNESS', 'エニタイム'],
  curves: ['カーブス', 'CURVES'],
  // 通信
  docomo: ['NTTドコモ', 'ドコモ携帯', 'DOCOMO'],
  ahamo: ['AHAMO', 'アハモ'],
  au: ['KDDI', 'KDDT', 'KDD1', 'AU携帯', 'AU電話'],  // KDDT・KDD1 は文字認識でよくある読み違い
  povo: ['POVO'],
  uq: ['UQモバイル', 'UQMOBILE', 'UQコミュニケーションズ'],
  softbank: ['ソフトバンク携帯', 'SOFTBANKM', 'ソフトバンクモバイル'],
  ymobile: ['ワイモバイル', 'Y!MOBILE', 'YMOBILE'],
  linemo: ['LINEMO', 'ラインモ'],
  rakutenmobile: ['楽天モバイル', 'RAKUTENMOBILE'],
  iijmio: ['IIJ', 'インターネットイニシアティブ'],
  mineo: ['MINEO', 'マイネオ', 'オプテージ'],
  docomohikari: ['ドコモ光'],
  auhikari: ['AUひかり', 'AUヒカリ'],
  sbhikari: ['ソフトバンク光', 'SOFTBANK光'],
  nuro: ['NURO', 'ソニーネットワーク'],
  jcom: ['J:COM', 'JCOM', 'ジェイコム'],
  // 暮らし
  electric: ['電力', 'でんき', '電気料金', 'ENERGY', 'エナジー'],
  gas: ['東京ガス', '大阪ガス', '東邦ガス', '西部ガス', 'ニチガス', 'ガス料金', 'ガス代', 'LPガス', 'プロパン'],
  waterfee: ['水道'],
  nhk: ['NHK', '放送受信料'],
  insurance: ['生命保険', '生命'],
  carins: ['損害保険', '損保', '自動車保険'],
  kokunen: ['国民年金'],
  kokuho: ['国民健康保険', '国保'],
  scholarship: ['日本学生支援機構', 'JASSO', '奨学金'],
  cardloan: ['キャッシング'],
  revo: ['リボ払い', 'リボルビング'],
  atobarai: ['PAIDY', 'ペイディ'],
};

// どのサービスか特定できない決済（App Store など）は、名前つきで「自分で追加」扱いにする
const STATEMENT_GENERIC = [
  { keys: ['APPLE.COM/BILL', 'APPLECOMBILL', 'APPLE.COM', 'ITUNES'], name: 'Apple（App Store・iCloud+など）', color: '#111' },
  { keys: ['GOOGLEPLAY', 'GOOGLE*'], name: 'Google Play の定期購入', color: '#34A853' },
];

function initScan(ctx) {
  const { SVC, CAT, getItems, refresh, openSheet, closeSheet, icoHTML, iconOf, yen, esc, toast, uid, flat } = ctx;
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  // 照合用に文字をそろえる（全角→半角、半角カナ→全角、ひらがな→カタカナ、空白除去、大文字）
  const norm = s => String(s || '').normalize('NFKC').toUpperCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s　]/g, '');

  // 普段の買い物にも出てくるブランド名は、それだけでは判定に使わない
  const STOP = new Set(['ラクテン', 'アマゾン', 'グーグル', 'アップル', 'マイクロソフト', 'ソフトバンク', 'ドコモ', 'ヤフー', 'ポケモン', 'ニンテンドー', 'スイッチ', 'キンドル', 'ウーバー', 'ウーバーイーツ', 'コストコ', 'エックス', 'AMAZON', 'GOOGLE', 'APPLE', 'RAKUTEN', 'YAHOO', 'UBER', 'COSTCO', 'KINDLE'].map(norm));
  // 買い物の決済と区別しにくいサービスは、明細用の表記（STATEMENT_KEYS）だけで判定する
  const EXPLICIT_ONLY = new Set(['uberone', 'costco', 'kindleu', 'amazonphotos', 'applecare', 'rakutenpremium', 'yahoopremium', 'googleplaypass', 'demaecan', 'woltplus']);

  // サービスごとの照合キー（長いキーほど優先）
  const keys = [];
  Object.values(SVC).forEach(s => {
    const list = new Set((STATEMENT_KEYS[s.id] || []).map(norm));
    // 実在ブランド（公式アイコンがあるもの）は名前・読み仮名も使う
    if (ICON_DOMAINS[s.id] && !EXPLICIT_ONLY.has(s.id)) {
      [flat(s.n), ...(SEARCH_ALIASES[s.id] || '').split(/\s+/)]
        .map(norm).filter(k => k.length >= 4 && !STOP.has(k)).forEach(k => list.add(k));
    }
    list.forEach(k => keys.push({ k, sid: s.id }));
  });
  STATEMENT_GENERIC.forEach(g => g.keys.forEach(k => keys.push({ k: norm(k), generic: g })));
  keys.sort((a, b) => b.k.length - a.k.length);

  // 行から金額を取り出す（日付・時刻・カード番号は除く）
  function amountOf(line) {
    const cleaned = line.normalize('NFKC')
      .replace(/\d{2,4}\s*[\/.\-年]\s*\d{1,2}\s*[\/.\-月]\s*\d{1,2}\s*日?/g, ' ')
      .replace(/\d{1,2}\s*[\/月]\s*\d{1,2}\s*日?/g, ' ')
      .replace(/\d{1,2}:\d{2}/g, ' ')
      .replace(/[*＊]{2,}\d+/g, ' ');
    // 円に小数はないので「9.812」も桁区切りとして読む（文字認識でカンマが点になることがある）
    const nums = [...cleaned.matchAll(/[¥￥]?\s*(\d{1,3}(?:[,，.．]\d{3})+|\d{2,7})\s*円?/g)]
      .map(m => Number(m[1].replace(/[,，.．]/g, '')))
      .filter(n => n >= 50 && n <= 500000);
    return nums.length ? nums[nums.length - 1] : 0;
  }

  function parse(text) {
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const found = new Map();   // key: sid または generic 名
    lines.forEach((line, idx) => {
      const n = norm(line);
      const hit = keys.find(k => n.includes(k.k));
      if (!hit) return;
      const key = hit.sid || 'g:' + hit.generic.name;
      // 金額が同じ行に無ければ次の行を見る（表が2行に分かれて読まれることがある）
      const amount = amountOf(line) || (lines[idx + 1] && !keys.some(k => norm(lines[idx + 1]).includes(k.k)) ? amountOf(lines[idx + 1]) : 0);
      const prev = found.get(key);
      if (prev) { if (amount) prev.amount += amount; prev.lines.push(line); return; }
      found.set(key, { key, sid: hit.sid, generic: hit.generic, amount, lines: [line] });
    });
    return [...found.values()];
  }

  // 年払いらしい金額（いちばん安い月額プランの10倍以上）は年額として扱う
  function guessYearly(r) {
    const s = SVC[r.sid];
    if (!s || !r.amount) return false;
    const paid = s.p.map(p => p[1]).filter(v => v > 0);
    return paid.length && r.amount >= Math.min(...paid) * 10;
  }

  // 小さい文字（特に半角カナ）を読みやすくするため、拡大してグレースケール・コントラスト強めにする
  async function prepare(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(3, Math.max(1, 2400 / bmp.width));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(bmp, 0, 0, cv.width, cv.height);
    const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
    // 明るさの平均で白黒どちらが背景かを判定し、背景を白・文字を黒にそろえる（ダークモードの明細にも対応）
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    const dark = sum / (d.length / 16) < 128;
    for (let i = 0; i < d.length; i += 4) {
      let y = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
      if (dark) y = 255 - y;
      y = Math.max(0, Math.min(255, (y - 128) * 1.6 + 128));
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = TESSERACT_URL; sc.onload = res; sc.onerror = () => rej(new Error('読み取り機能を読み込めませんでした'));
      document.head.appendChild(sc);
    });
  }

  function open() {
    openSheet(`<div class="sh-head"><span class="ico" style="background:#0F766E">📷</span><div><h3>明細のスクショから読み取る</h3><p>カード明細・携帯料金明細・家計簿アプリの画面などに対応</p></div></div>
      <label class="scan-drop" id="scanDrop">
        <input type="file" id="scanFile" accept="image/*" multiple hidden>
        <b>画像を選ぶ</b><span>複数枚まとめて選べます</span>
      </label>
      <ul class="scan-tips">
        <li>🔒 画像はこの端末の中だけで読み取り、どこにも送信されません</li>
        <li>🔍 文字が小さいときは、拡大してからスクショすると精度が上がります</li>
        <li>📅 1〜2か月分あると、毎月の支払いを見つけやすくなります</li>
      </ul>`);
    $('#scanFile').onchange = e => { if (e.target.files.length) run([...e.target.files]); };
  }

  async function run(files) {
    openSheet(`<div class="sh-head"><span class="ico" style="background:#0F766E">📷</span><div><h3>読み取り中…</h3><p id="scanStep">準備しています（初回は少し時間がかかります）</p></div></div>
      <div class="scan-bar"><i id="scanBar"></i></div>`);
    const step = (t, p) => { const s = $('#scanStep'), b = $('#scanBar'); if (s) s.textContent = t; if (b && p != null) b.style.width = Math.round(p * 100) + '%'; };
    let text = '';
    try {
      await loadTesseract();
      const worker = await Tesseract.createWorker(['jpn', 'eng'], 1, {
        logger: m => {
          if (m.status === 'recognizing text') step(`文字を読み取っています（${worker._n || 1}/${files.length}枚目）`, ((worker._n || 1) - 1 + m.progress) / files.length);
          else if (/load/.test(m.status)) step('読み取りの準備中…', null);
        },
      });
      for (let k = 0; k < files.length; k++) {
        worker._n = k + 1;
        const { data } = await worker.recognize(await prepare(files[k]));
        text += '\n' + data.text;
      }
      await worker.terminate();
    } catch (e) {
      openSheet(`<div class="sh-head"><div><h3>読み取れませんでした</h3><p>${esc(e.message || '通信状況を確認して、もう一度お試しください')}</p></div></div>
        <button class="btn" id="scanRetry" type="button">もう一度選ぶ</button>`);
      $('#scanRetry').onclick = open;
      return;
    }
    showResult(parse(text), text);
  }

  function showResult(results, rawText) {
    const rows = results.map((r, i) => {
      const s = r.sid && SVC[r.sid];
      const name = s ? flat(s.n) : r.generic.name;
      const ic = s ? iconOf({ sid: r.sid }) : { c: r.generic.color, t: name.slice(0, 1) };
      const yearly = guessYearly(r);
      return `<div class="scan-row" data-i="${i}">
        <input type="checkbox" class="scan-on" checked aria-label="${esc(name)}を追加">
        ${icoHTML(ic)}
        <div class="scan-name"><b>${esc(name)}</b><small>${esc(r.lines[0].slice(0, 40))}</small></div>
        <div class="scan-amt">
          <input type="number" class="scan-price" inputmode="numeric" value="${r.amount || ''}" placeholder="金額">
          <select class="scan-unit"><option value="m"${yearly ? '' : ' selected'}>月</option><option value="y"${yearly ? ' selected' : ''}>年</option></select>
        </div>
      </div>`;
    }).join('');

    openSheet(`<div class="sh-head"><span class="ico" style="background:#0F766E">✓</span><div>
        <h3>${results.length ? `${results.length}件 見つかりました` : '見つかりませんでした'}</h3>
        <p>${results.length ? '内容と金額を確認して、追加するものにチェック' : 'サービス名が写っているか確認して、もう一度お試しください'}</p></div></div>
      ${rows ? `<div class="scan-list">${rows}</div>
        <button class="btn" id="scanAdd" type="button">チェックしたものをマイリストに追加</button>` : ''}
      <button class="btn ghost" id="scanMore" type="button">別の画像も読み取る</button>
      <details class="scan-raw"><summary>読み取った文字を見る</summary><pre>${esc(rawText.trim().slice(0, 4000))}</pre></details>
      <p class="scan-note">見つからなかったものは、一覧から選ぶか各カテゴリの「自分で追加」で入れてください。</p>`);

    $('#scanMore').onclick = open;
    $('#scanAdd')?.addEventListener('click', () => {
      const items = getItems();
      let added = 0;
      $$('.scan-row').forEach(row => {
        if (!row.querySelector('.scan-on').checked) return;
        const r = results[+row.dataset.i];
        const v = Number(row.querySelector('.scan-price').value) || 0;
        const yearly = row.querySelector('.scan-unit').value === 'y';
        const price = Math.round(yearly ? v / 12 : v);
        const plan = yearly ? `明細から（年額 ¥${yen(v)}）` : '明細から';
        const s = r.sid && SVC[r.sid];
        if (s) {
          const cur = items.find(i => i.sid === r.sid);
          if (cur && !s.multi) Object.assign(cur, { plan, price });
          else items.push({ uid: uid(), sid: r.sid, cat: s.cat, plan, price });
        } else {
          items.push({ uid: uid(), sid: 'custom', cat: 'tool', name: r.generic.name, plan, price, color: r.generic.color });
        }
        added++;
      });
      if (!added) { toast('追加するものにチェックを入れてください'); return; }
      refresh(); closeSheet(); toast(`${added}件をマイリストに追加しました`);
    });
  }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  return { open, parse };
}
