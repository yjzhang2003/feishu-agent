from flask import Flask, jsonify, request

app = Flask(__name__)


@app.route("/")
def index():
    return jsonify({"status": "ok"})


@app.route("/divide")
def divide():
    """Bug 1: ZeroDivisionError when b=0."""
    a = int(request.args.get("a", 0))
    b = int(request.args.get("b", 1))
    result = a / b  # BUG: no zero check
    return jsonify({"result": result})


@app.route("/user")
def get_user():
    """Bug 2: KeyError when 'name' is missing."""
    users = {"alice": {"age": 30}, "bob": {"name": "Bob", "age": 25}}
    user_id = request.args.get("id", "alice")
    user = users.get(user_id, {})
    return jsonify({"name": user["name"], "age": user["age"]})  # BUG: KeyError if name missing


@app.route("/concat")
def concat():
    """Bug 3: TypeError when trying to concatenate str and int."""
    prefix = request.args.get("prefix", "Hello ")
    num = int(request.args.get("num", 42))
    result = prefix + num  # BUG: can't concat str + int
    return jsonify({"result": result})


@app.route("/add")
def add():
    """Correct endpoint."""
    a = int(request.args.get("a", 0))
    b = int(request.args.get("b", 0))
    return jsonify({"result": a + b})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
