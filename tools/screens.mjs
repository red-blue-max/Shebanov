// Скриншоты страницы на нескольких ширинах через Chrome DevTools Protocol (без Playwright).
// Запуск из папки site/ при работающем локальном сервере:
//   node tools/screens.mjs http://127.0.0.1:8765/
// Результат: _screens/<ширина>.png (вся страница) и отчёт о горизонтальном переполнении.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.argv[2] || "http://127.0.0.1:8765/";
const WIDTHS = [360, 390, 768, 1024, 1440];
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync("_screens", { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "screens-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) { chrome.kill(); throw new Error("Chrome не запустился"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  pending.set(n, (m) => (m.error ? reject(new Error(method + ": " + m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

const report = [];
for (const w of WIDTHS) {
  const mobile = w < 768;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: URL_ });
  await sleep(1500);
  // прокрутка вниз и обратно, чтобы подгрузились lazy-картинки; фиксированные элементы скрываем
  await evaluate(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 1200)); document.querySelector('.sticky-cta').style.display = 'none'; })()`);
  const info = await evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.strip__track, svg, .caustics, .bubbles');
    }).slice(0, 10).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);
    const errs = [...document.querySelectorAll('img')].filter(i => i.complete && !i.naturalWidth && i.currentSrc).map(i => i.currentSrc);
    return { vw, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, overflow: over, brokenImages: errs };
  })()`);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: info.height, scale: 1 } });
  writeFileSync(`_screens/${w}.png`, Buffer.from(shot.data, "base64"));
  report.push({ width: w, ...info });
}
writeFileSync("_screens/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
chrome.kill();
