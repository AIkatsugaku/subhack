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
  // 申込リンク（アフィリエイト）が入っている候補を優先して出す
  const linked = o => (o.url ? 1 : 0);
  // まだ金額を入れていない人にも、リンクのある候補だけは見せる
  const linkedList = (list, label) => {
    const l = list.filter(o => o.url);
    if (!l.length) return '';
    return `<p class="rp-sub">${esc(label)}</p>` + l.map(o => `<div class="rp-opt">${icoFor(o)}
        <div class="rp-main"><b>${esc(o.name || svcName(o.sid))}</b><small>${esc(o.plan || o.point || o.type || '')}</small></div>
        ${o.price ? `<div class="rp-price">¥${yen(o.price)}<small>/月</small></div>` : ''}
      </div>${btn(o.url, `${o.name || svcName(o.sid)}を見る`)}`).join('');
  };

  const sections = [];
  let yearly = 0;   // 年間の節約見込み（円）
  let points = 0;   // 年間のポイント見込み（円相当）

  // ---------- スマホ ----------
  {
    const lines = paid('mobile');
    let body;
    if (!lines.length) {
      body = `<p class="rp-text">スマホ代を入れると、今より安いプランを探せます。</p>${goto('mobile', 'スマホ代を入れて比較する')}${linkedList(REPORT.mobile, '人気の乗り換え先')}`;
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
        .sort((a, b) => linked(b) - linked(a) || b.match.length - a.match.length || a.price - b.price)[0])
        .filter(Boolean);
      // リンクのある候補が今より安いのに選ばれていなければ追加する（最大4件）
      REPORT.mobile
        .filter(o => o.url && o.price < per && !mine.has(o.sid) && !opts.some(x => x.sid === o.sid && x.plan === o.plan))
        .forEach(o => { if (opts.length < 4) opts.push({ ...o, tier: TIER[tierOf(o)], save: (per - o.price) * lines.length, match: setMatch(o) }); });
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
      body = `<p class="rp-text">ネット回線を入れると、今お得な回線と比べられます。</p>${goto('net', 'ネット回線を入れて比較する')}${linkedList(REPORT.net, '人気の光回線')}`;
    } else {
      const cur = sumOf(lines);
      const mine = new Set(lines.map(l => l.sid));
      const opts = REPORT.net
        .filter(o => !mine.has(o.sid))
        .map(o => {
          const real = Math.round(o.price - (o.cashback || 0) / (o.months || 24));
          return { ...o, real, save: cur - real, match: (o.set || []).filter(s => carriers.includes(s)) };
        })
        .filter(o => o.save > 0 || o.match.length || o.url)
        .sort((a, b) => linked(b) - linked(a) || b.match.length - a.match.length || b.save - a.save)
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
      body = `<p class="rp-text">電気代を入れると、安くなる電力会社を探せます。</p>${goto('fixed', '電気代を入れて比較する')}${linkedList(REPORT.electric, '人気の電力会社')}`;
    } else {
      const opts = REPORT.electric
        .map(o => ({ ...o, save: Math.round(cur * (o.rate || 0)), match: (o.set || []).filter(s => carriers.includes(s)) }))
        .sort((a, b) => linked(b) - linked(a) || b.match.length - a.match.length || b.save - a.save)
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
    const NOT_CARD = new Set(['rent', 'allowance', 'daycare', 'kanri', 'invest', 'ideco', 'tsumitate']);
    const monthly = sumOf(items.filter(i => !NOT_CARD.has(i.sid) && i.cat !== 'loan'));
    const fee = sumOf(items.filter(i => i.sid === 'annualfee'));
    const cards = REPORT.cards
      .map(c => ({ ...c, match: (c.set || []).filter(has), pt: Math.round(monthly * 12 * c.rate) }))
      .sort((a, b) => linked(b) - linked(a) || b.match.length - a.match.length || b.rate - a.rate || a.fee - b.fee)
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

  // ---------- ふるさと納税 ----------
  {
    const pref = furusatoPref();
    const incomeOpts = FURUSATO_LIMITS.map(([man]) => `<option value="${man}"${pref.inc === man ? ' selected' : ''}>${man === 1000 ? '1,000' : man}万円${man === 1000 ? '以上' : '前後'}</option>`).join('');
    const famOpts = FURUSATO_FAMILY.map((f, k) => `<option value="${k}"${pref.fam === k ? ' selected' : ''}>${esc(f)}</option>`).join('');
    const food = items.filter(i => ['rice', 'coop', 'oisix'].includes(i.sid));
    const body = `<p class="rp-text">実質<b>2,000円</b>の負担で、お米や日用品などの返礼品がもらえる制度です。上限の目安を出してみましょう。</p>
      <div class="fs-form">
        <label><span>年収（額面）</span><select id="fsInc"><option value="">選んでください</option>${incomeOpts}</select></label>
        <label><span>家族構成</span><select id="fsFam">${famOpts}</select></label>
      </div>
      <div class="fs-out" id="fsOut"></div>
      ${food.length ? `<div class="rp-alert">🍚 ${esc(food.map(i => (SVC[i.sid]?.n || i.name || '').replace(/\n/g, '')).join('・'))}（月¥${yen(sumOf(food))}）を払っています。お米や食品を返礼品で受け取れば、その分の出費を減らせます。</div>` : ''}
      ${(REPORT.furusato || []).map(o => `<div class="rp-opt">${icoFor(o)}
          <div class="rp-main"><b>${esc(o.name)}</b><small>${esc(o.point || '')}</small></div>
        </div>${btn(o.url, `${o.name}で返礼品を探す`)}`).join('')}
      <p class="rp-note">※上限は総務省の目安表（給与収入のみの場合）にもとづく目安です。住宅ローン控除・医療費控除などがあると変わります。正確な額は各ポータルのシミュレーターで確認してください。</p>`;
    sections.push({ key: 'furusato', title: 'ふるさと納税', emoji: '🎁', body });
  }

  const hasAff = [REPORT.mobile, REPORT.net, REPORT.electric, REPORT.cards, REPORT.furusato || []].some(l => l.some(o => o.url));
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

// ---------- ふるさと納税の上限シミュレーター ----------
const FURUSATO_KEY = 'subhack.furusato';
function furusatoPref() {
  try { return JSON.parse(localStorage.getItem(FURUSATO_KEY)) || { inc: 0, fam: 0 }; } catch { return { inc: 0, fam: 0 }; }
}

function bindReport(root, { items, yen }) {
  const inc = root.querySelector('#fsInc'), fam = root.querySelector('#fsFam'), out = root.querySelector('#fsOut');
  if (!inc) return;
  // 登録済みのふるさと納税（月割り）を年額に戻す
  const donated = items.filter(i => i.sid === 'furusato').reduce((a, b) => a + b.price, 0) * 12;
  const update = () => {
    const man = Number(inc.value), k = Number(fam.value);
    try { localStorage.setItem(FURUSATO_KEY, JSON.stringify({ inc: man, fam: k })); } catch { }
    if (!man) { out.innerHTML = ''; return; }
    const limit = FURUSATO_LIMITS.find(([m]) => m === man)[1][k];
    const rest = Math.max(0, limit - donated);
    out.innerHTML = `<div class="fs-cards">
        <div><small>寄付できる上限の目安</small><b>年 ¥${yen(limit)}</b></div>
        <div><small>返礼品の価値（最大3割）</small><b>約 ¥${yen(limit * 0.3)}</b></div>
      </div>
      ${donated ? `<p class="fs-rest">登録中の寄付：年¥${yen(donated)} → <b>あと ¥${yen(rest)}</b> 寄付できます${rest ? '' : '（上限まで使えています）'}</p>` : ''}
      <p class="fs-rest">自己負担は2,000円。<b>約¥${yen(Math.max(0, limit * 0.3 - 2000))}</b> おトクになる計算です。</p>`;
  };
  inc.onchange = update; fam.onchange = update;
  update();
}
