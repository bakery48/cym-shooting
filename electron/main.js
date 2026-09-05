'use strict';
/**
 * Steam（PC）向けのシェル。
 * ゲーム本体はブラウザでも動くWebアプリのままで、ここは窓とライフサイクルだけを持つ。
 *
 * ES モジュールは file:// では読み込めないため、独自スキーム app:// で配信する。
 */
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const WINDOW = { width: 1280, height: 720, minWidth: 640, minHeight: 480 };

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function resolveAsset(urlPath) {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(ROOT, rel === path.sep || rel === '.' ? 'index.html' : rel);
  // ROOT の外は配信しない
  return file.startsWith(ROOT + path.sep) ? file : null;
}

function createWindow() {
  const win = new BrowserWindow({
    ...WINDOW,
    backgroundColor: '#1b2038',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.once('ready-to-show', () => win.show());
  // 外部リンクはゲーム内では開かず、OSのブラウザに渡す
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const file = resolveAsset(new URL(req.url).pathname);
    if (!file) return new Response('403', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
