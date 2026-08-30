(function () {
  const lockEl = document.getElementById("lock");
  const galleryEl = document.getElementById("gallery");
  const gridEl = document.getElementById("grid");
  const emptyEl = document.getElementById("empty");
  const errorEl = document.getElementById("lock-error");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const confirmWrap = document.getElementById("confirm-wrap");
  const lockCopy = document.getElementById("lock-copy");
  const filesInput = document.getElementById("add-files");
  const objectUrls = [];
  let currentKey = null;
  let setupMode = false;

  function revokeAll() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.length = 0;
  }

  function setEmpty(isEmpty) {
    emptyEl.classList.toggle("hidden", !isEmpty);
  }

  function addCard(url, id) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = id;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.addEventListener("click", () => {
      lightboxImg.src = url;
      lightbox.classList.remove("hidden");
    });
    const del = document.createElement("button");
    del.className = "card-del";
    del.type = "button";
    del.textContent = "Sil";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      await VaultDB.deletePhoto(id);
      card.remove();
      setEmpty(gridEl.children.length === 0);
    });
    card.append(img, del);
    gridEl.appendChild(card);
  }

  async function showPhoto(photo, key) {
    const bytes = await VaultCrypto.decryptBytes(key, photo.iv, photo.data);
    const blob = new Blob([bytes], { type: photo.mime || "image/jpeg" });
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    addCard(url, photo.id);
  }

  async function renderGallery(key) {
    revokeAll();
    gridEl.innerHTML = "";
    const photos = await VaultDB.listPhotos();
    setEmpty(photos.length === 0);
    for (const photo of photos) {
      try {
        await showPhoto(photo, key);
      } catch {
        errorEl.textContent = "Bazı fotoğraflar açılamadı.";
      }
    }
  }

  function lock() {
    currentKey = null;
    revokeAll();
    gridEl.innerHTML = "";
    lockEl.classList.remove("hidden");
    galleryEl.classList.add("hidden");
    document.getElementById("password").value = "";
    document.getElementById("password2").value = "";
  }

  async function unlock(password, password2) {
    errorEl.textContent = "";
    if (password.length < 6) {
      errorEl.textContent = "Şifre en az 6 karakter olsun.";
      return;
    }

    let config = await VaultDB.getConfig();

    if (setupMode || !config || !config.verifier) {
      if (password !== password2) {
        errorEl.textContent = "Şifreler aynı değil.";
        return;
      }
      config = {
        salt: VaultCrypto.randomSaltB64(),
        iterations: 210000,
        verifier: null,
      };
      const key = await VaultCrypto.deriveKey(password, config.salt, config.iterations);
      config.verifier = await VaultCrypto.makeVerifier(key);
      await VaultDB.setConfig(config);
      currentKey = key;
    } else {
      const key = await VaultCrypto.deriveKey(
        password,
        config.salt,
        config.iterations || 210000
      );
      const status = await VaultCrypto.checkVerifier(key, config.verifier);
      if (status !== "ok") {
        errorEl.textContent = "Şifre yanlış.";
        return;
      }
      currentKey = key;
    }

    lockEl.classList.add("hidden");
    galleryEl.classList.remove("hidden");
    await renderGallery(currentKey);
  }

  async function addFiles(fileList) {
    if (!currentKey || !fileList.length) return;
    for (const file of fileList) {
      if (!file.type.startsWith("image/")) continue;
      const buf = new Uint8Array(await file.arrayBuffer());
      const enc = await VaultCrypto.encryptBytes(currentKey, buf);
      const photo = {
        id: crypto.randomUUID(),
        mime: file.type || "image/jpeg",
        name: file.name,
        addedAt: new Date().toISOString(),
        iv: enc.iv,
        data: enc.data,
      };
      await VaultDB.putPhoto(photo);
      await showPhoto(photo, currentKey);
    }
    setEmpty(gridEl.children.length === 0);
    filesInput.value = "";
  }

  async function init() {
    const config = await VaultDB.getConfig();
    setupMode = !config || !config.verifier;
    confirmWrap.classList.toggle("hidden", !setupMode);
    lockCopy.textContent = setupMode
      ? "İlk açılış: bir şifre belirleyin. Fotoğraflar bu tarayıcıda kalır, GitHub’a gitmez."
      : "Fotoğraflar bu cihazda, şifreli olarak durur. GitHub’a gönderilmez.";
  }

  document.getElementById("unlock-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;
    unlock(password, password2).catch(() => {
      errorEl.textContent = "Galeri açılamadı.";
    });
  });

  document.getElementById("lock-again").addEventListener("click", lock);
  document.getElementById("add-btn").addEventListener("click", () => filesInput.click());
  filesInput.addEventListener("change", () => addFiles(Array.from(filesInput.files || [])));

  lightbox.addEventListener("click", () => {
    lightbox.classList.add("hidden");
    lightboxImg.src = "";
  });

  init().catch(() => {
    errorEl.textContent = "Tarayıcı deposu açılamadı.";
  });
})();
