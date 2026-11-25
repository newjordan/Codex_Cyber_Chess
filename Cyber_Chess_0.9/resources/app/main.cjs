const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const { join, resolve } = require('node:path');
const { createGameServer } = require('./lib/static-server.cjs');

const staticRoot = resolve(process.env.CYBER_CHESS_STATIC_ROOT || join(__dirname, 'app'));
const appIcon = join(__dirname, 'icon.ico');
const windowAspect = 1672 / 941;
const targetWindow = { width: 1672, height: 941 };

let server;

function listen(serverToStart) {
  return new Promise((resolveListen, rejectListen) => {
    serverToStart.once('error', rejectListen);
    serverToStart.listen(0, '127.0.0.1', () => {
      serverToStart.off('error', rejectListen);
      resolveListen(serverToStart.address().port);
    });
  });
}

async function createWindow() {
  server = createGameServer(staticRoot);
  const port = await listen(server);
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
  const fitScale = Math.min(1, workWidth / targetWindow.width, workHeight / targetWindow.height);
  const width = Math.max(960, Math.floor(targetWindow.width * fitScale));
  const height = Math.round(width / windowAspect);

  const win = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(960, width),
    minHeight: Math.min(Math.round(960 / windowAspect), height),
    backgroundColor: '#02050c',
    autoHideMenuBar: true,
    center: true,
    frame: false,
    fullscreenable: false,
    maximizable: false,
    title: 'Cyber Chess',
    icon: appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.cjs'),
      sandbox: true,
    },
  });

  win.setAspectRatio(windowAspect);
  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  ipcMain.handle('cyber-chess:close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
  ipcMain.handle('cyber-chess:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });
  Menu.setApplicationMenu(null);
  return createWindow();
}).catch((error) => {
  console.error('[cyber-chess] failed to open the window', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
    server = undefined;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error('[cyber-chess] failed to reopen the window', error);
    });
  }
});
