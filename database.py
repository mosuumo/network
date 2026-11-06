import sqlite3

# データベースファイルの名前
DB_NAME = "network.db"


# データベースに接続する関数
def get_db():
    # SQLiteデータベースに接続する
    conn = sqlite3.connect(DB_NAME)

    # 取得したデータを列名で参照できるようにする
    conn.row_factory = sqlite3.Row

    # 外部キー制約を有効にする
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


# データベースとテーブルを初期化する関数
def init_db():
    # データベースに接続する
    conn = get_db()

    # 必要なテーブルを作成する
    # 既に存在する場合は作成しない
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS topologies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topology_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            FOREIGN KEY (topology_id) REFERENCES topologies(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topology_id INTEGER NOT NULL,
            source_device_id INTEGER NOT NULL,
            target_device_id INTEGER NOT NULL,
            FOREIGN KEY (topology_id) REFERENCES topologies(id)
                ON DELETE CASCADE,
            FOREIGN KEY (source_device_id) REFERENCES devices(id)
                ON DELETE CASCADE,
            FOREIGN KEY (target_device_id) REFERENCES devices(id)
                ON DELETE CASCADE
        );
    """)

    # データベースとの接続を終了する
    conn.close()