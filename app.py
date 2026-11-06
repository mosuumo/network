from flask import Flask, render_template, request, jsonify
import sqlite3
import json
from database import init_db, DB_NAME

app = Flask(__name__)

# データベースを初期化する
init_db()


# トップページを表示する
@app.route("/")
def index():
    return render_template("index.html")


# トポロジーを保存するAPI
@app.route("/api/topologies", methods=["POST"])
def save_topology():

    # フロントエンドから送信されたJSONデータを取得する
    data = request.get_json()

    # トポロジー名を取得する
    name = data.get("name")

    # トポロジー名が入力されているか確認する
    if not name:
        return jsonify({"error": "トポロジー名が必要です"}), 400

    # データベースに接続する
    conn = sqlite3.connect(DB_NAME)

    # トポロジー名をデータベースに登録する
    cursor = conn.execute(
        "INSERT INTO topologies (name) VALUES (?)",
        (name,)
    )

    # 登録されたトポロジーのIDを取得する
    topology_id = cursor.lastrowid

    # データベースへの変更を確定する
    conn.commit()

    # データベースとの接続を終了する
    conn.close()

    # 保存結果をJSON形式で返す
    return jsonify({
        "message": "トポロジーを保存しました",
        "topology_id": topology_id
    }), 201

if __name__ == "__main__":
    app.run(debug=True)
