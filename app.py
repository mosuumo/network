from flask import Flask, render_template
from database import init_db
from routes.topologies import topologies_bp
from routes.devices import devices_bp
from routes.connections import connections_bp

# Flaskアプリケーションを作成する
app = Flask(__name__)

# データベースを初期化する
init_db()

# 各APIのルートを登録する
app.register_blueprint(topologies_bp)
app.register_blueprint(devices_bp)
app.register_blueprint(connections_bp)


# トップページを表示する
@app.route("/")
def index():
    return render_template("index.html")


# アプリケーションを起動する
if __name__ == "__main__":
    app.run(debug=True)