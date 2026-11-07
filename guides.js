/*
 * お悩み別ガイド（固定費レポートの中に出るブログ風の記事）
 * 文章・リンクは管理画面（settings.json の GUIDES）で編集できます。ここは初期値です。
 *
 * body の書き方：空行で段落を分ける／「## 」で始まる行は見出し／「- 」で始まる行は箇条書き
 * links：記事の最後に出す申込ボタン。url が空のものは表示されません
 * when：表示条件（GUIDE_RULES のキー）。条件に合う人には「あなたにおすすめ」として上に出ます
 */
const GUIDE_RULES = {
  always: { label: '全員に表示', when: () => true },
  hoken: { label: '保険を登録している', when: s => s.cat('hoken') > 0 },
  carins: { label: '自動車保険を登録している', when: s => s.has('carins') },
  debt: { label: 'リボ払い・カードローン・後払いを登録している', when: s => s.has('revo') || s.has('cardloan') || s.has('atobarai') },
  high: { label: '毎月の合計が20万円以上', when: s => s.total >= 200000 },
  scholarship: { label: '奨学金を登録している', when: s => s.has('scholarship') },
};

const GUIDES = [
  {
    id: 'sidejob', emoji: '💼', enabled: true, when: 'always',
    title: '副業をはじめたい',
    lead: '固定費を見直したら、次は収入を増やす番。スキマ時間から始められる副業の選び方です。',
    body: `固定費を月5,000円減らすのと、副業で月5,000円稼ぐのは、家計にとって同じ効果があります。まずは小さく始めて、続けられるものを見つけましょう。

## 始めやすい副業
- 在宅でできる仕事を受ける（ライティング・データ入力・デザインなど）
- 自分のスキルを出品する（イラスト・相談・翻訳など）
- 使わないものを売る（フリマアプリ）
- ポイ活で日々の出費を取り戻す

## 始める前に確認すること
- 会社の就業規則で副業が認められているか
- 副業の所得が年20万円を超えたら確定申告が必要
- 「誰でも簡単に稼げる」「最初に高額な教材が必要」といった勧誘は避ける`,
    links: [
      { name: 'クラウドソーシングに登録する', desc: '在宅の仕事を探せる', url: '' },
      { name: 'スキルを出品する', desc: '得意なことを売れる', url: '' },
    ],
    line: true,
  },
  {
    id: 'debt', emoji: '🤝', enabled: true, when: 'debt',
    title: '借金・返済がつらい',
    lead: 'リボ払いやカードローンの返済が苦しいとき、新しく借りる前に知っておきたい相談先です。',
    body: `返済のために別のところから借りると、利息が重なって状況が悪くなりがちです。まずは専門家に相談して、返済額を減らせないか確認しましょう。

## 相談できるところ
- 弁護士・司法書士の無料相談（債務整理で毎月の返済額を減らせることがあります）
- 法テラス（収入が一定以下なら、無料の法律相談や費用の立替えを利用できます）
- お住まいの市区町村の生活相談窓口

## 気をつけること
- 「審査なし」「ブラックでもOK」とうたう業者は、違法な闇金の可能性があります。絶対に利用しないでください
- リボ払いは残高が減りにくい仕組みです。まず残高と金利を確認しましょう`,
    links: [
      { name: '借金の無料相談（弁護士・司法書士）', desc: '毎月の返済額を減らせるか相談', url: '' },
      { name: '法テラス（公式）', desc: '国が設立した法律相談の窓口', url: 'https://www.houterasu.or.jp/' },
    ],
    line: true,
  },
  {
    id: 'carins', emoji: '🚗', enabled: true, when: 'carins',
    title: '自動車保険を見直したい',
    lead: '同じ補償でも保険会社によって保険料は大きく変わります。更新前の比較が節約のコツです。',
    body: `自動車保険は毎年の更新時に、ほかの会社と比べるだけで保険料が下がることがあります。

## 見直しのポイント
- 更新日の1〜2か月前から比較を始める
- 運転する人の範囲（本人限定・夫婦限定など）と年齢条件を合わせる
- 車両保険が本当に必要か、免責金額を設定できないか確認する
- 一括見積もりを使うと、複数社の保険料をまとめて比べられる

## 気をつけること
- 等級は乗り換えても引き継げます。ただし、補償内容が今と同じか必ず確認しましょう`,
    links: [
      { name: '自動車保険の一括見積もり', desc: '複数社の保険料をまとめて比較', url: '' },
    ],
    line: true,
  },
  {
    id: 'hoken', emoji: '🛡️', enabled: true, when: 'hoken',
    title: '保険を見直したい',
    lead: '保障が重なっていたり、今の暮らしに合っていなかったり。保険は見直すだけで固定費が下がりやすい項目です。',
    body: `結婚・出産・住宅購入・子どもの独立など、暮らしが変わると必要な保障も変わります。何年も同じ保険のままなら、一度見直してみましょう。

## 見直しのポイント
- 同じような保障に、いくつも入っていないか
- 会社の保障や公的保障（高額療養費制度など）で足りる部分はないか
- 貯蓄型の保険は、途中でやめると損になることがあるので慎重に

## 無料相談の使い方
- ファイナンシャルプランナー（FP）に、今の保険証券を見せて相談できる
- 相談したからといって、契約する必要はありません`,
    links: [
      { name: '保険の無料相談（FP）', desc: '今の保険をプロにチェックしてもらう', url: '' },
    ],
    line: true,
  },
  {
    id: 'job', emoji: '📈', enabled: true, when: 'always',
    title: '転職・就職を相談したい',
    lead: '固定費の見直しには限りがあります。収入そのものを上げるなら、転職も選択肢のひとつです。',
    body: `今の仕事を続けながら、自分の市場価値を知っておくだけでも将来の選択肢が広がります。

## 転職エージェントの使い方
- 登録・相談は無料（費用は採用する企業が払う仕組み）
- 求人の紹介だけでなく、職務経歴書の添削や面接対策もしてもらえる
- 在職中に始めて、条件が合う求人があったときだけ動けばOK

## 就職・第二新卒の場合
- 20代向け・既卒向けのエージェントもあります
- 奨学金の返済がある場合は、手取り額で比べるのがおすすめです`,
    links: [
      { name: '転職エージェントに無料相談', desc: '求人紹介・書類添削・面接対策', url: '' },
      { name: '20代・第二新卒向けの就職相談', desc: '未経験からの就職もサポート', url: '' },
    ],
    line: true,
  },
];

