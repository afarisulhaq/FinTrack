import "./load-env.mjs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

for (const port of [3000, 4000]) {
  try {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen({ port, host: "0.0.0.0", exclusive: true }, () => {
        server.close((error) => (error ? reject(error) : resolve(undefined)));
      });
    });
  } catch {
    console.error(
      `Port ${port} sedang dipakai. Hentikan server lama sebelum menjalankan npm run dev.`,
    );
    process.exit(1);
  }
}

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ESRCH"
      )
        console.error(error);
    }
  }
}

for (const [script, port] of [
  ["dev:server", "4000"],
  ["dev:web", "3000"],
]) {
  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    {
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: { ...process.env, PORT: port },
    },
  );
  children.push(child);
  child.on("error", (error) => {
    console.error(`Gagal menjalankan ${script}: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(
        `${script} berhenti; frontend dan backend dihentikan bersama.`,
      );
      stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
