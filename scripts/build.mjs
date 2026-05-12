import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));

const banner = `// ==UserScript==
// @name         Parasut Gider Formu Excel Doldurucu
// @namespace    ajans-parasut
// @version      ${packageJson.version}
// @description  Excel satırlarından seçilen kaydı Paraşüt gider formuna manuel doldurur
// @match        https://uygulama.parasut.com/*
// @updateURL    https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
// @downloadURL  https://raw.githubusercontent.com/emredemirhan/efsos_para_otomasyon/main/dist/parasut.user.js
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==`;

await build({
  entryPoints: ["src/main.js"],
  outfile: "dist/parasut.user.js",
  bundle: true,
  format: "iife",
  target: ["es2020"],
  banner: {
    js: banner,
  },
  legalComments: "none",
});
