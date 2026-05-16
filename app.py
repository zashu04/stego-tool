import io
import math
import base64

from flask import Flask, render_template, request, jsonify
from PIL import Image, UnidentifiedImageError

from stego import encode, decode, get_capacity, image_stats, ALLOWED_FORMATS

app = Flask(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB


def _img_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _open_image(file_storage):
    raw = file_storage.read()
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError("File too large (max 10 MB).")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except UnidentifiedImageError:
        raise ValueError("Could not read image — please upload a PNG or BMP file.")
    if img.format and img.format not in ALLOWED_FORMATS:
        raise ValueError(
            f"Unsupported format '{img.format}'. Please use PNG or BMP. "
            "JPEG cannot be used because it is lossy and destroys hidden data."
        )
    return img, raw


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/encode", methods=["POST"])
def encode_route():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded."}), 400

    message = request.form.get("message", "").strip()
    if not message:
        return jsonify({"error": "No secret message provided."}), 400

    try:
        orig_img, orig_raw = _open_image(request.files["image"])
        encoded_img = encode(orig_img, message)

        enc_buf = io.BytesIO()
        encoded_img.save(enc_buf, format="PNG")
        enc_raw = enc_buf.getvalue()

        stats = image_stats(orig_img, len(message.encode("utf-8")))

        return jsonify({
            "original_b64": _img_to_b64(orig_img.convert("RGB")),
            "encoded_b64":  base64.b64encode(enc_raw).decode(),
            "metadata": {
                "format":          orig_img.format or "PNG",
                "width":           stats["width"],
                "height":          stats["height"],
                "mode":            stats["mode"],
                "pixels":          stats["pixels"],
                "capacity_chars":  stats["capacity_chars"],
                "message_length":  len(message),
                "bits_used":       stats["bits_used"],
                "bits_total":      stats["bits_total"],
                "pixels_touched":  stats["pixels_touched"],
                "usage_pct":       stats["usage_pct"],
                "original_kb":     round(len(orig_raw) / 1024, 1),
                "encoded_kb":      round(len(enc_raw) / 1024, 1),
            },
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.route("/decode", methods=["POST"])
def decode_route():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded."}), 400

    try:
        img, raw = _open_image(request.files["image"])
        message  = decode(img)
        stats    = image_stats(img)

        return jsonify({
            "message": message,
            "metadata": {
                "format":         img.format or "PNG",
                "width":          stats["width"],
                "height":         stats["height"],
                "mode":           stats["mode"],
                "pixels":         stats["pixels"],
                "capacity_chars": stats["capacity_chars"],
                "file_kb":        round(len(raw) / 1024, 1),
            },
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5003)
