"""
LSB Steganography Engine
========================
Hides text messages inside PNG/BMP images by modifying the
Least Significant Bit (LSB) of each RGB channel.

Bit layout stored in the image:
  [32-bit message length][message bytes in UTF-8]

Each pixel contributes 3 bits (one per R, G, B channel).
Maximum pixel value change: ±1  →  visually imperceptible.
"""

from PIL import Image

# Safety cap when decoding (prevents runaway on random images)
_MAX_DECODE_BYTES = 50_000
ALLOWED_FORMATS   = {"PNG", "BMP"}


# ── Bit utilities ────────────────────────────────────────────────────────────

def _int_to_bits(n: int, width: int) -> list:
    return [(n >> i) & 1 for i in range(width - 1, -1, -1)]


def _bits_to_int(bits: list) -> int:
    result = 0
    for b in bits:
        result = (result << 1) | b
    return result


# ── Public API ───────────────────────────────────────────────────────────────

def get_capacity(image: Image.Image) -> int:
    """Return maximum message size in characters for this image."""
    img = image.convert("RGB")
    w, h = img.size
    available_bits = w * h * 3 - 32          # subtract 32-bit header
    return max(0, available_bits // 8)


def encode(image: Image.Image, message: str) -> Image.Image:
    """
    Embed *message* into *image* using LSB steganography.
    Returns a new Image object (original is unchanged).
    Raises ValueError if the message is too long.
    """
    img       = image.convert("RGB")
    pixels    = list(img.getdata())
    w, h      = img.size
    capacity  = get_capacity(img)

    if not message:
        raise ValueError("Message cannot be empty.")
    if len(message.encode("utf-8")) > capacity:
        raise ValueError(
            f"Message too long. This image holds at most {capacity:,} characters."
        )

    msg_bytes = message.encode("utf-8")
    msg_len   = len(msg_bytes)

    # Build bit stream: 32-bit length header + message bits
    bits = _int_to_bits(msg_len, 32)
    for byte in msg_bytes:
        bits.extend(_int_to_bits(byte, 8))

    # Write bits into pixel LSBs
    new_pixels = []
    idx = 0
    for r, g, b in pixels:
        if idx < len(bits):
            r = (r & 0xFE) | bits[idx]; idx += 1
        if idx < len(bits):
            g = (g & 0xFE) | bits[idx]; idx += 1
        if idx < len(bits):
            b = (b & 0xFE) | bits[idx]; idx += 1
        new_pixels.append((r, g, b))

    result = Image.new("RGB", (w, h))
    result.putdata(new_pixels)
    return result


def decode(image: Image.Image) -> str:
    """
    Extract a hidden message from *image*.
    Raises ValueError if no valid message is found.
    """
    img    = image.convert("RGB")
    pixels = list(img.getdata())

    # Flatten all LSBs
    bits = []
    for r, g, b in pixels:
        bits.extend([r & 1, g & 1, b & 1])

    if len(bits) < 32:
        raise ValueError("Image is too small to contain a hidden message.")

    msg_len = _bits_to_int(bits[:32])

    if msg_len == 0:
        raise ValueError("No hidden message found in this image.")
    if msg_len > _MAX_DECODE_BYTES:
        raise ValueError(
            "No valid message found — image may not contain hidden data, "
            "or was saved in a lossy format (JPEG) which destroys LSB data."
        )

    end_bit = 32 + msg_len * 8
    if end_bit > len(bits):
        raise ValueError(
            "Incomplete message — image may be corrupted or was converted to JPEG."
        )

    msg_bytes = bytearray()
    for i in range(32, end_bit, 8):
        msg_bytes.append(_bits_to_int(bits[i : i + 8]))

    try:
        return msg_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError(
            "Decoded data is not valid text — "
            "this image does not appear to contain a steganographic message."
        )


def image_stats(image: Image.Image, message_len: int = 0) -> dict:
    """Return metadata dict for an image."""
    img  = image.convert("RGB")
    w, h = img.size
    cap  = get_capacity(img)
    bits_total = w * h * 3
    bits_used  = 32 + message_len * 8 if message_len else 0

    return {
        "width":          w,
        "height":         h,
        "mode":           image.mode,
        "pixels":         w * h,
        "capacity_chars": cap,
        "bits_total":     bits_total,
        "bits_used":      bits_used,
        "pixels_touched": (bits_used + 2) // 3 if bits_used else 0,
        "usage_pct":      round(bits_used / bits_total * 100, 4) if bits_used else 0,
    }
