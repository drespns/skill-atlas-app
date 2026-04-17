/**
 * Cifrado opcional del cuaderno antes de guardarlo en `user_client_state`.
 * Solo el navegador con la frase correcta puede descifrar: SkillAtlas/Supabase solo ven bytes opacos.
 * Si se pierde la frase, los datos cifrados en la nube no son recuperables.
 */

import type { ExpenseTrackerState } from "@lib/tools-expense-tracker";

export type EncryptedExpenseEnvelope = {
  skillatlasEncrypted: true;
  alg: "AES-GCM-PBKDF2";
  /** Base64, 16 bytes */
  salt: string;
  /** Base64, 12 bytes */
  iv: string;
  /** Base64, ciphertext + auth tag */
  ct: string;
};

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export function isExpenseEncryptedEnvelope(x: unknown): x is EncryptedExpenseEnvelope {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return (
    o.skillatlasEncrypted === true &&
    o.alg === "AES-GCM-PBKDF2" &&
    typeof o.salt === "string" &&
    typeof o.iv === "string" &&
    typeof o.ct === "string"
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveBits", "deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealExpenseState(state: ExpenseTrackerState, passphrase: string): Promise<EncryptedExpenseEnvelope> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify(state));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    skillatlasEncrypted: true,
    alg: "AES-GCM-PBKDF2",
    salt: toB64(salt.buffer),
    iv: toB64(iv.buffer),
    ct: toB64(ctBuf),
  };
}

export async function openExpenseEnvelope(env: EncryptedExpenseEnvelope, passphrase: string): Promise<string> {
  const salt = fromB64(env.salt);
  const iv = fromB64(env.iv);
  const ct = fromB64(env.ct);
  const key = await deriveKey(passphrase, salt);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plainBuf);
}
