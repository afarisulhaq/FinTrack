import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { Store, passwordHash } from "../src/store.mjs";

const store = new Store(process.env.DATA_DIR ?? "./data");
if (store.get("admin_password")) {
  console.log("Admin sudah dibuat. Setup tidak mengubah akun yang ada.");
  store.close();
  process.exit(0);
}
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) stdout.write(chunk, encoding);
    callback();
  },
});
const terminal = createInterface({
  input: stdin,
  output,
  terminal: Boolean(stdin.isTTY),
});
async function hiddenQuestion(prompt) {
  stdout.write(prompt);
  muted = true;
  try {
    return await terminal.question("");
  } finally {
    muted = false;
    stdout.write("\n");
  }
}
try {
  const username = (await terminal.question("Nama login admin: ")).trim();
  if (!/^[a-zA-Z0-9_.-]{3,60}$/.test(username))
    throw new Error("Nama login 3–60 karakter, huruf/angka/titik/garis");
  console.log(
    "Password minimal 12 karakter. Input hanya dilakukan di terminal lokal.",
  );
  const password = await hiddenQuestion("Password admin: ");
  const confirm = await hiddenQuestion("Ulangi password: ");
  if (password !== confirm) throw new Error("Password tidak cocok");
  store.set("admin_username", username);
  store.set("admin_password", passwordHash(password));
  console.log(
    "Admin berhasil dibuat. Jalankan npm start untuk membuka dashboard.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  terminal.close();
  store.close();
}
