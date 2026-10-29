import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const appRuntime = process.argv[2] === "app";
const seedRuntime = process.argv[2] === "seed";
const packages = [
  ...(seedRuntime
    ? ["@prisma/client", "bcryptjs", "prisma", "tsx"]
    : [
        "@elysia/node", "@elysiajs/cors", "@prisma/client",
        "@whiskeysockets/baileys", "bcryptjs", "elysia", "jsonwebtoken",
        "qrcode", "tesseract.js", "zod",
        ...(!appRuntime ? ["prisma", "tsx"] : []),
      ]),
];
const dependencies = Object.fromEntries(packages.map((name) => {
  const version = lock.packages[`node_modules/${name}`]?.version;
  if (!version) throw new Error(`Missing locked runtime dependency: ${name}`);
  return [name, version];
}));
fs.writeFileSync("package.json", JSON.stringify({
  name: manifest.name,
  version: manifest.version,
  private: true,
  type: "module",
  ...(appRuntime ? {} : { prisma: manifest.prisma }),
  dependencies,
}, null, 2) + "\n");
