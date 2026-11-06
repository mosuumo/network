from flask import Blueprint, request, jsonify
from database import get_db

devices_bp = Blueprint("devices", __name__)


# 機器を登録する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["POST"])
def create_device(topology_id):
    data = request.get_json()

    device_type = data.get("type")
    name = data.get("name")
    x = data.get("x")
    y = data.get("y")

    if not all([device_type, name, x is not None, y is not None]):
        return jsonify({"error": "必要な情報が不足しています"}), 400

    try:
        x = float(x)
        y = float(y)
    except (ValueError, TypeError):
        return jsonify({"error": "座標が正しくありません"}), 400

    conn = get_db()

    topology = conn.execute(
        "SELECT id FROM topologies WHERE id = ?",
        (topology_id,)
    ).fetchone()

    if topology is None:
        conn.close()
        return jsonify({"error": "トポロジーが見つかりません"}), 404

    cursor = conn.execute(
        "INSERT INTO devices (topology_id, type, name, x, y) VALUES (?, ?, ?, ?, ?)",
        (topology_id, device_type, name, x, y)
    )
    conn.commit()
    device_id = cursor.lastrowid
    conn.close()

    return jsonify({"message": "登録しました", "device_id": device_id}), 201


# 機器の一覧を取得する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["GET"])
def get_devices(topology_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, topology_id, type, name, x, y FROM devices WHERE topology_id = ?",
        (topology_id,)
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


# 機器の位置を変更する
@devices_bp.route("/api/devices/<int:device_id>", methods=["PUT"])
def update_device(device_id):
    data = request.get_json()

    try:
        x = float(data.get("x"))
        y = float(data.get("y"))
    except (ValueError, TypeError):
        return jsonify({"error": "座標が正しくありません"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE devices SET x = ?, y = ? WHERE id = ?",
        (x, y, device_id)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "機器が見つかりません"}), 404

    return jsonify({"message": "位置を更新しました"})


# 機器を削除する
@devices_bp.route("/api/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM devices WHERE id = ?",
        (device_id,)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "機器が見つかりません"}), 404

    return jsonify({"message": "削除しました"})