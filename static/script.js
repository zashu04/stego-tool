/* ── Helpers ────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function showToast() {
  const t = $("copy-toast");
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

function loadingBtns(btn, textEl, loading) {
  btn.disabled = loading;
  textEl.innerHTML = loading
    ? `<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span> Processing…`
    : textEl.dataset.default;
}

function fmtNum(n) { return Number(n).toLocaleString(); }

/* ── Tabs ───────────────────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ── Generic drop-zone setup ────────────────────────────────────────────── */
function setupDropZone({ dropId, fileId, previewId, previewWrapId, labelId, removeId, onFile }) {
  const drop    = $(dropId);
  const input   = $(fileId);
  const preview = $(previewId);
  const wrap    = $(previewWrapId);
  const label   = $(labelId);
  const remove  = $(removeId);

  drop.addEventListener("click", () => input.click());

  drop.addEventListener("dragover", e => {
    e.preventDefault();
    drop.classList.add("drag-over");
  });

  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));

  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  remove.addEventListener("click", () => {
    input.value = "";
    wrap.style.display  = "none";
    drop.style.display  = "flex";
    onFile(null);
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      label.textContent = `${file.name}  ·  ${(file.size / 1024).toFixed(1)} KB`;
      drop.style.display = "none";
      wrap.style.display = "flex";
      onFile(file);
    };
    reader.readAsDataURL(file);
  }
}

/* ── State ──────────────────────────────────────────────────────────────── */
let encFile   = null;
let decFile   = null;
let encCapacity = 0;          // chars
let encodedB64  = null;       // for download

/* ── Encode drop-zone ───────────────────────────────────────────────────── */
setupDropZone({
  dropId:       "enc-drop",
  fileId:       "enc-file",
  previewId:    "enc-preview",
  previewWrapId:"enc-preview-wrap",
  labelId:      "enc-preview-label",
  removeId:     "enc-remove",
  onFile: file => {
    encFile = file;
    if (file) {
      fetchCapacity(file);
    } else {
      encCapacity = 0;
      updateCapacityUI();
    }
    updateEncodeBtn();
  }
});

