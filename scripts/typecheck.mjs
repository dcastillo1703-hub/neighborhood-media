import { readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const cwd = process.cwd();
const tsconfigPath = path.join(cwd, "tsconfig.json");
const tempConfigPath = path.join(cwd, "tsconfig.typecheck.json");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8"));
tsconfig.include = (tsconfig.include ?? []).filter((entry) => entry !== ".next/types/**/*.ts");

await writeFile(tempConfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

try {
  await run("npx", ["next", "typegen"]);
  await run("npx", ["tsc", "--noEmit", "-p", tempConfigPath]);
} finally {
  await rm(tempConfigPath, { force: true });
}
