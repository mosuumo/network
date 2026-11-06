from flask import Flask, render_template, request, jsonify
import sqlite3
import json

app = Flask(__name__)

@app.route("")
def app():
    return