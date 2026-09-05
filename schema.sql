PRAGMA foreign_keys = ON;

-- =========================================================
-- FILE BOX DATABASE
-- Cloudflare D1
-- =========================================================


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL UNIQUE,

    email TEXT UNIQUE,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- NAVIGATION / CATEGORIES
--
-- Sesuai dengan navItems di script.js
-- =========================================================

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    icon TEXT NOT NULL
        DEFAULT 'fa-folder',

    position INTEGER NOT NULL
        DEFAULT 0,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- =========================================================
-- FILES
--
-- Sesuai dengan:
--
-- id
-- name
-- size
-- data
-- navId
-- fav
-- addedAt
-- lastOpened
-- =========================================================

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,

    user_id INTEGER NOT NULL,

    category_id INTEGER,

    name TEXT NOT NULL,

    original_name TEXT NOT NULL,

    size INTEGER NOT NULL DEFAULT 0,

    mime_type TEXT,

    extension TEXT,

    storage_key TEXT,

    is_favorite INTEGER NOT NULL DEFAULT 0,

    download_count INTEGER NOT NULL DEFAULT 0,

    view_count INTEGER NOT NULL DEFAULT 0,

    added_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    last_opened_at TEXT,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    deleted_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
);


-- =========================================================
-- FAVORITES
--
-- Dipisahkan supaya favorite bisa dikembangkan
-- =========================================================

CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    file_id TEXT NOT NULL,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE CASCADE,

    UNIQUE(user_id, file_id)
);


-- =========================================================
-- RECENT FILES
--
-- Untuk fitur Beranda:
-- "File yang baru-baru ini dibuka"
-- =========================================================

CREATE TABLE IF NOT EXISTS recent_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    file_id TEXT NOT NULL,

    opened_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE CASCADE
);


-- =========================================================
-- DOWNLOADS
-- =========================================================

CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    file_id TEXT NOT NULL,

    user_id INTEGER,

    downloaded_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- =========================================================
-- SHARED FILES
--
-- Untuk fitur share link di masa depan
-- =========================================================

CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    file_id TEXT NOT NULL,

    user_id INTEGER NOT NULL,

    token TEXT NOT NULL UNIQUE,

    expires_at TEXT,

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- =========================================================
-- TRASH
-- =========================================================

CREATE TABLE IF NOT EXISTS trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    file_id TEXT,

    user_id INTEGER NOT NULL,

    deleted_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE SET NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- =========================================================
-- ACTIVITY LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,

    file_id TEXT,

    action TEXT NOT NULL,

    description TEXT,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE SET NULL
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_files_user
ON files(user_id);


CREATE INDEX IF NOT EXISTS idx_files_category
ON files(category_id);


CREATE INDEX IF NOT EXISTS idx_files_name
ON files(name);


CREATE INDEX IF NOT EXISTS idx_files_favorite
ON files(is_favorite);


CREATE INDEX IF NOT EXISTS idx_files_added
ON files(added_at);


CREATE INDEX IF NOT EXISTS idx_files_last_opened
ON files(last_opened_at);


CREATE INDEX IF NOT EXISTS idx_categories_user
ON categories(user_id);


CREATE INDEX IF NOT EXISTS idx_categories_position
ON categories(position);


CREATE INDEX IF NOT EXISTS idx_recent_user
ON recent_files(user_id);


CREATE INDEX IF NOT EXISTS idx_recent_opened
ON recent_files(opened_at);


CREATE INDEX IF NOT EXISTS idx_downloads_file
ON downloads(file_id);


CREATE INDEX IF NOT EXISTS idx_activity_user
ON activity_logs(user_id);


-- =========================================================
-- DEFAULT USER
-- =========================================================

INSERT OR IGNORE INTO users (
    username,
    email
)
VALUES (
    'default',
    'default@filebox.local'
);


-- =========================================================
-- DEFAULT CATEGORIES
-- =========================================================

INSERT OR IGNORE INTO categories (
    user_id,
    name,
    icon,
    position
)
SELECT
    id,
    'Documents',
    'fa-file-lines',
    1
FROM users
WHERE username = 'default';


INSERT OR IGNORE INTO categories (
    user_id,
    name,
    icon,
    position
)
SELECT
    id,
    'Images',
    'fa-image',
    2
FROM users
WHERE username = 'default';


INSERT OR IGNORE INTO categories (
    user_id,
    name,
    icon,
    position
)
SELECT
    id,
    'Music',
    'fa-music',
    3
FROM users
WHERE username = 'default';


INSERT OR IGNORE INTO categories (
    user_id,
    name,
    icon,
    position
)
SELECT
    id,
    'Videos',
    'fa-video',
    4
FROM users
WHERE username = 'default';


INSERT OR IGNORE INTO categories (
    user_id,
    name,
    icon,
    position
)
SELECT
    id,
    'Projects',
    'fa-briefcase',
    5
FROM users
WHERE username = 'default';