// ---------- 表示 ----------
// 本文（簡単な書式）を HTML にする
function guideBodyHTML(text, esc) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`); list = []; } };
  String(text || '').split(/\n/).forEach(raw => {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush();
    if (!line) return;
    if (line.startsWith('## ')) out.push(`<h4>${esc(line.slice(3))}</h4>`);
    else out.push(`<p>${esc(line)}</p>`);
  });
  flush();
  return out.join('');
}

function guideList(st) {
  return GUIDES.filter(g => g.enabled !== false)
    .map(g => ({ g, pick: (() => { try { return g.when !== 'always' && GUIDE_RULES[g.when]?.when(st); } catch { return false; } })() }))
    .sort((a, b) => b.pick - a.pick);
}
// LINEの欄に入れる：悩みのチップ
function guideTopicsHTML({ st, esc }) {
  const list = guideList(st);
  return list.length ? `<ul class="guide-topics">${list.map(({ g, pick }) => `<li class="${pick ? 'pick' : ''}"><span>${esc(g.emoji || '📄')}</span>${esc(g.title)}${pick ? '<em>あなたにおすすめ</em>' : ''}</li>`).join('')}</ul>` : '';
}
// LINEの欄に入れる：記事をサイトで読む（折りたたみ）
function guideCardsHTML({ st, esc }) {
  const list = guideList(st);
  return list.length ? `<details class="guide-more">
      <summary>悩みの記事をサイトで読む</summary>
      <div class="guide-cards">
        ${list.map(({ g, pick }) => `<button class="guide-card${pick ? ' pick' : ''}" data-guide="${esc(g.id)}" type="button">
          <span class="guide-emoji">${esc(g.emoji || '📄')}</span>
          <span class="guide-tx">${pick ? '<span class="guide-badge">あなたにおすすめ</span>' : ''}<b>${esc(g.title)}</b><small>${esc(g.lead || '')}</small></span>
          <span class="guide-go">読む ›</span>
        </button>`).join('')}
      </div>
    </details>` : '';
}

function buildGuides({ st, esc }) {
  // 有料会員を出していない間は、LINEの欄（member.js）にまとめて出す
  if (MEMBERSHIP.enabled !== true) return '';
  const list = guideList(st);
  if (!list.length) return '';
  // 記事はLINEで配信するので、サイトでは「LINE登録で解決できる悩み」として見せ、記事本体は折りたたむ
  return `<div class="panel guides">
      <h3>LINEに登録すると、こんな悩みを解決できます</h3>
      <p class="guides-lead">見直しのコツや申込先を、LINEでお届けします。</p>
      <ul class="guide-topics">
        ${list.map(({ g, pick }) => `<li class="${pick ? 'pick' : ''}"><span>${esc(g.emoji || '📄')}</span>${esc(g.title)}${pick ? '<em>あなたにおすすめ</em>' : ''}</li>`).join('')}
      </ul>
      <button class="btn line big" type="button" data-guide-add>LINEで友だち追加（無料）</button>
      <details class="guide-more">
        <summary>サイトで記事を読む</summary>
        <div class="guide-cards">
          ${list.map(({ g, pick }) => `<button class="guide-card${pick ? ' pick' : ''}" data-guide="${esc(g.id)}" type="button">
            <span class="guide-emoji">${esc(g.emoji || '📄')}</span>
            <span class="guide-tx">${pick ? '<span class="guide-badge">あなたにおすすめ</span>' : ''}<b>${esc(g.title)}</b><small>${esc(g.lead || '')}</small></span>
            <span class="guide-go">読む ›</span>
          </button>`).join('')}
        </div>
      </details>
    </div>`;
}

function bindGuides(root, { openSheet, esc, yen }) {
  // 友だち追加はLINE登録の欄のボタンと同じ動き（URL未設定なら「準備中」）
  root.querySelector('[data-guide-add]')?.addEventListener('click', () => root.querySelector('#mbAdd')?.click());
  root.querySelectorAll('[data-guide]').forEach(card => card.onclick = () => {
    const g = GUIDES.find(x => x.id === card.dataset.guide);
    if (!g) return;
    const links = (g.links || []).filter(l => l.url);
    const isAff = l => !/houterasu\.or\.jp|\.go\.jp|\.lg\.jp/.test(l.url);  // 公的機関へのリンクは広告ではない
    openSheet(`<article class="guide-article">
        <p class="guide-cat">お悩み別ガイド</p>
        <h3><span>${esc(g.emoji || '📄')}</span>${esc(g.title)}</h3>
        <p class="guide-intro">${esc(g.lead || '')}</p>
        <div class="guide-body">${guideBodyHTML(g.body, esc)}</div>
        ${links.length ? `<div class="guide-links"><p class="guide-links-h">ここから申し込めます${links.some(isAff) ? '<span class="pr-mini">※PRを含みます</span>' : ''}</p>
          ${links.map(l => `<a class="guide-link" href="${esc(l.url)}" target="_blank" rel="${isAff(l) ? 'sponsored ' : ''}noopener">
            <span><b>${esc(l.name)}</b><small>${esc(l.desc || '')}</small></span>${isAff(l) ? '' : '<em>公式</em>'}</a>`).join('')}</div>` : ''}
        ${g.line !== false ? (MEMBERSHIP.enabled === true ? `<div class="guide-line">
          <p><b>ひとりで決めるのが不安なら</b>　LINEでいつでも何度でも相談できます（${esc(MEMBERSHIP.name)}・月額¥${yen(MEMBERSHIP.price)}）</p>
          <button class="btn line" type="button" data-guide-line>LINEで相談する（月額¥${yen(MEMBERSHIP.price)}）</button>
        </div>` : `<div class="guide-line">
          <p><b>ひとりで決めるのが不安なら</b>　サブハック公式LINEで気軽に相談できます（無料）</p>
          <button class="btn line" type="button" data-guide-line>公式LINEを友だち追加して相談する</button>
        </div>`) : ''}
      </article>`);
    // 有料会員の申し込みボタンと同じ動きにする
    document.querySelector('[data-guide-line]')?.addEventListener('click', () => (MEMBERSHIP.enabled === true ? root.querySelector('#mbJoin') : root.querySelector('#mbAdd'))?.click());
  });
}
