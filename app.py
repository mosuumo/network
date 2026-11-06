from flask import Flask, render_template, request, jsonify
import sqlite3
import json

app = Flask(__name__)

if __name__ == "__main__":
    app.run(debug=True)

@app.route("/")
def index():
    return render_template("index.html")