/* ── Fetch image capacity from server (via a quick encode probe) ── */
async function fetchCapacity(file) {
  // Estimate locally using Image element (no server call needed)
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    encCapacity = Math.floor((img.width * img.height * 3 - 32) / 8);
    URL.revokeObjectURL(url);
    updateCapacityUI();
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

/* ── Capacity bar updates ───────────────────────────────────────────────── */
function updateCapacityUI() {
  const msg    = $("enc-message").value;
  const chars  = msg.length;
  const capEl  = $("cap-text");
  const countEl= $("char-count");
  const barEl  = $("cap-bar");

  countEl.textContent = `${fmtNum(chars)} chars`;

  if (encCapacity === 0) {
    capEl.textContent = "Select an image to see capacity";
    barEl.style.width = "0%";
    barEl.style.background = "var(--safe)";
    return;
  }

  capEl.textContent = `Capacity: ${fmtNum(encCapacity)} chars`;

  const pct = Math.min(100, (chars / encCapacity) * 100);
  barEl.style.width = pct + "%";

  if (pct > 90)      barEl.style.background = "var(--danger)";
  else if (pct > 60) barEl.style.background = "var(--warn)";
  else               barEl.style.background = "var(--safe)";
}

$("enc-message").addEventListener("input", () => {
  updateCapacityUI();
  updateEncodeBtn();
});

function updateEncodeBtn() {
  const hasFile = !!encFile;
  const hasMsg  = $("enc-message").value.trim().length > 0;
  $("encode-btn").disabled = !(hasFile && hasMsg);
}

/* ── Encode ─────────────────────────────────────────────────────────────── */
const encBtn     = $("encode-btn");
const encBtnText = $("encode-btn-text");
encBtnText.dataset.default = "🔒 Hide Message in Image";

encBtn.addEventListener("click", async () => {
  const message = $("enc-message").value.trim();
  if (!encFile || !message) return;

  loadingBtns(encBtn, encBtnText, true);
  $("enc-error").style.display = "none";
  $("enc-result-col").style.display = "none";

  const form = new FormData();
  form.append("image", encFile);
  form.append("message", message);

  try {
    const res  = await fetch("/encode", { method: "POST", body: form });
    const data = await res.json();

    if (data.error) {
      $("enc-error").textContent = "⚠ " + data.error;
      $("enc-error").style.display = "block";
    } else {
      encodedB64 = data.encoded_b64;
      renderEncodeResult(data);
    }
  } catch {
    $("enc-error").textContent = "⚠ Network error — is the server running?";
    $("enc-error").style.display = "block";
  } finally {
    loadingBtns(encBtn, encBtnText, false);
  }
});

function renderEncodeResult(data) {
  const m = data.metadata;

  $("cmp-original").src = "data:image/png;base64," + data.original_b64;
  $("cmp-encoded").src  = "data:image/png;base64," + data.encoded_b64;

  const usagePct = m.usage_pct < 0.01 ? "<0.01" : m.usage_pct;
  $("usage-bar").style.width = Math.max(0.3, m.usage_pct) + "%";
  $("usage-pct").textContent = usagePct + "%";

  $("enc-meta-grid").innerHTML = buildMetaGrid([
    { k: "Format",           v: m.format },
    { k: "Dimensions",       v: `${m.width} × ${m.height} px` },
    { k: "Mode",             v: m.mode },
    { k: "Total Pixels",     v: fmtNum(m.pixels) },
    { k: "Capacity",         v: `${fmtNum(m.capacity_chars)} chars` },
    { k: "Message Length",   v: `${fmtNum(m.message_length)} chars`, cls: "accent" },
    { k: "Pixels Modified",  v: fmtNum(m.pixels_touched) },
    { k: "Bits Used / Total",v: `${fmtNum(m.bits_used)} / ${fmtNum(m.bits_total)}` },
    { k: "Original Size",    v: `${m.original_kb} KB` },
    { k: "Encoded Size",     v: `${m.encoded_kb} KB` },
  ]);

  $("enc-result-col").style.display = "flex";
  $("enc-result-col").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ── Download encoded image ─────────────────────────────────────────────── */
$("download-btn").addEventListener("click", () => {
  if (!encodedB64) return;
  const a = document.createElement("a");
  a.href     = "data:image/png;base64," + encodedB64;
  a.download = "stego_encoded.png";
  a.click();
});

/* ── Decode drop-zone ───────────────────────────────────────────────────── */
setupDropZone({
  dropId:       "dec-drop",
  fileId:       "dec-file",
  previewId:    "dec-preview",
  previewWrapId:"dec-preview-wrap",
  labelId:      "dec-preview-label",
  removeId:     "dec-remove",
  onFile: file => {
    decFile = file;
    $("decode-btn").disabled = !file;
    $("dec-result-col").style.display = "none";
  }
});

/* ── Decode ─────────────────────────────────────────────────────────────── */
const decBtn     = $("decode-btn");
const decBtnText = $("decode-btn-text");
decBtnText.dataset.default = "🔓 Reveal Hidden Message";

decBtn.addEventListener("click", async () => {
  if (!decFile) return;

  loadingBtns(decBtn, decBtnText, true);
  $("dec-error").style.display = "none";
  $("dec-result-col").style.display = "none";

  const form = new FormData();
  form.append("image", decFile);

  try {
    const res  = await fetch("/decode", { method: "POST", body: form });
    const data = await res.json();

    if (data.error) {
      $("dec-error").textContent = "⚠ " + data.error;
      $("dec-error").style.display = "block";
    } else {
      renderDecodeResult(data);
    }
  } catch {
    $("dec-error").textContent = "⚠ Network error — is the server running?";
    $("dec-error").style.display = "block";
  } finally {
    loadingBtns(decBtn, decBtnText, false);
  }
});

function renderDecodeResult(data) {
  const m = data.metadata;

  $("decoded-message").textContent = data.message;

  $("dec-meta-grid").innerHTML = buildMetaGrid([
    { k: "Format",       v: m.format },
    { k: "Dimensions",   v: `${m.width} × ${m.height} px` },
    { k: "Mode",         v: m.mode },
    { k: "Total Pixels", v: fmtNum(m.pixels) },
    { k: "Capacity",     v: `${fmtNum(m.capacity_chars)} chars` },
    { k: "File Size",    v: `${m.file_kb} KB` },
  ]);

  $("dec-result-col").style.display = "flex";
  $("dec-result-col").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ── Copy decoded message ───────────────────────────────────────────────── */
$("copy-msg-btn").addEventListener("click", async () => {
  const text = $("decoded-message").textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
  showToast();
});

/* ── Metadata grid builder ──────────────────────────────────────────────── */
function buildMetaGrid(items) {
  return items.map(({ k, v, cls }) => `
    <div class="meta-item">
      <span class="meta-key">${k}</span>
      <span class="meta-val ${cls || ""}">${v}</span>
    </div>`).join("");
}
