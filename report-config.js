/*
 * 見直しレポートの設定（合計カード画面の最後に表示）
 *
 * - url にアフィリエイトURLを入れると「ここから申し込む（PR）」ボタンが出ます。空ならボタンは出ません。
 * - 料金・キャッシュバック・割引率は目安です。公開前に必ず各社の最新条件に書き換えてください。
 * - sid は data.js のサービスID（アイコンに使います）。電気・カードは d に公式サイトのドメインを入れるとアイコンが出ます。
 * - set に入れたサービスを使っている人には「セット割・相性◎」として優先表示します。
 */
const REPORT = {
  // スマホ：今の月額（1回線あたり）より安いものを表示
  mobile: [
    { sid: 'linemo', plan: 'ベストプラン 〜3GB', price: 990, gb: '〜3GB', url: '' },
    { sid: 'iijmio', plan: '5GB', price: 950, gb: '5GB', url: '' },
    { sid: 'iijmio', plan: '10GB', price: 1400, gb: '10GB', url: '' },
    { sid: 'rakutenmobile', plan: '〜3GB', price: 1078, gb: '〜3GB', url: '' },
    { sid: 'rakutenmobile', plan: '無制限', price: 3278, gb: '無制限', url: '' },
    { sid: 'mineo', plan: 'マイピタ 5GB', price: 1298, gb: '5GB', url: '' },
    { sid: 'ahamo', plan: '30GB', price: 2970, gb: '30GB', url: '' },
    { sid: 'uq', plan: 'ミニミニプラン', price: 2365, gb: '4GB', url: '', set: ['auhikari'] },
    { sid: 'ymobile', plan: 'シンプル3 S', price: 3058, gb: '5GB', url: '', set: ['sbhikari', 'sbair'] },
    { sid: 'povo', plan: '30GB/30日', price: 2780, gb: '30GB', url: '' },
    { sid: 'nihontsushin', plan: '合理的みんなのプラン', price: 1390, gb: '20GB', url: '' },
  ],

  // 光回線：price は月額、cashback は申込特典の総額（実質月額 = price − cashback ÷ months）
  net: [
    { sid: 'gmohikari', name: 'GMOとくとくBB光', type: 'マンション', price: 3773, cashback: 0, months: 24, url: '' },
    { sid: 'enhikari', name: 'enひかり', type: 'マンション', price: 3520, cashback: 0, months: 24, url: '' },
    { sid: 'nuro', name: 'NURO 光 マンション', type: 'マンション', price: 2090, cashback: 0, months: 24, url: '' },
    { sid: 'auhikari', name: 'auひかり マンション', type: 'マンション', price: 4180, cashback: 0, months: 24, url: '', set: ['au', 'uq', 'povo'] },
    { sid: 'sbhikari', name: 'ソフトバンク光 マンション', type: 'マンション', price: 4180, cashback: 0, months: 24, url: '', set: ['softbank', 'ymobile'] },
    { sid: 'docomohikari', name: 'ドコモ光 マンション', type: 'マンション', price: 4400, cashback: 0, months: 24, url: '', set: ['docomo', 'ahamo'] },
    { sid: 'rakutenhikari', name: '楽天ひかり マンション', type: 'マンション', price: 4180, cashback: 0, months: 24, url: '', set: ['rakutenmobile'] },
    { sid: 'gmohikari', name: 'GMOとくとくBB光', type: '戸建て', price: 4818, cashback: 0, months: 24, url: '' },
    { sid: 'enhikari', name: 'enひかり', type: '戸建て', price: 4620, cashback: 0, months: 24, url: '' },
  ],

  // 電気：rate は「今の電気代から何%安くなるか」の目安（0 なら金額は出さず、試算ボタンだけ出す）
  electric: [
    { name: '楽天でんき', d: 'energy.rakuten.co.jp', c: '#BF0000', t: 'R', rate: 0, point: '楽天ポイントが貯まる', url: '', set: ['rakutenmobile', 'rakutenhikari', 'rakutenpremium'] },
    { name: 'ドコモでんき', d: 'docomo.ne.jp', c: '#CC0033', t: 'd', rate: 0, point: 'dポイントが貯まる', url: '', set: ['docomo', 'ahamo', 'docomohikari'] },
    { name: 'auでんき', d: 'au.com', c: '#EB5505', t: 'au', rate: 0, point: 'Pontaポイントが貯まる', url: '', set: ['au', 'uq', 'povo', 'auhikari'] },
    { name: 'ソフトバンクでんき', d: 'softbank.jp', c: '#888888', t: 'SB', rate: 0, point: 'PayPayポイントが貯まる', url: '', set: ['softbank', 'ymobile', 'linemo', 'sbhikari'] },
    { name: 'Looopでんき', d: 'looop-denki.com', c: '#F39800', t: 'L', rate: 0, point: '基本料金0円', url: '' },
    { name: 'オクトパスエナジー', d: 'octopusenergy.co.jp', c: '#5840FF', t: 'OE', rate: 0, point: '実質再エネ100%', url: '' },
  ],

  // クレジットカード：rate は基本のポイント還元率、fee は年会費（円/年）
  // set のサービスを使っている人ほど上位に表示
  cards: [
    { name: '楽天カード', d: 'rakuten-card.co.jp', c: '#BF0000', t: 'R', fee: 0, rate: 0.01, point: '楽天ポイント', url: '', set: ['rakutenmobile', 'rakutenhikari', 'rakutenmagazine', 'rakutenmusic', 'rakutentv', 'rakutenpremium', 'rakutenkakeibo', 'rakutenturbo'], setLabel: '楽天のサービス' },
    { name: 'Amazon Mastercard', d: 'amazon.co.jp', c: '#232F3E', t: 'A', fee: 0, rate: 0.01, point: 'Amazonポイント', url: '', set: ['amazonprime', 'amazonmusic', 'kindleu', 'audible', 'primechannel', 'amazonphotos'], setLabel: 'Amazonのサービス' },
    { name: 'dカード', d: 'dcard.docomo.ne.jp', c: '#CC0033', t: 'd', fee: 0, rate: 0.01, point: 'dポイント', url: '', set: ['docomo', 'ahamo', 'docomohikari', 'home5g', 'dmagazine', 'danime', 'lemino'], setLabel: 'ドコモのサービス' },
    { name: 'au PAY カード', d: 'au.com', c: '#EB5505', t: 'au', fee: 0, rate: 0.01, point: 'Pontaポイント', url: '', set: ['au', 'uq', 'povo', 'auhikari', 'telasa'], setLabel: 'au・UQ mobile・povo' },
    { name: 'PayPayカード', d: 'paypay-card.co.jp', c: '#FF0033', t: 'P', fee: 0, rate: 0.01, point: 'PayPayポイント', url: '', set: ['softbank', 'ymobile', 'linemo', 'sbhikari', 'sbair', 'lyp', 'yahoopremium'], setLabel: 'ソフトバンク・ワイモバイル・LINEMO・LYP' },
    { name: '三井住友カード（NL）', d: 'smbc-card.com', c: '#00523F', t: 'NL', fee: 0, rate: 0.005, point: 'Vポイント', url: '', note: '対象のコンビニ・飲食店で高還元' },
  ],
};
