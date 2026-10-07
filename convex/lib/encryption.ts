import type { Infer } from "convex/values";
import { v } from "convex/values";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
export const encryptedValue = v.object({
  version: v.literal(1),
  keyId: v.string(),
  iv: v.string(),
  ciphertext: v.string(),
});
type Envelope = Infer<typeof encryptedValue>;
const encoder = new TextEncoder();
function keyBytes(value: string | undefined) {
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Booking encryption is not configured.");
  return hexToBytes(value);
}
function encryptionKey(id: string) {
  const keys = JSON.parse(
    process.env.CUSTOMER_ENCRYPTION_KEYS || "{}",
  ) as Record<string, string>;
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes(keys[id])),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export function blindIndex(purpose: string, value: string) {
  return bytesToHex(
    hmac(
      sha256,
      keyBytes(process.env.CUSTOMER_INDEX_KEY),
      encoder.encode(JSON.stringify([purpose, value])),
    ),
  );
}
export async function encrypt(
  data: unknown,
  context: string,
): Promise<Envelope> {
  const keyId = process.env.CUSTOMER_ENCRYPTION_KEY_ID;
  if (!keyId) throw new Error("Booking encryption is not configured.");
  const key = await encryptionKey(keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(`action-audio:v1:${keyId}:${context}`),
      tagLength: 128,
    },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return {
    version: 1,
    keyId,
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
  };
}
export async function decrypt<T>(data: Envelope, context: string): Promise<T> {
  const key = await encryptionKey(data.keyId);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(hexToBytes(data.iv)),
        additionalData: encoder.encode(
          `action-audio:v1:${data.keyId}:${context}`,
        ),
        tagLength: 128,
      },
      key,
      new Uint8Array(hexToBytes(data.ciphertext)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Unable to read protected booking data.");
  }
}
