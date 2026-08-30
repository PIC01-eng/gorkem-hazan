(function () {
  const filesInput = document.getElementById("files");
  const fileList = document.getElementById("file-list");
  const errorEl = document.getElementById("admin-error");
  let chosen = [];

  filesInput.addEventListener("change", () => {
    chosen = Array.from(filesInput.files || []);
    fileList.innerHTML = chosen
      .map((f) => `<li>${f.name} · ${(f.size / 1024).toFixed(0)} KB</li>`)
      .join("");
  });

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Mevcut arşiv okunamadı");
    return res.json();
  }

  function download(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  document.getElementById("admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const password = document.getElementById("password").value;
    if (!chosen.length) {
      errorEl.textContent = "En az bir fotoğraf seçin.";
      return;
    }
    if (typeof JSZip === "undefined") {
      errorEl.textContent = "Zip kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.";
      return;
    }

    try {
      const config = await loadJson("data/config.json");
      const manifest = await loadJson("data/manifest.json");
      const key = await VaultCrypto.deriveKey(
        password,
        config.salt,
        config.iterations || 210000
      );
      const status = await VaultCrypto.checkVerifier(key, config.verifier);
      if (status === "bad") {
        errorEl.textContent = "Şifre, mevcut arşivle uyuşmuyor.";
        return;
      }
      if (status === "missing") {
        config.verifier = await VaultCrypto.makeVerifier(key);
      }

      if (!Array.isArray(manifest.photos)) manifest.photos = [];

      for (const file of chosen) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const enc = await VaultCrypto.encryptBytes(key, buf);
        manifest.photos.push({
          id: crypto.randomUUID(),
          mime: file.type || "image/jpeg",
          name: file.name,
          addedAt: new Date().toISOString(),
          iv: enc.iv,
          data: enc.data,
        });
      }

      const zip = new JSZip();
      zip.file("data/config.json", JSON.stringify(config, null, 2));
      zip.file("data/manifest.json", JSON.stringify(manifest));
      const blob = await zip.generateAsync({ type: "blob" });
      download("gorkem-hazan-sifreli.zip", blob);
    } catch (err) {
      errorEl.textContent = err.message || "Şifreleme başarısız.";
    }
  });
})();
