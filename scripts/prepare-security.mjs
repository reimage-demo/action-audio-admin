import { randomBytes, createHmac, scryptSync } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
import process from "node:process";
const path = ".env.security.local";
try {
  await access(path);
  throw new Error(
    "Security settings already exist. Refusing to replace encryption keys.",
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (!process.stdin.isTTY)
  throw new Error("Run in a terminal to enter the password privately.");
process.stdout.write("Manager password (hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
let password = await new Promise((resolve, reject) => {
  let value = "";
  function read(chunk) {
    for (const char of chunk) {
      if (char === "\u0003") {
        process.stdin.off("data", read);
        reject(new Error("Cancelled."));
        return;
      }
      if (char === "\r" || char === "\n") {
        process.stdin.off("data", read);
        resolve(value);
        return;
      }
      if (char === "\u007f") value = value.slice(0, -1);
      else value += char;
    }
  }
  process.stdin.on("data", read);
}).finally(() => {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write("\n");
});
if (password.length < 14 || password.length > 256)
  throw new Error("Use 14–256 characters.");
const pepper = randomBytes(32).toString("hex");
const salt = randomBytes(16).toString("hex");
const input = createHmac("sha256", Buffer.from(pepper, "hex"))
  .update(password)
  .digest();
const hash = scryptSync(input, Buffer.from(salt, "hex"), 32, {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
}).toString("hex");
password = "";
input.fill(0);
const settings = {
  AUTH_PASSWORD_PEPPER: pepper,
  CUSTOMER_ENCRYPTION_KEY_ID: "v1",
  CUSTOMER_ENCRYPTION_KEYS: JSON.stringify({
    v1: randomBytes(32).toString("hex"),
  }),
  CUSTOMER_INDEX_KEY: randomBytes(32).toString("hex"),
  MANAGER_USERNAME: "actionaudiomanager",
  MANAGER_PASSWORD_HASH: `scrypt-v1$32768$8$3$${salt}$${hash}`,
};
await writeFile(
  path,
  Object.entries(settings)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Saved protected security settings to .env.security.local; no plaintext password was saved.",
);
