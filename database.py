import sqlite3

# データベースファイルの名前
DB_NAME = "network.db"

# データベースに接続する関数
def get_db():
    conn = sqlite3.connect(DB_NAME)

    # 取得したデータを列名で参照できるようにする
    conn.row_factory = sqlite3.Row

    # 外部キー制約を有効にする
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


# テーブルに不足している列を追加する関数
def add_column_if_missing(conn, table, column, definition):
    # 現在のテーブルに存在する列名を取得する
    columns = [
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table})")
    ]

    # 列が存在しない場合だけ追加する
    if column not in columns:
        conn.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
        )


# データベースとテーブルを初期化する関数
def init_db():
    conn = get_db()

    # 基本となるテーブルを作成する
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
            details TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (topology_id) REFERENCES topologies(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topology_id INTEGER NOT NULL,
            source_device_id INTEGER NOT NULL,
            target_device_id INTEGER NOT NULL,
            source_port TEXT,
            target_port TEXT,
            FOREIGN KEY (topology_id) REFERENCES topologies(id)
                ON DELETE CASCADE,
            FOREIGN KEY (source_device_id) REFERENCES devices(id)
                ON DELETE CASCADE,
            FOREIGN KEY (target_device_id) REFERENCES devices(id)
                ON DELETE CASCADE
        );
    """)

    # 既存のデータベースにも不足している列を追加する
    # 既存データを削除せずにデータベースを拡張する
    add_column_if_missing(
        conn, "devices", "details", "TEXT NOT NULL DEFAULT '{}'"
    )
    add_column_if_missing(
        conn, "connections", "source_port", "TEXT"
    )
    add_column_if_missing(
        conn, "connections", "target_port", "TEXT"
    )

    # 変更を保存してデータベースとの接続を終了する
    conn.commit()
    conn.close()