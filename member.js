/*
 * 会員・相談まわり（合計カード画面の最後）
 * - 解約・見直しの予定日を登録 → カレンダー（.ics）に追加 / LINE公式アカウントに送って通知を受け取る
 * - 有料会員の相談（LINE）
 * - 有料会員の案内
 * 設定は config.js の LINE と MEMBERSHIP。
 */
const REMIND_TYPES = { cancel: '解約したい', review: '見直したい' };

function lineMessageUrl(text) {
  if (!LINE.id) return '';
  return `https://line.me/R/oaMessage/${encodeURIComponent(LINE.id)}/?${encodeURIComponent(text)}`;
}

// 見直しの月の選択肢（今月〜24か月先）。値は YYYY-MM
function reviewMonths() {
  const d = new Date(); d.setDate(1);
  return Array.from({ length: 25 }, (_, k) => {
    const m = new Date(d.getFullYear(), d.getMonth() + k, 1);
    return { v: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: `${m.getFullYear()}年${m.getMonth() + 1}月` };
  });
}
// 表示用：見直しは「2026年12月」、解約は「2026/12/15」
function remindLabel(r) {
  if (r.type === 'review' && /^\d{4}-\d{2}/.test(r.date || '')) { const [y, m] = r.date.split('-'); return `${y}年${Number(m)}月`; }
  return String(r.date || '').replace(/-/g, '/');
}

