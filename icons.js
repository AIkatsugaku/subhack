/*
 * サービスのアイコン（公式サイトのファビコン）を読み込むためのドメイン一覧
 * key は data.js のサービスID。ここにないサービスは色付きの文字アイコンになります。
 * 自前のロゴ画像を使いたい場合は data.js の img にパスを入れると、そちらが優先されます。
 */
const ICON_DOMAINS = {
  // 動画・スポーツ
  amazonprime: 'amazon.co.jp', primechannel: 'primevideo.com', youtubepremium: 'youtube.com', ytmember: 'youtube.com',
  netflix: 'netflix.com', unext: 'video.unext.jp', disneyplus: 'disneyplus.com', hulu: 'hulu.jp', fod: 'fod.fujitv.co.jp',
  danime: 'animestore.docomo.ne.jp', telasa: 'telasa.jp', dmmtv: 'tv.dmm.com', abema: 'abema.tv', lemino: 'lemino.docomo.ne.jp',
  niconico: 'nicovideo.jp', nicoch: 'ch.nicovideo.jp', dazn: 'dazn.com', wowow: 'wowow.co.jp', appletv: 'tv.apple.com',
  nhkod: 'nhk-ondemand.jp', jsports: 'jsports.co.jp', twitchturbo: 'twitch.tv', twitchsub: 'twitch.tv', spoon: 'skyperfectv.co.jp',
  rakutentv: 'tv.rakuten.co.jp', bandai: 'b-ch.com', animetimes: 'animetimes.jp', crunchyroll: 'crunchyroll.com',
  mlbtv: 'mlb.com', pacific: 'pacificleague.com',
  // 音楽
  spotify: 'spotify.com', applemusic: 'music.apple.com', amazonmusic: 'music.amazon.co.jp', ytmusic: 'music.youtube.com',
  linemusic: 'music.line.me', awa: 'awa.fm', rakutenmusic: 'music.rakuten.co.jp', amazonmusicprime: 'music.amazon.co.jp',
  soundcloud: 'soundcloud.com', mora: 'mora.jp',
  // AI
  chatgpt: 'chatgpt.com', claude: 'claude.ai', gemini: 'gemini.google.com', grok: 'grok.com', perplexity: 'perplexity.ai',
  copilot: 'copilot.microsoft.com', githubcopilot: 'github.com', cursor: 'cursor.com', midjourney: 'midjourney.com',
  notionai: 'notion.so', deepl: 'deepl.com', elevenlabs: 'elevenlabs.io', suno: 'suno.com', felo: 'genspark.ai',
  // クラウド
  icloud: 'icloud.com', googleone: 'one.google.com', googlephotos: 'photos.google.com', appleone: 'apple.com',
  dropbox: 'dropbox.com', onedrive: 'onedrive.live.com', amazonphotos: 'amazon.co.jp', box: 'box.com',
  evernote: 'evernote.com', notion: 'notion.so', onepassword: '1password.com', bitwarden: 'bitwarden.com',
  // 本・雑誌・音声
  kindleu: 'amazon.co.jp', audible: 'audible.co.jp', radiko: 'radiko.jp', rakutenmagazine: 'magazine.rakuten.co.jp',
  dmagazine: 'magazine.dmkt-sp.jp', nikkei: 'nikkei.com', asahi: 'asahi.com', newspicks: 'newspicks.com', cmoa: 'cmoa.jp',
  jumpplus: 'shonenjumpplus.com', jumpsq: 'jumpsq.shueisha.co.jp', yanjanplus: 'yanjanplus.shueisha.co.jp', magapoke: 'pocket.shonenmagazine.com',
  pixiv: 'pixiv.net', pixivfanbox: 'fanbox.cc', note: 'note.com', flier: 'flierinc.com', audiobookjp: 'audiobook.jp',
  piccoma: 'piccoma.com', lineManga: 'manga.line.me', bookwalker: 'bookwalker.jp',
  // ゲーム
  nso: 'nintendo.com', psplus: 'playstation.com', gamepass: 'xbox.com', eaplay: 'ea.com', applearcade: 'apple.com',
  ff14: 'finalfantasyxiv.com', dq10: 'hiroba.dqx.jp', fortnite: 'fortnite.com', pokehome: 'pokemon.co.jp',
  pokesleep: 'pokemonsleep.net', googleplaypass: 'play.google.com', ubisoft: 'ubisoft.com',
  // 学び・健康
  duolingo: 'duolingo.com', studysapuri: 'studysapuri.jp', asken: 'asken.jp', nosh: 'nosh.jp', nativecamp: 'nativecamp.net',
  rarejob: 'rarejob.com', udemy: 'udemy.com', schoo: 'schoo.jp', shinken: 'sho.benesse.co.jp', zkai: 'zkai.co.jp',
  kumon: 'kumon.ne.jp', fitbit: 'fitbit.com',
  // ジム
  anytime: 'anytimefitness.co.jp', chocozap: 'chocozap.jp', central: 'central.co.jp', goldsgym: 'goldsgym.jp',
  curves: 'curves.co.jp', lava: 'yoga-lava.com', joyfit: 'joyfit.jp', konami: 'konamisportsclub.jp',
  renaissance: 's-re.jp', tipness: 'tipness.co.jp', zen: 'zenplace.co.jp', leanbody: 'lean-body.jp',
  // お金・家計
  moneyforward: 'moneyforward.com', zaim: 'zaim.net', rakutenkakeibo: 'kakeibo.rakuten.co.jp', moneytree: 'moneytree.jp',
  freee: 'freee.co.jp', mfkakutei: 'biz.moneyforward.com', yayoi: 'yayoi-kk.co.jp', kabutan: 'kabutan.jp',
  // ツール
  m365: 'microsoft.com', applecare: 'apple.com', xpremium: 'x.com', lyp: 'lyp-premium.yahoo.co.jp', adobecc: 'adobe.com',
  canva: 'canva.com', discordnitro: 'discord.com', zoom: 'zoom.us', lightroom: 'lightroom.adobe.com', capcut: 'capcut.com',
  linestamp: 'store.line.me', googleworkspace: 'workspace.google.com', figma: 'figma.com', telegram: 'telegram.org',
  // ショッピング・会員
  rakutenpremium: 'rakuten.co.jp', yahoopremium: 'yahoo.co.jp', costco: 'costco.co.jp', uberone: 'ubereats.com',
  demaecan: 'demae-can.com', woltplus: 'wolt.com', oisix: 'oisix.com', airCloset: 'air-closet.com', carsub: 'kinto-jp.com',
  // 推し
  fantia: 'fantia.jp', cien: 'ci-en.net', patreon: 'patreon.com', bubble: 'bubble.dear-u.co.kr', weverse: 'weverse.io',
  // 固定費
  nhk: 'nhk.or.jp',
  // ネット回線
  docomohikari: 'docomo.ne.jp', auhikari: 'au.com', sbhikari: 'softbank.jp', rakutenhikari: 'network.mobile.rakuten.co.jp',
  nuro: 'nuro.jp', jcom: 'jcom.co.jp', biglobe: 'biglobe.ne.jp', ocn: 'ocn.ne.jp', flets: 'flets.com', enhikari: 'enhikari.jp',
  gmohikari: 'gmobb.jp', home5g: 'docomo.ne.jp', wimax: 'uqwimax.jp', sbair: 'softbank.jp', rakutenturbo: 'network.mobile.rakuten.co.jp',
  // スマホ
  docomo: 'docomo.ne.jp', au: 'au.com', softbank: 'softbank.jp', rakutenmobile: 'network.mobile.rakuten.co.jp', povo: 'povo.jp',
  ahamo: 'ahamo.com', linemo: 'linemo.jp', uq: 'uqwimax.jp', ymobile: 'ymobile.jp', nihontsushin: 'nihontsushin.com',
  mineo: 'mineo.jp', his: 'his-mobile.com', iijmio: 'iijmio.jp', aeon: 'aeonmobile.jp', nuromobile: 'mobile.nuro.jp',
  jcommobile: 'jcom.co.jp', biglobemobile: 'biglobe.ne.jp',
};

// ファビコンのURL（ドメインから自動取得）
const iconUrl = domain => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
