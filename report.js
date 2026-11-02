/*
 * 見直しレポート（合計カード画面の最後）
 * 選んだスマホ・光回線・電気・クレジットカード関連の項目を REPORT（report-config.js）の候補と比べます。
 */
function buildReport({ items, SVC, icoHTML, iconOf, yen, esc }) {
  const has = sid => items.some(i => i.sid === sid);
  const paid = cat => items.filter(i => i.cat === cat && i.price > 0);
  const sumOf = list => list.reduce((a, b) => a + b.price, 0);
  const setMatch = o => (o.set || []).filter(has);
  const icoFor = o => o.sid
    ? icoHTML(iconOf({ sid: o.sid }))
    : icoHTML({ c: o.c || '#64748B', t: o.t || o.name.slice(0, 1), img: o.d ? iconUrl(o.d) : '' });
  const btn = (url, label = 'ここから申し込む') => url
    ? `<a class="btn pr rp-btn" href="${esc(url)}" target="_blank" rel="sponsored noopener">${esc(label)}<small>PR</small></a>` : '';
  const goto = (cat, label) => `<button class="btn ghost rp-goto" data-goto="${cat}" type="button">${esc(label)}</button>`;
  const svcName = sid => (SVC[sid]?.n || '').replace(/\n/g, '');

  const sections = [];
  let yearly = 0;   // 年間の節約見込み（円）
  let points = 0;   // 年間のポイント見込み（円相当）

  // ---------- スマホ ----------
  {
    const lines = paid('mobile');
    let body;
    if (!lines.length) {
      body = `<p class="rp-text">スマホ代を入れると、今より安いプランを探せます。</p>${goto('mobile', 'スマホ代を入れて比較する')}`;
    } else {
      const cur = sumOf(lines), per = Math.round(cur / lines.length);
      const mine = new Set(lines.map(l => l.sid));
      // データ量で「少なめ・ふつう・たっぷり」に分け、それぞれ一番お得なものを1つずつ出す
      const gbNum = gb => /無制限/.test(gb) ? 999 : Number((gb.match(/\d+/) || [0])[0]);
      const tierOf = o => gbNum(o.gb) <= 5 ? 0 : gbNum(o.gb) <= 30 ? 1 : 2;
      const TIER = ['データ少なめの人向け', 'データふつうの人向け', 'データたっぷりの人向け'];
      const opts = [0, 1, 2].map(t => REPORT.mobile
        .filter(o => tierOf(o) === t && o.price < per && !mine.has(o.sid))
        .map(o => ({ ...o, tier: TIER[t], save: (per - o.price) * lines.length, match: setMatch(o) }))
        .sort((a, b) => b.match.length - a.match.length || a.price - b.price)[0])
        .filter(Boolean);
      if (opts.length) yearly += Math.max(...opts.map(o => o.save)) * 12;
      body = `<p class="rp-now">いま <b>¥${yen(cur)}</b>/月${lines.length > 1 ? `（${lines.length}回線・1回線あたり¥${yen(per)}）` : ''}</p>` +
        (opts.length
          ? opts.map(o => `<div class="rp-opt">
              ${icoFor(o)}
              <div class="rp-main"><span class="rp-tier">${esc(o.tier)}</span><b>${esc(svcName(o.sid))}</b><small>${esc(o.plan)}・データ${esc(o.gb)}</small>
                ${o.match.length ? `<span class="rp-tag">${esc(o.match.map(svcName).join('・'))}とセットで相性◎</span>` : ''}</div>
              <div class="rp-price">¥${yen(o.price)}<small>/月</small><em>月¥${yen(o.save)}安い</em></div>
            </div>${btn(o.url, `${svcName(o.sid)}に申し込む`)}`).join('') +
            `<p class="rp-note">※毎月使うデータ量に合うものを選んでください。乗り換えで年間 <b>最大¥${yen(Math.max(...opts.map(o => o.save)) * 12)}</b> 安くなる見込みです。</p>`
          : `<p class="rp-text">今のスマホ代はすでに安い水準です。このままで大丈夫そうです。</p>`);
    }
    sections.push({ key: 'mobile', title: 'スマホ', emoji: '📱', body });
  }

  // ---------- 光回線 ----------
  {
    const lines = paid('net');
    let body;
    const carriers = items.filter(i => i.cat === 'mobile').map(i => i.sid);
    if (!lines.length) {
      body = `<p class="rp-text">ネット回線を入れると、今お得な回線と比べられます。</p>${goto('net', 'ネット回線を入れて比較する')}`;
    } else {
      const cur = sumOf(lines);
      const mine = new Set(lines.map(l => l.sid));
      const opts = REPORT.net
        .filter(o => !mine.has(o.sid))
        .map(o => {
          const real = Math.round(o.price - (o.cashback || 0) / (o.months || 24));
          return { ...o, real, save: cur - real, match: (o.set || []).filter(s => carriers.includes(s)) };
        })
        .filter(o => o.save > 0 || o.match.length)
        .sort((a, b) => b.match.length - a.match.length || b.save - a.save)
        .slice(0, 3);
      const best = Math.max(0, ...opts.map(o => o.save));
      yearly += best * 12;
      body = `<p class="rp-now">いま <b>¥${yen(cur)}</b>/月</p>` +
        (opts.length
          ? opts.map(o => `<div class="rp-opt">
              ${icoFor(o)}
              <div class="rp-main"><b>${esc(o.name)}</b><small>${esc(o.type)}${o.cashback ? `・キャッシュバック¥${yen(o.cashback)}` : ''}</small>
                ${o.match.length ? `<span class="rp-tag">${esc(o.match.map(svcName).join('・'))}とのセット割の対象</span>` : ''}</div>
              <div class="rp-price">¥${yen(o.real)}<small>/月${o.cashback ? '（実質）' : ''}</small>${o.save > 0 ? `<em>月¥${yen(o.save)}安い</em>` : ''}</div>
            </div>${btn(o.url, `${o.name}を見る`)}`).join('') +
            (best ? `<p class="rp-note">※実質月額＝月額−キャッシュバック÷${REPORT.net[0]?.months || 24}か月。今なら年間 <b>最大¥${yen(best * 12)}</b> お得になる見込みです。</p>` : '')
          : `<p class="rp-text">今の回線は十分お得な水準です。</p>`);
    }
    sections.push({ key: 'net', title: '光回線・ネット', emoji: '🌐', body });
  }

  // ---------- 電気 ----------
  {
    const cur = sumOf(items.filter(i => i.sid === 'electric'));
    const carriers = items.map(i => i.sid);
    let body;
    if (!cur) {
      body = `<p class="rp-text">電気代を入れると、安くなる電力会社を探せます。</p>${goto('fixed', '電気代を入れて比較する')}`;
    } else {
      const opts = REPORT.electric
        .map(o => ({ ...o, save: Math.round(cur * (o.rate || 0)), match: (o.set || []).filter(s => carriers.includes(s)) }))
        .sort((a, b) => b.match.length - a.match.length || b.save - a.save)
        .slice(0, 3);
      const best = Math.max(0, ...opts.map(o => o.save));
      yearly += best * 12;
      body = `<p class="rp-now">いま <b>¥${yen(cur)}</b>/月（年¥${yen(cur * 12)}）</p>` +
        opts.map(o => `<div class="rp-opt">
            ${icoFor(o)}
            <div class="rp-main"><b>${esc(o.name)}</b><small>${esc(o.point || '')}</small>
              ${o.match.length ? `<span class="rp-tag">${esc(o.match.map(svcName).join('・'))}を使っているならポイントがまとまる</span>` : ''}</div>
            <div class="rp-price">${o.save > 0 ? `<em>月¥${yen(o.save)}安い見込み</em>` : '<small>料金は試算で確認</small>'}</div>
          </div>${btn(o.url, `${o.name}で料金を試算する`)}`).join('') +
        `<p class="rp-note">※電気代は使用量・地域・季節で変わります。各社のシミュレーションで確認してください。</p>`;
    }
    sections.push({ key: 'electric', title: '電気代', emoji: '⚡', body });
  }

  // ---------- クレジットカード ----------
  {
    // カードで払えない・払わないことが多い固定費は除く
    const NOT_CARD = new Set(['rent', 'mortgage', 'scholarship', 'loan', 'invest', 'allowance', 'daycare', 'kanri']);
    const monthly = sumOf(items.filter(i => !NOT_CARD.has(i.sid)));
    const fee = sumOf(items.filter(i => i.sid === 'annualfee'));
    const cards = REPORT.cards
      .map(c => ({ ...c, match: (c.set || []).filter(has), pt: Math.round(monthly * 12 * c.rate) }))
      .sort((a, b) => b.match.length - a.match.length || b.rate - a.rate || a.fee - b.fee)
      .slice(0, 2);
    if (cards.length) points = cards[0].pt;
    if (fee) yearly += fee * 12;
    const body = `<p class="rp-now">カードで払える毎月の支払い <b>¥${yen(monthly)}</b>/月（年¥${yen(monthly * 12)}）</p>` +
      (fee ? `<div class="rp-alert">年会費のかかるカードがあります（年¥${yen(fee * 12)}）。年会費無料のカードにまとめると、その分がまるごと浮きます。</div>` : '') +
      cards.map((c, idx) => `<div class="rp-opt">
          ${icoFor(c)}
          <div class="rp-main"><b>${idx === 0 ? '<span class="rp-best">おすすめ</span>' : ''}${esc(c.name)}</b>
            <small>年会費${c.fee ? '¥' + yen(c.fee) : '無料'}・還元率${(c.rate * 100).toFixed(1)}%・${esc(c.point)}${c.note ? '・' + esc(c.note) : ''}</small>
            ${c.match.length ? `<span class="rp-tag">${esc(c.setLabel || c.match.map(svcName).join('・'))}を使っているなら相性◎</span>` : ''}</div>
          <div class="rp-price"><em>年¥${yen(c.pt)}分</em><small>のポイント</small></div>
        </div>${btn(c.url, `${c.name}を申し込む`)}`).join('') +
      `<p class="rp-note">※サブスク・固定費をこのカードで払った場合の基本還元の目安です。キャンペーンや利用先によって変わります。</p>`;
    sections.push({ key: 'card', title: 'クレジットカード', emoji: '💳', body });
  }

  const hasAff = [REPORT.mobile, REPORT.net, REPORT.electric, REPORT.cards].some(l => l.some(o => o.url));
  return `
    <div class="panel rp">
      <h3>あなたの見直しレポート</h3>
      <div class="rp-sum">
        <div><small>見直しで浮くかも</small><b>年 ¥${yen(yearly)}</b></div>
        <div><small>カード払いでポイント</small><b>年 ¥${yen(points)}分</b></div>
      </div>
      ${sections.map(s => `<section class="rp-sec">
        <h4><span>${s.emoji}</span>${esc(s.title)}</h4>${s.body}</section>`).join('')}
      ${hasAff ? '<p class="pr-note">※このレポートは広告（アフィリエイト）を含みます。料金・特典は目安です。最新の条件は各社の公式サイトでご確認ください。</p>'
        : '<p class="pr-note">※料金・特典は目安です。最新の条件は各社の公式サイトでご確認ください。</p>'}
    </div>`;
}
