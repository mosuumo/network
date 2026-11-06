import sqlite3

# データベースファイルの名前
DB_NAME = "network.db"


# データベースとテーブルを初期化する関数
def init_db():

    # SQLiteデータベースに接続する
    # ファイルが存在しない場合は自動的に作成される
    conn = sqlite3.connect(DB_NAME)

    # 外部キー制約を有効にする
    # 関連するデータが削除されたときの整合性を保つ
    conn.execute("PRAGMA foreign_keys = ON")

    # トポロジー情報を保存するテーブルを作成する
    conn.execute("""
        CREATE TABLE IF NOT EXISTS topologies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # PC・SW・Routerなどの機器情報を保存するテーブルを作成する
    conn.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topology_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            FOREIGN KEY (topology_id) REFERENCES topologies(id)
                ON DELETE CASCADE
        )
    """)

    # 機器同士の接続情報を保存するテーブルを作成する
    conn.execute("""
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
        )
    """)

    # データベースへの変更を確定する
    conn.commit()

    # データベースとの接続を終了する
    conn.close()