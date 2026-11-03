/*
 * 管理画面で保存した settings.json を読み込み、config.js・report-config.js の初期値に上書きします。
 * 読み込めなかった場合は初期値のまま動きます。
 */
function applySettings(st) {
  if (!st || typeof st !== 'object') return;
  if (st.SITE) Object.assign(SITE, st.SITE);
  if (st.LINE) Object.assign(LINE, st.LINE);
  if (st.MEMBERSHIP) Object.assign(MEMBERSHIP, st.MEMBERSHIP);
  if (st.AFFILIATE) {
    Object.keys(AFFILIATE).forEach(k => delete AFFILIATE[k]);
    Object.entries(st.AFFILIATE).forEach(([k, v]) => { if (v) AFFILIATE[k] = v; });
  }
  if (Array.isArray(st.RECOMMENDS)) RECOMMENDS.splice(0, RECOMMENDS.length, ...st.RECOMMENDS);
  if (Array.isArray(st.GUIDES)) GUIDES.splice(0, GUIDES.length, ...st.GUIDES);
  if (st.REPORT) ['mobile', 'net', 'electric', 'cards', 'furusato'].forEach(k => { if (Array.isArray(st.REPORT[k])) REPORT[k] = st.REPORT[k]; });
}

// 保存直後でも新しい内容を読むよう、毎回URLを変えて取得する
window.settingsReady = fetch(`settings.json?t=${Date.now()}`, { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null))
  .then(applySettings)
  .catch(() => { /* 初期値で続行 */ });
