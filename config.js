/*
 * サイト設定の初期値
 * 実際の値は管理画面（admin.html）で編集し、settings.json に保存されます。
 * settings.json に無い項目だけ、ここの値が使われます。
 */
const SITE = {
  name: 'サブハック',
  url: 'https://aikatsugaku.github.io/subhack/',      // 公開URL（シェア用）
  hashtag: 'サブハック',        // シェア時のハッシュタグ
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
  name: 'サブハック プレミアム',
  price: 400,
  features: [
    'LINEでいつでも・何度でも相談できる',
    '月1回のWeb個別相談（30分）',
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
 * 結果画面の「見直しで安くなるかも」枠
 * 表示条件（RECOMMEND_RULES）はコード側、文言とURLは管理画面（settings.json）で編集します。
 * url が空の枠は表示されません。
 */
const RECOMMEND_RULES = {
  mobile: { label: 'スマホ代が月4,000円以上', when: s => s.cat('mobile') >= 4000 },
  net: { label: '光回線が月5,000円以上', when: s => s.cat('net') >= 5000 },
  video: { label: '動画が月3,000円以上', when: s => s.cat('video') >= 3000 },
  kakeibo: { label: '合計が月1万円以上', when: s => s.total >= 10000 },
  insurance: { label: '保険を登録している', when: s => s.cat('hoken') > 0 },
  always: { label: '全員に表示', when: () => true },
};

const RECOMMENDS = [
  { id: 'mobile', tag: 'スマホ代', title: 'スマホ代、格安プランで月数千円下がるかも', text: '大手キャリアの料金なら、格安SIMへの乗り換えで年間数万円の節約になることがあります。', cta: '格安SIMを比べる', url: '' },
  { id: 'net', tag: 'ネット回線', title: '光回線のキャッシュバックを見逃していませんか？', text: '乗り換えキャンペーンで実質料金が大きく下がるケースがあります。', cta: '光回線キャンペーンを見る', url: '' },
  { id: 'video', tag: '動画', title: '動画サブスク、まとめると安くなるかも', text: 'セットプランや無料体験を使えば、見たい作品だけ効率よく見られます。', cta: '無料体験できる動画サービス', url: '' },
  { id: 'kakeibo', tag: '家計', title: '固定費を自動で見える化しよう', text: '家計簿アプリならカード明細から使っていないサブスクを見つけやすくなります。', cta: '家計簿アプリを見る', url: '' },
  { id: 'insurance', tag: '保険', title: '保険の無料相談で毎月の保険料を見直す', text: 'プロに相談するだけで、保障はそのまま保険料が下がることも。', cta: '無料相談を予約する', url: '' },
  { id: 'always', tag: 'ポイ活', title: 'ポイ活で、サブスク代を取り戻そう', text: 'ポイントサイト経由の申し込みで、サブスク代の一部がポイントで戻ってきます。', cta: 'ポイントサイトを見る', url: '' },
];
