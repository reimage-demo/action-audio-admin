import { scrypt } from "@noble/hashes/scrypt";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

// OWASP's 32 MiB scrypt configuration. The pepper never enters authAccounts.
const options = { N: 32768, r: 8, p: 3, dkLen: 32, maxmem: 64 * 1024 * 1024 };
const prefix = "scrypt-v1$32768$8$3$";
export function validPasswordHash(hash: string) {
  return /^scrypt-v1\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash);
}
function derive(password: string, salt: string) {
  const pepper = process.env.AUTH_PASSWORD_PEPPER;
  if (!pepper || !/^[a-f0-9]{64}$/.test(pepper))
    throw new Error("Staff authentication is not configured.");
  const input = hmac(
    sha256,
    hexToBytes(pepper),
    new TextEncoder().encode(password),
  );
  return scrypt(input, hexToBytes(salt), options);
}
export async function hashSecret(password: string) {
  if (password.length < 14 || password.length > 256)
    throw new Error("Use a password between 14 and 256 characters.");
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${prefix}${salt}$${bytesToHex(derive(password, salt))}`;
}
export async function verifySecret(password: string, hash: string) {
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    !validPasswordHash(hash)
  )
    return false;
  const [, , , , salt, expected] = hash.split("$");
  const actual = derive(password, salt);
  const wanted = hexToBytes(expected);
  let different = 0;
  for (let i = 0; i < actual.length; i++) different |= actual[i] ^ wanted[i];
  return different === 0;
}
export const managerUsername = () => "actionaudiomanager";