function buildMember({ items, SVC, yen, esc, icoHTML, iconOf, st }) {
  const nameOf = i => i.label || i.name || (SVC[i.sid]?.n || '').replace(/\n/g, '');
  const rows = items.map(i => {
    const r = i.remind || {};
    return `<div class="mb-row" data-uid="${i.uid}">
      ${icoHTML(iconOf(i))}
      <div class="mb-name"><b>${esc(nameOf(i))}</b><small>¥${yen(i.price)}/月</small></div>
      <select class="mb-type" aria-label="予定の種類">
        <option value="">通知なし</option>
        ${Object.entries(REMIND_TYPES).map(([k, v]) => `<option value="${k}"${r.type === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
      <input class="mb-date" type="date" value="${esc(r.type === 'cancel' ? (r.date || '') : '')}" aria-label="解約したい日"${r.type === 'cancel' ? '' : ' hidden'}>
      <select class="mb-month" aria-label="見直したい月"${r.type === 'review' ? '' : ' hidden'}>
        ${reviewMonths().map(o => `<option value="${o.v}"${(r.type === 'review' && (r.date || '').startsWith(o.v)) ? ' selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>`;
  }).join('');

  const m = MEMBERSHIP;
  const lineCard = LINE.icon || LINE.qr ? `<div class="line-card">
        ${LINE.icon ? `<img class="line-icon" src="${esc(LINE.icon)}" alt="">` : ''}
        <div class="line-info"><b>${esc(LINE.name || SITE.name + ' 公式LINE')}</b><small>${esc(LINE.id)}</small></div>
        ${LINE.qr ? `<figure class="line-qr"><img src="${esc(LINE.qr)}" alt="友だち追加のQRコード"><figcaption>スマホで読み取り</figcaption></figure>` : ''}
      </div>` : '';
  // 有料会員を出していない間：通知・相談・悩み・ライフハックを1つの欄にまとめ、友だち追加のボタンは1つだけ
  if (m.enabled !== true) {
    const hacksN = typeof HACKS !== 'undefined' ? HACKS.length : 0;
    return `
    <div class="panel mb line-all" id="memberPanel">
      <h3>📱 公式LINEに登録すると、できること</h3>
      <p class="mb-lead">友だち追加（無料）だけで、ぜんぶ使えます。</p>
      <ul class="line-perks">
        <li><span>🔔</span><div><b>解約・見直しの時期をお知らせ</b><small>無料期間が終わる前・更新月にLINEで届きます</small></div></li>
        <li><span>💬</span><div><b>気になることを気軽に相談</b><small>「どれを解約すればいい？」「もっと安くできる？」</small></div></li>
        <li><span>🧩</span><div><b>こんな悩みも解決できます</b>${typeof guideTopicsHTML === 'function' ? guideTopicsHTML({ st, esc }) : ''}</div></li>
        ${hacksN ? `<li><span>🔓</span><div><b>ライフハック${hacksN}選がぜんぶ読める</b><small>友だち追加で届く合言葉を入れるだけ</small></div></li>` : ''}
      </ul>
      ${lineCard}
      <button class="btn line big" id="mbAdd" type="button">LINEで友だち追加（無料）</button>
      <details class="mb-more">
        <summary>🔔 通知してほしい予定を入れる</summary>
        <p class="mb-lead">サービスごとに「解約したい日」か「見直したい月」を選んで、LINEに送ってください。</p>
        <div class="mb-list">${rows}</div>
        <p class="mb-count" id="mbCount"></p>
        <button class="btn line" id="mbLine" type="button">この予定をLINEに送って通知をオンにする</button>
        <button class="link-btn" id="mbCalendar" type="button">LINEを使わず、スマホのカレンダーに入れる</button>
      </details>
      ${typeof guideCardsHTML === 'function' ? guideCardsHTML({ st, esc }) : ''}
      <button class="link-btn" id="mbConsult" type="button">友だち追加済みの方：いまの内容を添えてLINEで相談する</button>
    </div>`;
  }
  return `
    <div class="panel mb" id="memberPanel">
      <h3>🔔 LINE登録で、解約・見直しの時期をお知らせ</h3>
      <p class="mb-lead">無料のLINE登録だけで使えます。「無料期間が終わる前に解約したい」「更新月に見直したい」時期をLINEでお知らせします。</p>
      <ol class="mb-steps">
        <li><b>1</b><span>LINE公式アカウントを友だち追加（無料）</span></li>
        <li><b>2</b><span>下のリストで、通知してほしいサービスで「解約したい日」か「見直したい月」を選ぶ</span></li>
        <li><b>3</b><span>「この予定でLINE通知をオンにする」を押して送信</span></li>
      </ol>
      ${LINE.icon || LINE.qr ? `<div class="line-card">
        ${LINE.icon ? `<img class="line-icon" src="${esc(LINE.icon)}" alt="">` : ''}
        <div class="line-info"><b>${esc(LINE.name || SITE.name + ' 公式LINE')}</b><small>${esc(LINE.id)}</small></div>
        ${LINE.qr ? `<figure class="line-qr"><img src="${esc(LINE.qr)}" alt="友だち追加のQRコード"><figcaption>スマホで読み取り</figcaption></figure>` : ''}
      </div>` : ''}
      <button class="btn line big" id="mbAdd" type="button">LINEで友だち追加（無料）</button>
      <div class="mb-list">${rows}</div>
      <p class="mb-count" id="mbCount"></p>
      <button class="btn line" id="mbLine" type="button">この予定でLINE通知をオンにする</button>
      <button class="link-btn" id="mbCalendar" type="button">LINEを使わず、スマホのカレンダーに入れる</button>
    </div>

    ${m.enabled !== true ? `<div class="panel consult">
      <h3>💬 気になることは、公式LINEで相談</h3>
      <p class="mb-lead">「どれを解約すればいい？」「もっと安くできる？」を、サブハック公式LINEで気軽に聞けます（無料）。</p>
      <button class="btn line big" id="mbFreeAdd" type="button">公式LINEを友だち追加（無料）</button>
      <button class="link-btn" id="mbConsult" type="button">友だち追加済みの方：いまの内容を添えてLINEで相談する</button>
    </div>` : `<div class="panel consult">
      <h3>💬 いつでも、何度でもLINEで相談</h3>
      <p class="mb-lead">「どれを解約すればいい？」「もっと安くできる？」を、気になったときにすぐLINEで聞けます。</p>
      <div class="premium">
        <div class="premium-head"><span class="premium-badge">有料会員</span><b>${esc(m.name)}</b></div>
        <div class="premium-price">月額 <b>¥${yen(m.price)}</b><small>（税込）</small></div>
        <ul>${m.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="btn pr big" id="mbJoin" type="button">月額¥${yen(m.price)}で相談し放題にする</button>
      </div>
      <button class="link-btn" id="mbConsult" type="button">会員の方：いまの内容を添えてLINEで相談する</button>
    </div>`}`;
}

function bindMember(root, { getItems, save, yen, SVC, toast }) {
  const nameOf = i => i.label || i.name || (SVC[i.sid]?.n || '').replace(/\n/g, '');
  const reminders = () => getItems().filter(i => i.remind?.type && i.remind.date)
    .sort((a, b) => a.remind.date.localeCompare(b.remind.date));
  const fmt = r => remindLabel(r);
  const openUrl = url => window.open(url, '_blank', 'noopener');
  const needLine = () => { toast('LINE公式アカウントは準備中です'); };
  // スマホならLINEアプリで直接開く。パソコンでは line.me/R/… が開けないので、QRコードとコピーで案内する
  const isPhone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const sendLine = text => {
    const url = lineMessageUrl(text);
    if (!url) return needLine();
    if (isPhone) return openUrl(url);
    showLineOnPc(url, text);
  };

  const updateCount = () => {
    const n = reminders().length;
    root.querySelector('#mbCount').textContent = n ? `${n}件の予定を登録中` : '予定を選ぶとここに件数が出ます';
  };

  root.querySelectorAll('.mb-row').forEach(row => {
    const it = () => getItems().find(i => i.uid === row.dataset.uid);
    const type = row.querySelector('.mb-type'), date = row.querySelector('.mb-date'), month = row.querySelector('.mb-month');
    const store = () => {
      const i = it(); if (!i) return;
      // 見直しは月の1日として持つ（並べ替え・カレンダー用）
      if (type.value === 'review') i.remind = { type: 'review', date: `${month.value}-01` };
      else if (type.value === 'cancel') i.remind = { type: 'cancel', date: date.value };
      else delete i.remind;
      save(); updateCount();
    };
    type.onchange = () => {
      date.hidden = type.value !== 'cancel';
      month.hidden = type.value !== 'review';
      if (type.value === 'cancel' && !date.value) {
        // 解約の初期値は1か月後（無料期間の目安）
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        date.value = d.toISOString().slice(0, 10);
      }
      if (type.value === 'review' && !row.dataset.monthSet) {
        // 見直しの初期値は来月
        month.selectedIndex = 1; row.dataset.monthSet = '1';
      }
      store();
    };
    date.onchange = store;
    month.onchange = () => { row.dataset.monthSet = '1'; store(); };
  });
  updateCount();

  // カレンダー（.ics）：予定日の前日 9:00 に通知
  root.querySelector('#mbCalendar').onclick = () => {
    const list = reminders();
    if (!list.length) { toast('通知したいサービスの予定（解約の日・見直しの月）を選んでください'); return; }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
    const events = list.map(i => {
      const title = `【${REMIND_TYPES[i.remind.type]}${i.remind.type === 'review' ? `（${fmt(i.remind)}）` : ''}】${nameOf(i)}（¥${yen(i.price)}/月）`;
      return [
        'BEGIN:VEVENT',
        `UID:${i.uid}-${i.remind.date}@subsc`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${i.remind.date.replace(/-/g, '')}`,
        `SUMMARY:${icsEsc(title)}`,
        `DESCRIPTION:${icsEsc(`${SITE.name}で登録した予定です。\n${SITE.url}`)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//subsc-matome//JP', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'subsc-reminders.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('カレンダー用のファイルを作りました');
  };

  // LINE に予定を送る
  root.querySelector('#mbLine').onclick = () => {
    const list = reminders();
    if (!list.length) { toast('通知したいサービスの予定（解約の日・見直しの月）を選んでください'); return; }
    const text = ['【通知の登録】', ...list.map(i => `・${fmt(i.remind)} ${nameOf(i)}（¥${yen(i.price)}/月）を${REMIND_TYPES[i.remind.type]}`), '', 'この時期が近づいたら教えてください。'].join('\n');
    sendLine(text);
  };

  // 見直しレポートの「手順をLINEで受け取る」からも同じ送り方を使う
  window.subhackSendLine = sendLine;

  root.querySelector('#mbAdd').onclick = () => (LINE.addFriendUrl ? openUrl(LINE.addFriendUrl) : needLine());

  // 会員の相談：いまの内容を添えて送る
  root.querySelector('#mbConsult').onclick = () => {
    const list = [...getItems()].sort((a, b) => b.price - a.price);
    const total = list.reduce((a, b) => a + b.price, 0);
    const text = [
      MEMBERSHIP.enabled === true ? '【会員相談】' : '【相談】',
      `いまのサブスク・固定費：${list.length}件 月¥${yen(total)}`,
      ...list.slice(0, 20).map(i => `・${nameOf(i)}　¥${yen(i.price)}`),
      list.length > 20 ? `ほか${list.length - 20}件` : '',
      '',
      '相談したいこと：',
    ].filter(l => l !== '').join('\n');
    sendLine(text);
  };

  // 有料会員
  root.querySelector('#mbFreeAdd')?.addEventListener('click', () => root.querySelector('#mbAdd').click());
  const join = root.querySelector('#mbJoin');
  if (join) join.onclick = () => {
    if (MEMBERSHIP.joinUrl) return openUrl(MEMBERSHIP.joinUrl);
    sendLine(`【有料会員の申し込み】\n${MEMBERSHIP.name}（月額¥${yen(MEMBERSHIP.price)}）に申し込みたいです。`);
  };
}

// ---------- パソコンで見ているとき：スマホで読み取るQRコードとメッセージのコピー ----------
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
function loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = QR_LIB; sc.onload = res; sc.onerror = rej;
    document.head.appendChild(sc);
  });
}

async function showLineOnPc(url, text) {
  document.querySelector('.line-pc')?.remove();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const box = document.createElement('div');
  box.className = 'line-pc';
  box.innerHTML = `<div class="line-pc-card" role="dialog" aria-modal="true">
      <button class="line-pc-close" type="button" aria-label="閉じる">×</button>
      <h3>スマホのLINEで送ってください</h3>
      <p>パソコンではLINEのトーク画面を開けません。スマホのカメラでQRコードを読み取ると、メッセージが入力された状態でLINEが開きます。</p>
      <div class="line-pc-qr" id="linePcQr"><span>QRコードを作成中…</span></div>
      <p class="line-pc-sub">または、メッセージをコピーして <b>${esc(LINE.id)}</b> のトークに貼り付けてください。</p>
      <textarea readonly>${esc(text)}</textarea>
      <div class="line-pc-btns">
        <button class="btn" type="button" data-copy>メッセージをコピー</button>
        ${LINE.addFriendUrl ? `<a class="btn line" href="${esc(LINE.addFriendUrl)}" target="_blank" rel="noopener">友だち追加ページを開く</a>` : ''}
      </div>
    </div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('.line-pc-close')) box.remove(); });
  box.querySelector('[data-copy]').onclick = async e => {
    try { await navigator.clipboard.writeText(text); }
    catch { box.querySelector('textarea').select(); document.execCommand('copy'); }
    e.target.textContent = 'コピーしました';
  };
  try {
    await loadQrLib();
    const qr = qrcode(0, 'L');
    qr.addData(url);
    qr.make();
    box.querySelector('#linePcQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch {
    box.querySelector('#linePcQr').innerHTML = '<span>QRコードを作れませんでした。メッセージをコピーしてお使いください。</span>';
  }
}
