/*
 * Bing・Yandex などに「ページを更新した」と知らせる（IndexNow）。ChatGPT の検索は Bing の情報も使います。
 *   node tools/indexnow.js          … sitemap に載っているページを全部知らせる
 * 公開（GitHub Pages の反映）が終わってから実行してください。
 */
const urls = require('./urls.json');
const KEY = '3dd684ca51f0f02b0b1cab3da9ae7fab';
fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'www.sabu-hack.com', key: KEY, keyLocation: `https://www.sabu-hack.com/${KEY}.txt`, urlList: urls }),
}).then(r => console.log('IndexNow:', r.status, r.status === 200 || r.status === 202 ? '受け付けられました' : ''));
