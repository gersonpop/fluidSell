/**
 * Lightweight, synchronous RC4-based stream cipher.
 * Works on both Client and Server (SSR safe).
 */
function rc4(key: string, str: string): string {
  const s: number[] = [];
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key.charCodeAt(i % key.length)) % 256;
    const temp = s[i]!;
    s[i] = s[j]!;
    s[j] = temp;
  }
  let i = 0;
  j = 0;
  let res = "";
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]!) % 256;
    const temp = s[i]!;
    s[i] = s[j]!;
    s[j] = temp;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i]! + s[j]!) % 256]!);
  }
  return res;
}

const DEFAULT_SALT = "fluidsell_secure_local_storage_default_salt_2026";

/**
 * Derives a key by combining the system salt and an optional user identifier (actorId).
 */
function deriveKey(actorId?: string | null): string {
  const userKey = actorId ? String(actorId).trim() : "";
  return `${DEFAULT_SALT}-${userKey}`;
}

/**
 * Encrypts any JS data structure into an encrypted Base64 string.
 */
export function encryptLocalData(data: unknown, actorId?: string | null): string {
  try {
    const rawString = JSON.stringify(data);
    const key = deriveKey(actorId);
    const encrypted = rc4(key, rawString);
    // Base64 encoding that is safe for unicode characters
    return btoa(unescape(encodeURIComponent(encrypted)));
  } catch (error) {
    console.error("Encryption error:", error);
    return "";
  }
}

/**
 * Decrypts a Base64 encrypted string back into its original JS structure.
 */
export function decryptLocalData<T>(cipherText: string | null, actorId?: string | null): T | null {
  if (!cipherText) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(cipherText)));
    const key = deriveKey(actorId);
    const decrypted = rc4(key, decoded);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      console.error("Decryption error:", error);
    }
    return null;
  }
}

/**
 * Helper to check if a string is likely encrypted or plain JSON.
 * Helps with backwards compatibility if there is unencrypted data in localStorage.
 */
export function getSecureItem<T>(key: string, actorId?: string | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    // Attempt decrypting
    const decrypted = decryptLocalData<T>(cached, actorId);
    if (decrypted !== null) return decrypted;

    // Fallback: try parsing directly as raw JSON in case it was stored unencrypted
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

/**
 * Helper to store data encrypted in localStorage.
 */
export function setSecureItem(key: string, data: unknown, actorId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const cipherText = encryptLocalData(data, actorId);
    localStorage.setItem(key, cipherText);
  } catch (error) {
    console.error("Error setting secure item:", error);
  }
}
