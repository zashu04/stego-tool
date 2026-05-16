# 🔐 StegoVault — LSB Image Steganography Tool

A cybersecurity web application that hides and reveals secret text messages inside images using **LSB (Least Significant Bit) steganography**. Built with **Python** and **Flask**, powered by **Pillow** for image processing.

---

## What is Steganography?

**Steganography** is the practice of hiding secret information within an ordinary, non-secret file so that the existence of the hidden message is concealed. Unlike encryption, which makes data unreadable, steganography makes it *invisible*.

This tool implements **spatial domain LSB steganography** — one of the most fundamental and widely studied techniques in the field.

---

## How LSB Steganography Works

### 1. Every pixel has 3 colour channels

Each pixel in an RGB image stores three 8-bit integers — Red, Green, and Blue — each ranging from 0 to 255.

```
Pixel example:  R=182  G=156  B=239
Binary:         10110110  10011100  11101111
```

### 2. The Least Significant Bit has minimal visual impact

Changing the last bit of a value shifts it by only ±1 — completely imperceptible to the human eye.

```
Original R:  1011011[0]  =  182
Modified R:  1011011[1]  =  183   ← difference: 1 (invisible)
```

### 3. Encode the message bit by bit

The message is first converted to binary (UTF-8 encoding). A 32-bit integer header stores the message length, followed by all message bits — one bit per channel (R, G, B), three bits per pixel.

```
Message format:
[32-bit length header] [message bytes in UTF-8]

Each pixel stores:  R_LSB | G_LSB | B_LSB  (3 bits)
```

### 4. Decode by reading LSBs in order

To extract the message, read the LSB from each channel in sequence. The first 32 bits give the message byte count; the next `length × 8` bits reconstruct the original text.

### Capacity Formula

```
max_characters = (width × height × 3 − 32) ÷ 8
```

| Image Size  | Max Characters |
|-------------|---------------|
| 100 × 100   | ~3,748         |
| 500 × 500   | ~93,747        |
| 800 × 600   | ~180,000       |
| 1920 × 1080 | ~777,599       |

### Why PNG / BMP only?

JPEG uses **lossy compression** which modifies pixel values — this destroys the LSB data. PNG and BMP use **lossless** formats that preserve exact pixel values.

---

## Features

- **Encode** — Hide any text message inside a PNG or BMP image
- **Decode** — Extract a hidden message from an encoded image
- **Side-by-side comparison** — Original vs encoded image (visually identical)
- **Metadata dashboard** — Dimensions, capacity, bits used, pixels modified, file sizes
- **Capacity meter** — Live indicator showing how much of the image is used
- **Download** — Save the encoded image as PNG
- **LSB explainer** — Built-in visual guide to how the technique works
- **Drag-and-drop upload** — Modern file upload UX

---

## Project Structure

```
stego-tool/
├── app.py              # Flask web server & API routes
├── stego.py            # LSB encode/decode engine
├── requirements.txt    # Python dependencies
├── README.md           # This file
├── templates/
│   └── index.html      # Web interface (Encode + Decode tabs)
└── static/
    ├── style.css       # Purple dark theme
    └── script.js       # Drag-drop, preview, capacity meter
```

---

## Installation & Setup

### Prerequisites
- Python 3.8+
- pip

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/stegovault.git
cd stegovault
```

**2. Create a virtual environment**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Run the app**
```bash
python app.py
```

**5. Open your browser**
```
http://localhost:5003
```

---

## API Reference

### `POST /encode`

Hides a message inside an image.

**Request:** `multipart/form-data`
- `image` — PNG or BMP file
- `message` — text string

**Response:**
```json
{
  "original_b64": "<base64 PNG>",
  "encoded_b64":  "<base64 PNG>",
  "metadata": {
    "format": "PNG",
    "width": 800,
    "height": 600,
    "mode": "RGB",
    "pixels": 480000,
    "capacity_chars": 179999,
    "message_length": 42,
    "bits_used": 368,
    "bits_total": 1440000,
    "pixels_touched": 123,
    "usage_pct": 0.0256,
    "original_kb": 245.3,
    "encoded_kb": 312.1
  }
}
```

### `POST /decode`

Extracts a hidden message from an image.

**Request:** `multipart/form-data`
- `image` — PNG or BMP file (must have been encoded by StegoVault)

**Response:**
```json
{
  "message": "Your secret message here",
  "metadata": { ... }
}
```

---

## Technologies Used

| Layer    | Technology             |
|----------|------------------------|
| Backend  | Python 3, Flask        |
| Image    | Pillow (PIL)           |
| Frontend | HTML5, CSS3, JS (ES6+) |
| Fonts    | Inter, JetBrains Mono  |

---

## Limitations

- Max message size limited to 50,000 bytes for safety on decode
- Only PNG and BMP formats supported (lossless only)
- Output is always saved as PNG (BMP inputs are converted)
- This is a basic spatial-domain LSB implementation — detectable by steganalysis tools such as StegExpose. For real covert communication, use more advanced techniques.

---

## Further Reading

- [Steganography — Wikipedia](https://en.wikipedia.org/wiki/Steganography)
- [LSB Insertion Method](https://www.garykessler.net/library/steganography.html)
- [StegExpose — LSB steganalysis tool](https://github.com/b3dk7/StegExpose)

---

## License

MIT License — free to use, modify, and distribute for educational purposes.
