/*
 * 検索エンジン・AI 向けの静的ページを作る
 *   node tools/build-static.js
 * data.js（料金）と hacks-data.js（ライフハック）から、JavaScript なしで読める HTML を作ります。
 * - price/index.html, price/<カテゴリ>.html … サブスク料金一覧
 * - hacks.html の中身（読み込み前に見える要約。JavaScript が動くと通常の画面に置き換わる）
 * - llms.txt / sitemap.xml
 * 料金やライフハックを変えたら、もう一度実行してから公開してください。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://www.sabu-hack.com/';
const now = new Date(Date.now() + 9 * 3600e3);
const TODAY = now.toISOString().slice(0, 10);
const MONTH = `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月`;

// ---------- データを読む ----------
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['config.js', 'data.js', 'hacks-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;globalThis.__x = { CATEGORIES: typeof CATEGORIES !== "undefined" ? CATEGORIES : null, HACKS: typeof HACKS !== "undefined" ? HACKS : null, HACK_CATS: typeof HACK_CATS !== "undefined" ? HACK_CATS : null, HACKS_UPDATED: typeof HACKS_UPDATED !== "undefined" ? HACKS_UPDATED : null, LINE: typeof LINE !== "undefined" ? LINE : null };', ctx);
}
const { CATEGORIES, HACK_CATS, HACKS_UPDATED } = ctx.__x;
let { HACKS } = ctx.__x;
let settings = {};
try { settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'settings.json'), 'utf8')); } catch { }
const LINE_URL = (settings.LINE && settings.LINE.addFriendUrl) || '';
const order = id => HACK_CATS.findIndex(c => c.id === id);
HACKS = [...HACKS].sort((a, b) => order(a.cat) - order(b.cat));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => Number(n).toLocaleString('ja-JP');
const flat = s => String(s || '').replace(/\n/g, '');
const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), text); };

// ---------- 料金ページの対象（毎月の定額で値段が決まっているもの） ----------
const PRICE_CATS = {
  video: { slug: 'video', title: '動画配信サービス（動画サブスク）', short: '動画サブスク' },
  music: { slug: 'music', title: '音楽配信サービス（音楽サブスク）', short: '音楽サブスク' },
  ai: { slug: 'ai', title: '生成AI・AIツール', short: 'AIサブスク' },
  cloud: { slug: 'cloud', title: 'クラウドストレージ・パスワード管理', short: 'クラウドストレージ' },
  book: { slug: 'book', title: '電子書籍・マンガ・ニュース', short: '読書・マンガのサブスク' },
  game: { slug: 'game', title: 'ゲームのサブスク', short: 'ゲームのサブスク' },
  learn: { slug: 'learn', title: '学習・語学・ヘルスケアアプリ', short: '学習・ヘルスケアのサブスク' },
  gym: { slug: 'gym', title: 'ジム・フィットネス', short: 'ジム・フィットネス' },
  money: { slug: 'money', title: '家計簿・会計アプリ', short: '家計簿・会計アプリ' },
  tool: { slug: 'tool', title: 'アプリ・ソフト（Microsoft 365・Adobe など）', short: 'アプリ・ソフトのサブスク' },
  shop: { slug: 'shop', title: '買い物・宅配・会員サービス', short: '買い物・宅配の会員サービス' },
  net: { slug: 'net', title: '光回線・ホームルーター・Wi-Fi', short: '光回線・Wi-Fi' },
  mobile: { slug: 'mobile', title: 'スマホ料金（携帯会社・格安SIM）', short: 'スマホ（携帯・格安SIM）' },
};
// 「〜5,000円」のような目安の幅や、自分で入れる枠は一覧に出さない
const realPlans = s => (s.p || []).filter(p => typeof p[1] === 'number' && p[1] > 0 && !/^〜|^~|円$|直接入力|自分で|その他/.test(String(p[0])) && !p[3]);
// 推し・チャンネルのように金額が人それぞれの枠（multi で、プラン名が金額のもの）は除く
const isReal = s => !/other$|^custom|^primechannel$/.test(s.id) && realPlans(s).length;
const cheapest = s => Math.min(...realPlans(s).map(p => p[1]));

// ---------- 共通の枠 ----------
function page({ rel, title, description, h1, lead, body, ld, crumbs }) {
  const url = BASE + rel.replace(/index\.html$/, '');
  const depth = rel.split('/').length - 1;
  const up = '../'.repeat(depth);
  const crumbLd = crumbs ? { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: BASE + c[1] })) } : null;
  const graph = [...(ld || []), ...(crumbLd ? [crumbLd] : [])];
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="${up}images/icon.png">
<link rel="apple-touch-icon" href="${up}images/icon-1024.png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="サブハック">
<meta property="og:image" content="${BASE}images/og.jpg">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F7F5F0">
${graph.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}style.css?v=${TODAY.replace(/-/g, '')}">
</head>
<body class="sp-page">
<header class="hdr">
  <a class="brand" href="${up}">
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="brand-name">サブハック<small>サブスクハック</small></span>
  </a>
  <nav class="hdr-actions"><a class="hdr-link" href="${up}">サブスクの合計を診断する</a></nav>
</header>
<main class="sp">
  ${crumbs ? `<nav class="sp-crumbs" aria-label="パンくず">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${up}${c[1]}">${esc(c[0])}</a>` : `<span>${esc(c[0])}</span>`).join(' › ')}</nav>` : ''}
  <h1>${h1}</h1>
  ${lead ? `<p class="sp-lead">${lead}</p>` : ''}
  ${body}
  <section class="sp-cta">
    <h2>自分のサブスク、ぜんぶでいくら？</h2>
    <p>サブハックなら、使っているものを選ぶだけで毎月・年間の合計と、見直すと安くなるポイントがわかります。無料・登録不要で、入力した内容はブラウザの外に送られません。</p>
    <a class="btn" href="${up}">無料でサブスクの合計を診断する</a>
  </section>
</main>
<footer class="ftr sp-ftr">
  <p><a href="${up}">サブスク合計診断</a> ／ <a href="${up}price/">サブスク料金一覧</a> ／ <a href="${up}hacks.html">ライフハック</a> ／ <a href="${up}about.html">サブハックについて</a></p>
  <p>※料金は${MONTH}時点の目安（税込）です。最新の料金・条件は各サービスの公式サイトでご確認ください。各サービス名は各社の商標です。</p>
  <p class="copy">© ${now.getUTCFullYear()} サブハック（サブスクハック）</p>
</footer>
<script src="${up}config.js"></script>
<script src="${up}track.js"></script>
</body>
</html>
`;
}

// ---------- 料金一覧 ----------
const priceCats = CATEGORIES.filter(c => PRICE_CATS[c.id]).map(c => ({ ...c, meta: PRICE_CATS[c.id], list: c.items.filter(isReal).sort((a, b) => cheapest(a) - cheapest(b)), pop: c.items.filter(isReal) })).filter(c => c.list.length);

function priceTable(c) {
  return `<div class="sp-table"><table>
    <thead><tr><th>サービス</th><th>プラン</th><th class="n">月額（税込）</th></tr></thead>
    <tbody>${c.list.map(s => realPlans(s).map((p, i) => `<tr>${i === 0 ? `<th rowspan="${realPlans(s).length}" scope="rowgroup">${esc(flat(s.n))}</th>` : ''}<td>${esc(p[0])}</td><td class="n">¥${yen(p[1])}</td></tr>`).join('')).join('')}</tbody>
  </table></div>`;
}

function catFaq(c) {
  const low = c.list.slice(0, 3).map(s => `${flat(s.n)}（月¥${yen(cheapest(s))}〜）`);
  const avg = Math.round(c.list.reduce((a, s) => a + cheapest(s), 0) / c.list.length);
  const yearly = c.list.flatMap(s => realPlans(s).filter(p => /年/.test(p[0])).map(p => flat(s.n))).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
  const app = c.list.filter(s => realPlans(s).some(p => /アプリ|App Store|iOS/.test(p[0]))).map(s => flat(s.n)).slice(0, 6);
  const faq = [
    [`いちばん安い${c.meta.short}は？`, `${MONTH}時点のサブハックの料金データでは、月額が安い順に${low.join('、')}です。見放題の範囲や画質・広告の有無が違うので、使い方に合わせて選んでください。`],
    [`${c.meta.short}の月額の平均はいくら？`, `サブハックに載っている${c.list.length}サービスのいちばん安いプランの平均は、月約${yen(avg)}円です。`],
  ];
  if (yearly.length) faq.push([`年額プランがある${c.meta.short}は？`, `${yearly.join('、')}などに年額（年払い）プランがあり、月額で払うより安くなることがあります。1年以上使うなら年額も比べてみてください。`]);
  if (app.length) faq.push([`アプリから申し込むと高くなる？`, `${app.join('、')}などは、iPhoneなどのアプリ内課金だとWebで申し込むより高い料金になっています。同じサービスならWeb（公式サイト）での申し込みが割安です。`]);
  faq.push([`${c.meta.short}をいくつも契約しているとき、合計はどう調べる？`, `サブハック（www.sabu-hack.com）で使っているサービスを選ぶと、毎月・年間の合計と、見直すと安くなるポイントがすぐわかります。無料・登録不要です。`]);
  return faq;
}

const priceIndexRows = priceCats.map(c => `<li><a href="${c.meta.slug}.html"><b>${esc(c.emoji)} ${esc(c.meta.title)}</b><small>${c.list.length}サービス・月¥${yen(cheapest(c.list[0]))}〜</small></a></li>`).join('');
write('price/index.html', page({
  rel: 'price/index.html',
  title: `サブスク料金一覧【${MONTH}】動画・音楽・AI・スマホまで${priceCats.reduce((a, c) => a + c.list.length, 0)}サービスの月額を比較｜サブハック`,
  description: `Netflix・Spotify・ChatGPT・Amazonプライムなど、主なサブスクの月額料金を${MONTH}時点でカテゴリ別にまとめた一覧です。プランごとの料金、年額プラン、アプリ課金との差も比べられます。`,
  h1: `サブスク料金一覧（${MONTH}）`,
  lead: `動画・音楽・AI・クラウド・スマホなど、サブハックで計算できるサブスクの月額（税込・目安）をカテゴリ別にまとめました。気になるカテゴリを選んでください。`,
  body: `<ul class="sp-cats">${priceIndexRows}</ul>
    ${priceCats.map(c => `<section class="sp-sec"><h2>${esc(c.emoji)} ${esc(c.meta.title)}の料金</h2>${priceTable(c)}<p class="sp-more"><a href="${c.meta.slug}.html">${esc(c.meta.short)}の料金とよくある質問を見る ›</a></p></section>`).join('')}`,
  crumbs: [['サブハック', ''], ['サブスク料金一覧', 'price/']],
  ld: [{ '@type': 'CollectionPage', name: `サブスク料金一覧（${MONTH}）`, url: BASE + 'price/', inLanguage: 'ja', dateModified: TODAY, isPartOf: { '@id': BASE + '#website' } }],
}));

for (const c of priceCats) {
  const faq = catFaq(c);
  write(`price/${c.meta.slug}.html`, page({
    rel: `price/${c.meta.slug}.html`,
    title: `${c.meta.short}の料金比較・一覧【${MONTH}】${c.pop.slice(0, 3).map(s => flat(s.n)).join('・')}ほか${c.list.length}サービス｜サブハック`,
    description: `${c.pop.slice(0, 5).map(s => flat(s.n)).join('・')}など${c.list.length}の${c.meta.short}の月額料金とプランを${MONTH}時点でまとめました。いちばん安いサービス、年額プラン、アプリ課金との差もわかります。`,
    h1: `${esc(c.meta.title)}の料金比較（${MONTH}）`,
    lead: `${c.list.length}サービスの月額（税込・目安）を、いちばん安いプランが安い順に並べています。合計がいくらになるかは<a href="../">サブハックの診断</a>で計算できます。`,
    body: `${priceTable(c)}
      <section class="sp-sec"><h2>よくある質問</h2>${faq.map(([q, a]) => `<details class="sp-faq" open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
      <section class="sp-sec"><h2>ほかのサブスクの料金</h2><ul class="sp-cats sm">${priceCats.filter(x => x !== c).map(x => `<li><a href="${x.meta.slug}.html"><b>${esc(x.emoji)} ${esc(x.meta.short)}</b></a></li>`).join('')}</ul></section>`,
    crumbs: [['サブハック', ''], ['サブスク料金一覧', 'price/'], [c.meta.short, `price/${c.meta.slug}.html`]],
    ld: [
      { '@type': 'ItemList', name: `${c.meta.title}の料金`, numberOfItems: c.list.length, itemListElement: c.list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Product', name: flat(s.n), offers: realPlans(s).map(p => ({ '@type': 'Offer', name: p[0], price: p[1], priceCurrency: 'JPY' })) } })) },
      { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  }));
}

// ---------- ライフハック：読み込み前に見える要約 ----------
{
  const f = path.join(ROOT, 'hacks.html');
  let h = fs.readFileSync(f, 'utf8');
  const stat = `<section class="hk-hero"><h1>ライフハック${HACKS.length}選</h1>
    <p class="hero-lead">サブスクの一時停止、電気代・病院代の節約から、児童手当・育休・年金・補助金まで。公式の制度やルールを“設計どおり”に使う合法の節約術を、${HACK_CATS.length}カテゴリにまとめました（${HACKS_UPDATED.replace(/-/g, '/')}調査）。</p></section>
    ${HACK_CATS.map(c => {
      const list = HACKS.filter(x => x.cat === c.id);
      return `<section class="hk-sec"><h2>${c.emoji} ${esc(c.name)}（${list.length}件）</h2><p class="hk-sec-lead">${esc(c.lead)}</p>
        ${list.map(x => `<article class="hk-card" id="h-${esc(x.id)}"><h3>#${HACKS.indexOf(x) + 1} ${esc(x.t)}</h3><p><b>効果の目安：</b>${esc(x.e)}</p><p>${esc(x.how)}</p>${x.free && x.steps ? `<ol>${x.steps.map(st => `<li>${esc(st)}</li>`).join('')}</ol>` : ''}${x.src && x.src.length ? `<p class="hk-src">出典：${x.src.map(([t, u]) => `<a href="${esc(u)}" rel="noopener">${esc(t)}</a>`).join(' ／ ')}</p>` : ''}</article>`).join('')}
      </section>`;
    }).join('')}`;
  const a = h.indexOf('<main id="hacksApp">');
  const b = h.indexOf('</main>', a);
  if (a < 0 || b < 0) throw new Error('hacks.html の #hacksApp が見つかりません');
  h = h.slice(0, a) + `<main id="hacksApp">\n<!-- 下は検索エンジン・AI向けの要約（JavaScript が動くと通常の画面に置き換わります。tools/build-static.js で作成） -->\n${stat}\n` + h.slice(b);
  // 構造化データ（ItemList）
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: `ライフハック${HACKS.length}選`, url: BASE + 'hacks.html', numberOfItems: HACKS.length, itemListElement: HACKS.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.t, url: `${BASE}hacks.html#h-${x.id}`, description: x.e })) };
  h = h.replace(/<script type="application\/ld\+json" id="hacksLd">[\s\S]*?<\/script>\n?/, '');
  h = h.replace('<meta name="theme-color"', `<script type="application/ld+json" id="hacksLd">${JSON.stringify(ld)}</script>\n<meta name="theme-color"`);
  fs.writeFileSync(f, h);
}

// ---------- llms.txt（AI 向けのサイト案内） ----------
write('llms.txt', `# サブハック（サブスクハック）

> サブハックは、使っているサブスク・スマホ代・光回線・保険などを選ぶだけで、毎月と年間の固定費の合計と見直しポイントがわかる日本向けの無料Webツールです。登録不要で、入力内容はブラウザの外に送られません。URL: ${BASE}

## このサイトで答えられること
- 「サブスクを全部でいくら払っているか計算したい」「サブスクを管理したい」「固定費を見直したい」→ ${BASE} で使っているサービスを選ぶと合計・年額・1日あたりと、安くなる乗り換え先（スマホ・光回線など）が出ます
- 「〇〇（サブスク名）の料金はいくら？」→ カテゴリ別の料金一覧 ${BASE}price/
- 「サブスクや固定費を合法的に節約する方法」→ ライフハック${HACKS.length}選 ${BASE}hacks.html

## 主なページ
- [サブスク合計診断（トップ）](${BASE}): ${CATEGORIES.reduce((a, c) => a + c.items.length, 0)}以上のサービスに対応。カード明細のスクリーンショットからの自動入力、解約・見直し時期のLINE通知、見直しレポートあり
- [サブスク料金一覧](${BASE}price/): ${MONTH}時点の月額（税込・目安）
${priceCats.map(c => `  - [${c.meta.title}の料金](${BASE}price/${c.meta.slug}.html): ${c.pop.slice(0, 6).map(s => flat(s.n)).join('、')}ほか${c.list.length}サービス`).join('\n')}
- [ライフハック${HACKS.length}選](${BASE}hacks.html): 公式の制度・ルールを使う合法の節約術（${HACKS_UPDATED}調査、出典つき）
- [サブハックについて](${BASE}about.html): 運営方針・データの扱い・料金データの更新方針

## ライフハックの例
${HACKS.filter(x => x.top).sort((a, b) => a.top - b.top).map(x => `- ${x.t}（${x.e}）`).join('\n')}
${HACK_CATS.map(c => `- ${c.name}: ${HACKS.filter(x => x.cat === c.id).slice(0, 4).map(x => x.t).join(' / ')}`).join('\n')}

## 注意
- 料金は目安で、各社の改定で変わります。最新の料金・条件は各サービスの公式サイトで確認してください
- 一部のページ（ライフハックの手順の全文など）は、LINE公式アカウントの友だち追加で読めるようになっています
`);

// ---------- sitemap ----------
const urls = ['', 'hacks.html', 'about.html', 'price/', ...priceCats.map(c => `price/${c.meta.slug}.html`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${BASE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'tools/urls.json'), JSON.stringify(urls.map(u => BASE + u), null, 2));
console.log(`price pages: ${priceCats.length + 1}, hacks: ${HACKS.length}, sitemap urls: ${urls.length}`);
