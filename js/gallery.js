(function () {
  const lockEl = document.getElementById("lock");
  const galleryEl = document.getElementById("gallery");
  const gridEl = document.getElementById("grid");
  const emptyEl = document.getElementById("empty");
  const errorEl = document.getElementById("lock-error");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const objectUrls = [];

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Veri okunamadı");
    return res.json();
  }

  function lock() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.length = 0;
    gridEl.innerHTML = "";
    lockEl.classList.remove("hidden");
    galleryEl.classList.add("hidden");
    document.getElementById("password").value = "";
  }

  async function unlock(password) {
    errorEl.textContent = "";
    const config = await loadJson("data/config.json");
    const manifest = await loadJson("data/manifest.json");
    const key = await VaultCrypto.deriveKey(
      password,
      config.salt,
      config.iterations || 210000
    );
    const status = await VaultCrypto.checkVerifier(key, config.verifier);
    if (status === "missing" && (!manifest.photos || manifest.photos.length === 0)) {
      errorEl.textContent = "Önce admin sayfasından şifre belirleyip fotoğraf ekleyin.";
      return;
    }
    if (status === "bad") {
      errorEl.textContent = "Şifre yanlış.";
      return;
    }

    lockEl.classList.add("hidden");
    galleryEl.classList.remove("hidden");

    if (!manifest.photos || manifest.photos.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    for (const photo of manifest.photos) {
      try {
        const bytes = await VaultCrypto.decryptBytes(key, photo.iv, photo.data);
        const blob = new Blob([bytes], { type: photo.mime || "image/jpeg" });
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        const card = document.createElement("button");
        card.className = "card";
        card.type = "button";
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        card.appendChild(img);
        card.addEventListener("click", () => {
          lightboxImg.src = url;
          lightbox.classList.remove("hidden");
        });
        gridEl.appendChild(card);
      } catch {
        errorEl.textContent = "Bazı fotoğraflar açılamadı. Şifre veya dosyalar bozulmuş olabilir.";
      }
    }
  }

  document.getElementById("unlock-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;
    unlock(password).catch(() => {
      errorEl.textContent = "Galeri yüklenemedi.";
    });
  });

  document.getElementById("lock-again").addEventListener("click", lock);
  lightbox.addEventListener("click", () => {
    lightbox.classList.add("hidden");
    lightboxImg.src = "";
  });
})();
