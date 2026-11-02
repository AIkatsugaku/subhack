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

function buildMember({ items, SVC, yen, esc, icoHTML, iconOf }) {
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
      <input class="mb-date" type="date" value="${esc(r.date || '')}" aria-label="日付"${r.type ? '' : ' hidden'}>
    </div>`;
  }).join('');

  const m = MEMBERSHIP;
  return `
    <div class="panel mb" id="memberPanel">
      <h3>🔔 LINE登録で、解約・見直しの時期をお知らせ</h3>
      <p class="mb-lead">無料のLINE登録だけで使えます。「無料期間が終わる前に解約したい」「更新月に見直したい」日をLINEでお知らせします。</p>
      <ol class="mb-steps">
        <li><b>1</b><span>LINE公式アカウントを友だち追加（無料）</span></li>
        <li><b>2</b><span>下のリストで、通知してほしいサービスに日付を入れる</span></li>
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

    <div class="panel consult">
      <h3>💬 いつでも、何度でもLINEで相談</h3>
      <p class="mb-lead">「どれを解約すればいい？」「もっと安くできる？」を、気になったときにすぐLINEで聞けます。</p>
      <div class="premium">
        <div class="premium-head"><span class="premium-badge">有料会員</span><b>${esc(m.name)}</b></div>
        <div class="premium-price">月額 <b>¥${yen(m.price)}</b><small>（税込）</small></div>
        <ul>${m.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="btn pr big" id="mbJoin" type="button">月額¥${yen(m.price)}で相談し放題にする</button>
      </div>
      <button class="link-btn" id="mbConsult" type="button">会員の方：いまの内容を添えてLINEで相談する</button>
    </div>`;
}

function bindMember(root, { getItems, save, yen, SVC, toast }) {
  const nameOf = i => i.label || i.name || (SVC[i.sid]?.n || '').replace(/\n/g, '');
  const reminders = () => getItems().filter(i => i.remind?.type && i.remind.date)
    .sort((a, b) => a.remind.date.localeCompare(b.remind.date));
  const fmt = d => d.replace(/-/g, '/');
  const openUrl = url => window.open(url, '_blank', 'noopener');
  const needLine = () => { toast('LINE公式アカウントは準備中です'); };

  const updateCount = () => {
    const n = reminders().length;
    root.querySelector('#mbCount').textContent = n ? `${n}件の予定を登録中` : '日付を入れるとここに件数が出ます';
  };

  root.querySelectorAll('.mb-row').forEach(row => {
    const it = () => getItems().find(i => i.uid === row.dataset.uid);
    const type = row.querySelector('.mb-type'), date = row.querySelector('.mb-date');
    const store = () => {
      const i = it(); if (!i) return;
      if (type.value) i.remind = { type: type.value, date: date.value };
      else delete i.remind;
      save(); updateCount();
    };
    type.onchange = () => {
      date.hidden = !type.value;
      // 初期値は1か月後（無料期間・更新月の目安）
      if (type.value && !date.value) {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        date.value = d.toISOString().slice(0, 10);
      }
      store();
    };
    date.onchange = store;
  });
  updateCount();

  // カレンダー（.ics）：予定日の前日 9:00 に通知
  root.querySelector('#mbCalendar').onclick = () => {
    const list = reminders();
    if (!list.length) { toast('通知したいサービスに日付を入れてください'); return; }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
    const events = list.map(i => {
      const title = `【${REMIND_TYPES[i.remind.type]}】${nameOf(i)}（¥${yen(i.price)}/月）`;
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
    if (!list.length) { toast('通知したいサービスに日付を入れてください'); return; }
    const text = ['【通知の登録】', ...list.map(i => `・${fmt(i.remind.date)} ${nameOf(i)}（¥${yen(i.price)}/月）を${REMIND_TYPES[i.remind.type]}`), '', 'この日が近づいたら教えてください。'].join('\n');
    const url = lineMessageUrl(text);
    url ? openUrl(url) : needLine();
  };

  root.querySelector('#mbAdd').onclick = () => (LINE.addFriendUrl ? openUrl(LINE.addFriendUrl) : needLine());

  // 会員の相談：いまの内容を添えて送る
  root.querySelector('#mbConsult').onclick = () => {
    const list = [...getItems()].sort((a, b) => b.price - a.price);
    const total = list.reduce((a, b) => a + b.price, 0);
    const text = [
      '【会員相談】',
      `いまのサブスク・固定費：${list.length}件 月¥${yen(total)}`,
      ...list.slice(0, 20).map(i => `・${nameOf(i)}　¥${yen(i.price)}`),
      list.length > 20 ? `ほか${list.length - 20}件` : '',
      '',
      '相談したいこと：',
    ].filter(l => l !== '').join('\n');
    const url = lineMessageUrl(text);
    url ? openUrl(url) : needLine();
  };

  // 有料会員
  root.querySelector('#mbJoin').onclick = () => {
    if (MEMBERSHIP.joinUrl) return openUrl(MEMBERSHIP.joinUrl);
    const url = lineMessageUrl(`【有料会員の申し込み】\n${MEMBERSHIP.name}（月額¥${yen(MEMBERSHIP.price)}）に申し込みたいです。`);
    url ? openUrl(url) : needLine();
  };
}
