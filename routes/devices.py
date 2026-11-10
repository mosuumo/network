from flask import Blueprint, request, jsonify
from database import get_db
import math

# 機器に関するAPIをまとめるBlueprint
devices_bp = Blueprint("devices", __name__)


# 機器を登録する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["POST"])
def create_device(topology_id):
    # リクエストからJSONデータを取得する
    data = request.get_json(silent=True)

    # JSONデータが正しく送信されているか確認する
    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    device_type = data.get("type")
    name = data.get("name")
    x = data.get("x")
    y = data.get("y")

    # 機器の種類が対応しているか確認する
    if device_type not in ["PC", "SW", "Router"]:
        return jsonify({"error": "機器の種類が正しくありません"}), 400

    # 機器名が空欄でないことを確認する
    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "機器名が必要です"}), 400

    # 座標を数値に変換する
    try:
        x = float(x)
        y = float(y)
    except (ValueError, TypeError):
        return jsonify({"error": "座標が正しくありません"}), 400

    # NaNや無限大などの不正な数値を拒否する
    if not math.isfinite(x) or not math.isfinite(y):
        return jsonify({"error": "座標が正しくありません"}), 400

    conn = get_db()

    # 登録先のトポロジーが存在するか確認する
    topology = conn.execute(
        "SELECT id FROM topologies WHERE id = ?",
        (topology_id,)
    ).fetchone()

    if topology is None:
        conn.close()
        return jsonify({"error": "トポロジーが見つかりません"}), 404

    # 機器情報をデータベースに登録する
    cursor = conn.execute(
        "INSERT INTO devices (topology_id, type, name, x, y) VALUES (?, ?, ?, ?, ?)",
        (topology_id, device_type, name.strip(), x, y)
    )
    conn.commit()
    device_id = cursor.lastrowid
    conn.close()

    return jsonify({"message": "登録しました", "device_id": device_id}), 201


# 指定したトポロジーに登録されている機器を取得する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["GET"])
def get_devices(topology_id):
    conn = get_db()

    # トポロジーIDを指定して機器情報を取得する
    rows = conn.execute(
        "SELECT id, topology_id, type, name, x, y FROM devices WHERE topology_id = ?",
        (topology_id,)
    ).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


# 機器の位置を変更する
@devices_bp.route("/api/devices/<int:device_id>", methods=["PUT"])
def update_device(device_id):
    # リクエストからJSONデータを取得する
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    # 新しい座標を数値に変換する
    try:
        x = float(data.get("x"))
        y = float(data.get("y"))
    except (ValueError, TypeError):
        return jsonify({"error": "座標が正しくありません"}), 400

    # NaNや無限大などの不正な数値を拒否する
    if not math.isfinite(x) or not math.isfinite(y):
        return jsonify({"error": "座標が正しくありません"}), 400

    conn = get_db()

    # 指定した機器の座標を更新する
    cursor = conn.execute(
        "UPDATE devices SET x = ?, y = ? WHERE id = ?",
        (x, y, device_id)
    )
    conn.commit()
    conn.close()

    # 更新対象の機器が存在しなかった場合
    if cursor.rowcount == 0:
        return jsonify({"error": "機器が見つかりません"}), 404

    return jsonify({"message": "位置を更新しました"})


# 機器を削除する
@devices_bp.route("/api/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    conn = get_db()

    # 指定した機器をデータベースから削除する
    cursor = conn.execute(
        "DELETE FROM devices WHERE id = ?",
        (device_id,)
    )
    conn.commit()
    conn.close()

    # 削除対象の機器が存在しなかった場合
    if cursor.rowcount == 0:
        return jsonify({"error": "機器が見つかりません"}), 404

    return jsonify({"message": "削除しました"})