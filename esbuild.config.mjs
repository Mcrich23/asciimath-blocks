import { context } from "esbuild";
import { readFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const build = await context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "@codemirror/*"],
  format: "cjs",
  target: "es2021",
  outfile: "main.js",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  legalComments: "eof",
  footer: {
    js: `/*
${readFileSync(new URL("./LICENSE", import.meta.url), "utf8")}
Bundled asciimath2tex by Christian Lawson-Perfect.
${readFileSync(new URL("./licenses/asciimath2tex.txt", import.meta.url), "utf8")}
*/`,
  },
  logLevel: "info",
});

if (watch) {
  await build.watch();
} else {
  await build.rebuild();
  await build.dispose();
}
