(function (global) {
  const MAGIC = "GORKEM-HAZAN-VAULT-v1";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  async function deriveKey(password, saltB64, iterations) {
    const salt = b64ToBytes(saltB64);
    const material = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptBytes(key, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes)
    );
    return { iv: bytesToB64(iv), data: bytesToB64(cipher) };
  }

  async function decryptBytes(key, ivB64, dataB64) {
    const iv = b64ToBytes(ivB64);
    const data = b64ToBytes(dataB64);
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
    );
  }

  async function makeVerifier(key) {
    return encryptBytes(key, encoder.encode(MAGIC));
  }

  async function checkVerifier(key, verifier) {
    if (!verifier || !verifier.iv || !verifier.data) return "missing";
    try {
      const plain = decoder.decode(await decryptBytes(key, verifier.iv, verifier.data));
      return plain === MAGIC ? "ok" : "bad";
    } catch {
      return "bad";
    }
  }

  function randomSaltB64() {
    return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
  }

  global.VaultCrypto = {
    deriveKey,
    encryptBytes,
    decryptBytes,
    makeVerifier,
    checkVerifier,
    randomSaltB64,
    bytesToB64,
    b64ToBytes,
  };
})(window);
