/*
 * サイト設定・アフィリエイト設定
 * ここを書き換えるだけでリンクが反映されます。
 */
const SITE = {
  name: 'サブスクまとめ',
  url: 'https://aikatsugaku.github.io/subsc-matome/',      // 公開URL（シェア用）
  hashtag: 'サブスクまとめ診断',         // シェア時のハッシュタグ
  xAccount: '',                        // 例: 'your_account'（リクエスト用リンクに使用）
};

/*
 * LINE公式アカウント
 * - id: ベーシックID（@から始まるID。例: '@123abcde'）
 * - addFriendUrl: 友だち追加URL（例: 'https://lin.ee/xxxxxxx'）
 * 未設定の間はボタンを押すと「準備中」と表示されます。
 */
const LINE = {
  id: '',
  addFriendUrl: '',
};

/*
 * 有料会員プラン
 * - joinUrl: 申し込み先（Stripe の決済リンクなど）。空なら LINE で申し込みメッセージを送る形になります。
 */
const MEMBERSHIP = {
  name: 'サブスク見直しプレミアム',
  price: 400,
  features: [
    '月1回のWeb個別相談（30分）',
    '解約・見直し時期をLINEでお知らせ',
    'あなた専用の見直しプランを作成',
  ],
  joinUrl: '',
};

/*
 * サービスごとのアフィリエイトリンク
 * key は data.js のサービス id。空や未設定ならボタンは出ません。
 * 例: netflix: 'https://px.a8.net/svt/ejp?a8mat=xxxx'
 */
const AFFILIATE = {
  // unext: '',
  // dmmtv: '',
  // dazn: '',
  // ahamo: '',
  // linemo: '',
  // rakutenmobile: '',
  // iijmio: '',
  // nuro: '',
  // gmohikari: '',
  // enhikari: '',
  // kindleu: '',
  // audible: '',
  // nativecamp: '',
  // chocozap: '',
  // moneyforward: '',
};

/*
 * 合計カード画面に出す「見直し・おすすめ」枠
 * when: 表示条件（state を受け取り true で表示）
 *   s.total       … 月額合計
 *   s.cat(id)     … カテゴリの月額合計
 *   s.has(id)     … サービスを登録しているか
 *   s.count       … 登録数
 * url が空の枠は表示されません。
 */
const RECOMMENDS = [
  {
    when: s => s.cat('mobile') >= 4000,
    tag: 'スマホ代',
    title: 'スマホ代、格安プランで月数千円下がるかも',
    text: '大手キャリアの料金なら、格安SIMへの乗り換えで年間数万円の節約になることがあります。',
    cta: '格安SIMを比べる',
    url: '',
  },
  {
    when: s => s.cat('net') >= 5000,
    tag: 'ネット回線',
    title: '光回線のキャッシュバックを見逃していませんか？',
    text: '乗り換えキャンペーンで実質料金が大きく下がるケースがあります。',
    cta: '光回線キャンペーンを見る',
    url: '',
  },
  {
    when: s => s.cat('video') >= 3000,
    tag: '動画',
    title: '動画サブスク、まとめると安くなるかも',
    text: 'セットプランや無料体験を使えば、見たい作品だけ効率よく見られます。',
    cta: '無料体験できる動画サービス',
    url: '',
  },
  {
    when: s => s.total >= 10000,
    tag: '家計',
    title: '固定費を自動で見える化しよう',
    text: '家計簿アプリならカード明細から使っていないサブスクを見つけやすくなります。',
    cta: '家計簿アプリを見る',
    url: '',
  },
  {
    when: s => s.cat('fixed') > 0 && s.has('insurance'),
    tag: '保険',
    title: '保険の無料相談で毎月の保険料を見直す',
    text: 'プロに相談するだけで、保障はそのまま保険料が下がることも。',
    cta: '無料相談を予約する',
    url: '',
  },
  {
    when: s => true,
    tag: 'ポイ活',
    title: 'ポイ活で、サブスク代を取り戻そう',
    text: 'ポイントサイト経由の申し込みで、サブスク代の一部がポイントで戻ってきます。',
    cta: 'ポイントサイトを見る',
    url: '',
  },
];
