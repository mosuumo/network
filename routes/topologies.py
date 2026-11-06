from flask import Blueprint, request, jsonify
from database import get_db

topologies_bp = Blueprint("topologies", __name__)


# トポロジーを保存する
@topologies_bp.route("/api/topologies", methods=["POST"])
def create_topology():
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"error": "トポロジー名が必要です"}), 400

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO topologies (name) VALUES (?)",
        (name,)
    )
    conn.commit()
    topology_id = cursor.lastrowid
    conn.close()

    return jsonify({"message": "保存しました", "topology_id": topology_id}), 201


# トポロジーの一覧を取得する
@topologies_bp.route("/api/topologies", methods=["GET"])
def get_topologies():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, created_at FROM topologies"
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


# トポロジーの詳細を取得する
@topologies_bp.route("/api/topologies/<int:topology_id>", methods=["GET"])
def get_topology(topology_id):
    conn = get_db()

    topology = conn.execute(
        "SELECT * FROM topologies WHERE id = ?",
        (topology_id,)
    ).fetchone()

    if topology is None:
        conn.close()
        return jsonify({"error": "見つかりません"}), 404

    devices = conn.execute(
        "SELECT id, type, name, x, y FROM devices WHERE topology_id = ?",
        (topology_id,)
    ).fetchall()

    connections = conn.execute(
        "SELECT id, source_device_id, target_device_id FROM connections WHERE topology_id = ?",
        (topology_id,)
    ).fetchall()

    conn.close()

    return jsonify({
        "id": topology["id"],
        "name": topology["name"],
        "created_at": topology["created_at"],
        "devices": [dict(row) for row in devices],
        "connections": [dict(row) for row in connections]
    })


# トポロジーを削除する
@topologies_bp.route("/api/topologies/<int:topology_id>", methods=["DELETE"])
def delete_topology(topology_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM topologies WHERE id = ?",
        (topology_id,)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "見つかりません"}), 404

    return jsonify({"message": "削除しました"})