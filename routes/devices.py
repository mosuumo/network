
from flask import Blueprint, request, jsonify
from database import get_db
import math
import json

# 機器に関する処理をまとめるBlueprint
devices_bp = Blueprint("devices", __name__)


# 機器を登録する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["POST"])
def create_device(topology_id):
    # リクエストからJSONデータを取得する
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    device_type = data.get("type")
    name = data.get("name")
    x = data.get("x")
    y = data.get("y")
    details = data.get("details", {})

    # 機器の種類を確認する
    if device_type not in ["PC", "SW", "Router"]:
        return jsonify({"error": "機器の種類が正しくありません"}), 400

    # 機器名が空欄でないことを確認する
    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "機器名が必要です"}), 400

    # 詳細情報は辞書形式で受け取る
    if not isinstance(details, dict):
        return jsonify({"error": "詳細情報が正しくありません"}), 400

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

    # 機器の基本情報と詳細情報を保存する
    cursor = conn.execute(
        """INSERT INTO devices
        (topology_id, type, name, x, y, details)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (
            topology_id,
            device_type,
            name.strip(),
            x,
            y,
            json.dumps(details, ensure_ascii=False)
        )
    )

    conn.commit()
    device_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "登録しました",
        "device_id": device_id
    }), 201


# 指定したトポロジーの機器一覧を取得する
@devices_bp.route("/api/topologies/<int:topology_id>/devices", methods=["GET"])
def get_devices(topology_id):
    conn = get_db()

    # トポロジーに登録されている機器を取得する
    rows = conn.execute(
        """SELECT id, topology_id, type, name, x, y, details
        FROM devices WHERE topology_id = ?""",
        (topology_id,)
    ).fetchall()

    conn.close()

    # JSON文字列で保存した詳細情報を辞書に戻す
    devices = []
    for row in rows:
        device = dict(row)
        device["details"] = json.loads(device["details"])
        devices.append(device)

    return jsonify(devices)


# 機器の座標や詳細情報を更新する
@devices_bp.route("/api/devices/<int:device_id>", methods=["PUT"])
def update_device(device_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "正しいJSONデータが必要です"}), 400

    conn = get_db()

    # 更新対象の機器が存在するか確認する
    device = conn.execute(
        "SELECT id FROM devices WHERE id = ?",
        (device_id,)
    ).fetchone()

    if device is None:
        conn.close()
        return jsonify({"error": "機器が見つかりません"}), 404

    updates = []
    values = []

    # 座標が送信された場合は数値を確認して更新する
    if "x" in data or "y" in data:
        try:
            x = float(data.get("x"))
            y = float(data.get("y"))
        except (ValueError, TypeError):
            conn.close()
            return jsonify({"error": "座標が正しくありません"}), 400

        if not math.isfinite(x) or not math.isfinite(y):
            conn.close()
            return jsonify({"error": "座標が正しくありません"}), 400

        updates.extend(["x = ?", "y = ?"])
        values.extend([x, y])

    # 詳細情報が送信された場合はJSON文字列に変換する
    if "details" in data:
        if not isinstance(data["details"], dict):
            conn.close()
            return jsonify({"error": "詳細情報が正しくありません"}), 400

        updates.append("details = ?")
        values.append(
            json.dumps(data["details"], ensure_ascii=False)
        )

    # 更新する項目がなければエラーにする
    if not updates:
        conn.close()
        return jsonify({"error": "更新する情報がありません"}), 400

    # 指定された項目だけを更新する
    values.append(device_id)
    conn.execute(
        f"UPDATE devices SET {', '.join(updates)} WHERE id = ?",
        values
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "機器情報を更新しました"})


# 機器を削除する
@devices_bp.route("/api/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    conn = get_db()

    # 指定した機器を削除する
    cursor = conn.execute(
        "DELETE FROM devices WHERE id = ?",
        (device_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "機器が見つかりません"}), 404

    return jsonify({"message": "削除しました"})