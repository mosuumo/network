from flask import Blueprint, request, jsonify
from database import get_db

connections_bp = Blueprint("connections", __name__)


# 接続情報を登録する
@connections_bp.route("/api/topologies/<int:topology_id>/connections", methods=["POST"])
def create_connection(topology_id):
    data = request.get_json()
    source_id = data.get("source_device_id")
    target_id = data.get("target_device_id")

    if source_id is None or target_id is None:
        return jsonify({"error": "接続する機器を指定してください"}), 400

    conn = get_db()

    devices = conn.execute(
        "SELECT id FROM devices WHERE topology_id = ? AND id IN (?, ?)",
        (topology_id, source_id, target_id)
    ).fetchall()

    if len(devices) != 2:
        conn.close()
        return jsonify({"error": "機器が見つかりません"}), 404

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


# 接続情報の一覧を取得する
@connections_bp.route("/api/topologies/<int:topology_id>/connections", methods=["GET"])
def get_connections(topology_id):
    conn = get_db()
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
    cursor = conn.execute(
        "DELETE FROM connections WHERE id = ?",
        (connection_id,)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "接続情報が見つかりません"}), 404

    return jsonify({"message": "削除しました"})