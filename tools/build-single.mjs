/**
 * 単一HTMLへのまとめ役。
 *   node tools/build-single.mjs [出力先]
 *
 * ES モジュールは file:// では読み込めないので、スマホに送ってそのまま開ける形にするには
 * 1ファイルに畳む必要がある。依存ライブラリもビルドツールも使わず、
 * import / export を素朴なモジュールレジストリに書き換えて連結する。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'js/main.js';
const OUT = process.argv[2] ?? 'dist/cym-shooting.html';

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm;
const BARE_IMPORT_RE = /^import\s*['"]([^'"]+)['"];?\s*$/gm;
const id = (abs) => relative(ROOT, abs).split('\\').join('/');

/** モジュールを1つ読み、依存を先に辿る。 */
async function collect(abs, seen, out) {
  const key = id(abs);
  if (seen.has(key)) return;
  seen.add(key);

  let src = await readFile(abs, 'utf8');
  const deps = [];

  src = src.replace(IMPORT_RE, (_, names, spec) => {
    const dep = resolve(dirname(abs), spec);
    deps.push(dep);
    return `const {${names.trim()}} = __require(${JSON.stringify(id(dep))});`;
  });
  src = src.replace(BARE_IMPORT_RE, (_, spec) => {
    deps.push(resolve(dirname(abs), spec));
    return '';
  });

  // export を「宣言 + exports への登録」に開く。再代入される輸出は無いので参照は素の名前のまま通る。
  const exported = [];
  src = src.replace(/^export\s+(const|let|function|class)\s+([A-Za-z0-9_$]+)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\s/m.test(src)) throw new Error(`${key}: 未対応の export 構文が残っている`);

  for (const dep of deps) await collect(dep, seen, out);

  const tail = exported.map((n) => `  __exports.${n} = ${n};`).join('\n');
  out.push(
    `__define(${JSON.stringify(key)}, function (__exports, __require) {\n` +
    src.trimEnd() + '\n\n' + tail + '\n});'
  );
}

const modules = [];
await collect(join(ROOT, ENTRY), new Set(), modules);

const runtime = `
const __defs = {}, __cache = {};
const __define = (id, fn) => { __defs[id] = fn; };
function __require(id) {
  if (__cache[id]) return __cache[id];
  const e = (__cache[id] = {});
  __defs[id](e, __require);
  return e;
}`.trim();

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const css = await readFile(join(ROOT, 'css/style.css'), 'utf8');

const bundled = html
  .replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`)
  .replace(
    '<script type="module" src="js/main.js"></script>',
    `<script>\n(function () {\n"use strict";\n${runtime}\n\n${modules.join('\n\n')}\n\n__require(${JSON.stringify(ENTRY)});\n})();\n</script>`
  );

if (bundled.includes('<link rel="stylesheet"') || bundled.includes('type="module"')) {
  throw new Error('index.html の差し替え箇所が見つからなかった');
}

const outPath = resolve(ROOT, OUT);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, bundled);
console.log(`${relative(ROOT, outPath)}  ${(bundled.length / 1024).toFixed(1)} KB  (${modules.length} modules)`);
