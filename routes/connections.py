from flask import Blueprint, request, jsonify
from database import get_db

# 接続情報に関するAPIをまとめるBlueprint
connections_bp = Blueprint("connections", __name__)


# 接続情報を登録する
@connections_bp.route("/api/topologies/<int:topology_id>/connections", methods=["POST"])
def create_connection(topology_id):
    # リクエストからJSONデータを取得する
    data = request.get_json(silent=True)

    # JSONデータが正しく送信されているか確認する
    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    source_id = data.get("source_device_id")
    target_id = data.get("target_device_id")

    # 接続元と接続先のIDが指定されているか確認する
    if source_id is None or target_id is None:
        return jsonify({"error": "接続する機器を指定してください"}), 400

    # 機器IDが正の整数であるか確認する
    if (type(source_id) is not int or source_id <= 0
            or type(target_id) is not int or target_id <= 0):
        return jsonify({"error": "機器IDが正しくありません"}), 400

    # 同じ機器同士の接続を拒否する
    if source_id == target_id:
        return jsonify({"error": "同じ機器同士は接続できません"}), 400

    conn = get_db()

    # 接続元と接続先の機器が指定したトポロジーに存在するか確認する
    devices = conn.execute(
        "SELECT id FROM devices WHERE topology_id = ? AND id IN (?, ?)",
        (topology_id, source_id, target_id)
    ).fetchall()

    if len(devices) != 2:
        conn.close()
        return jsonify({"error": "機器が見つかりません"}), 404

    # 既に同じ組み合わせの接続が存在するか確認する
    existing = conn.execute(
        """SELECT id FROM connections
        WHERE topology_id = ?
        AND (
            (source_device_id = ? AND target_device_id = ?)
            OR
            (source_device_id = ? AND target_device_id = ?)
        )""",
        (topology_id, source_id, target_id, target_id, source_id)
    ).fetchone()

    if existing is not None:
        conn.close()
        return jsonify({"error": "この接続は既に登録されています"}), 409

    # 接続情報をデータベースに登録する
    cursor = conn.execute(
        """INSERT INTO connections
        (topology_id, source_device_id, target_device_id)
        VALUES (?, ?, ?)""",
        (topology_id, source_id, target_id)
    )
    conn.commit()
    connection_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "接続しました",
        "connection_id": connection_id
    }), 201


# 指定したトポロジーの接続情報を取得する
@connections_bp.route("/api/topologies/<int:topology_id>/connections", methods=["GET"])
def get_connections(topology_id):
    conn = get_db()

    # トポロジーIDを指定して接続情報を取得する
    rows = conn.execute(
        """SELECT id, topology_id, source_device_id, target_device_id
        FROM connections WHERE topology_id = ?""",
        (topology_id,)
    ).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# 接続情報を削除する
@connections_bp.route("/api/connections/<int:connection_id>", methods=["DELETE"])
def delete_connection(connection_id):
    conn = get_db()

    # 指定した接続情報をデータベースから削除する
    cursor = conn.execute(
        "DELETE FROM connections WHERE id = ?",
        (connection_id,)
    )
    conn.commit()
    conn.close()

    # 削除対象の接続情報が存在しなかった場合
    if cursor.rowcount == 0:
        return jsonify({"error": "接続情報が見つかりません"}), 404

    return jsonify({"message": "削除しました"})