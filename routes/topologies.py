from flask import Blueprint, request, jsonify
from database import get_db
import json

# トポロジーに関する処理をまとめるBlueprint
topologies_bp = Blueprint("topologies", __name__)


# トポロジーを新規作成する
@topologies_bp.route("/api/topologies", methods=["POST"])
def create_topology():
    data = request.get_json(silent=True)

    # 正しいJSONデータが送信されているか確認する
    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    name = data.get("name")

    # トポロジー名が空欄でないか確認する
    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "トポロジー名が必要です"}), 400

    conn = get_db()

    # 新しいトポロジーを登録する
    cursor = conn.execute(
        "INSERT INTO topologies (name) VALUES (?)",
        (name.strip(),)
    )

    conn.commit()
    topology_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "トポロジーを保存しました",
        "topology_id": topology_id
    }), 201


# 保存されているトポロジーの一覧を取得する
@topologies_bp.route("/api/topologies", methods=["GET"])
def get_topologies():
    conn = get_db()

    rows = conn.execute(
        "SELECT id, name, created_at FROM topologies ORDER BY id DESC"
    ).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# 指定したトポロジーの詳細を取得する
@topologies_bp.route("/api/topologies/<int:topology_id>", methods=["GET"])
def get_topology(topology_id):
    conn = get_db()

    # トポロジーが存在するか確認する
    topology = conn.execute(
        "SELECT * FROM topologies WHERE id = ?",
        (topology_id,)
    ).fetchone()

    if topology is None:
        conn.close()
        return jsonify({"error": "トポロジーが見つかりません"}), 404

    # トポロジーに属する機器を取得する
    device_rows = conn.execute(
        """SELECT id, type, name, x, y, details
        FROM devices WHERE topology_id = ?""",
        (topology_id,)
    ).fetchall()

    # トポロジーに属する接続情報を取得する
    connection_rows = conn.execute(
        """SELECT id, source_device_id, target_device_id,
        source_port, target_port
        FROM connections WHERE topology_id = ?""",
        (topology_id,)
    ).fetchall()

    conn.close()

    # 機器の詳細情報をJSON文字列から辞書に戻す
    devices = []
    for row in device_rows:
        device = dict(row)
        device["details"] = json.loads(device["details"])
        devices.append(device)

    # 接続情報を辞書形式に変換する
    connections = [
        dict(row) for row in connection_rows
    ]

    return jsonify({
        "id": topology["id"],
        "name": topology["name"],
        "created_at": topology["created_at"],
        "devices": devices,
        "connections": connections
    })


# 指定したトポロジーを削除する
@topologies_bp.route(
    "/api/topologies/<int:topology_id>",
    methods=["DELETE"]
)
def delete_topology(topology_id):
    conn = get_db()

    # トポロジーを削除する
    # 関連する機器や接続情報も外部キー制約によって削除される
    cursor = conn.execute(
        "DELETE FROM topologies WHERE id = ?",
        (topology_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "トポロジーが見つかりません"}), 404

    return jsonify({"message": "トポロジーを削除しました"})
