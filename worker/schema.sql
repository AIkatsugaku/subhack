-- サブハック API（Cloudflare D1）
-- 管理画面のメンバー
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,            -- ログインID
  name TEXT NOT NULL,             -- 表示名
  role TEXT NOT NULL DEFAULT 'member',  -- owner（メンバー管理もできる）/ member
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,             -- PBKDF2-SHA256
  created_at TEXT NOT NULL,
  last_login TEXT
);

-- 設定（GitHub のトークン、ログインの署名鍵など）
CREATE TABLE IF NOT EXISTS config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- アクセス数（1日ごとの集計だけを持つ。個人を特定する情報は保存しない）
-- kind: pv（ページ表示・key=ページ）/ uv（その日の訪問者・key=''）/ ref（流入元・key=ドメイン）/ ev（操作・key=操作名）
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);
