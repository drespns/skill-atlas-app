import "react-native-get-random-values";
import * as Crypto from "expo-crypto";

type SubtleLike = {
  digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer>;
};

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function resolveDigestAlgo(algorithm: AlgorithmIdentifier): Crypto.CryptoDigestAlgorithm {
  const name = (typeof algorithm === "string" ? algorithm : algorithm.name).toUpperCase();
  if (name === "SHA-1" || name === "SHA1") return Crypto.CryptoDigestAlgorithm.SHA1;
  if (name === "SHA-384" || name === "SHA384") return Crypto.CryptoDigestAlgorithm.SHA384;
  if (name === "SHA-512" || name === "SHA512") return Crypto.CryptoDigestAlgorithm.SHA512;
  return Crypto.CryptoDigestAlgorithm.SHA256;
}

/**
 * Supabase PKCE necesita crypto.subtle.digest (SHA-256). Hermes no lo trae → aviso
 * "WebCrypto API is not supported" y challenge "plain" que luego falla al canjear el code.
 */
export function installWebCryptoPolyfill(): void {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };

  if (!g.crypto) {
    // @ts-expect-error polyfill parcial
    g.crypto = {};
  }

  if (typeof g.crypto.getRandomValues !== "function") {
    g.crypto.getRandomValues = Crypto.getRandomValues.bind(Crypto);
  }

  if (typeof g.crypto.randomUUID !== "function" && typeof Crypto.randomUUID === "function") {
    g.crypto.randomUUID = Crypto.randomUUID.bind(Crypto);
  }

  const subtle = (g.crypto.subtle ?? {}) as SubtleLike;
  if (typeof subtle.digest !== "function") {
    subtle.digest = async (algorithm, data) => {
      const algo = resolveDigestAlgo(algorithm);
      return Crypto.digest(algo, toUint8Array(data));
    };
    // @ts-expect-error assign polyfill
    g.crypto.subtle = subtle;
  }
}

installWebCryptoPolyfill();
