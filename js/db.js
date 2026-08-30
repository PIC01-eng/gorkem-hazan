(function (global) {
  const NAME = "gorkem-hazan";
  const VERSION = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("photos")) {
          db.createObjectStore("photos", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function getConfig() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("meta").objectStore("meta").get("config");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function setConfig(config) {
    const db = await openDb();
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(config, "config");
    await txDone(tx);
  }

  async function listPhotos() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("photos").objectStore("photos").getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => (a.addedAt || "").localeCompare(b.addedAt || ""));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function putPhoto(photo) {
    const db = await openDb();
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put(photo);
    await txDone(tx);
  }

  async function deletePhoto(id) {
    const db = await openDb();
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(id);
    await txDone(tx);
  }

  global.VaultDB = { getConfig, setConfig, listPhotos, putPhoto, deletePhoto };
})(window);
