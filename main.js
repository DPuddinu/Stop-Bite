import { app, BrowserWindow, Tray, Menu, dialog, ipcMain, session, systemPreferences } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
let mainWindow;
let tray;
let soundFiles = store.get('soundFiles', []);
app.isQuitting = false;

function updateMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Aggiungi Suoni...',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              soundFiles = [...soundFiles, ...result.filePaths];
              store.set('soundFiles', soundFiles);
              updateMenu();
              if (mainWindow) mainWindow.webContents.send('update-sounds', soundFiles);
            }
          }
        },
        { type: 'separator' },
        ...(soundFiles.length > 0 ? [
          { label: 'Suoni Caricati:', enabled: false },
          ...soundFiles.map((file, index) => ({
            label: `  ${index + 1}. ${path.basename(file)}`,
            submenu: [
              {
                label: 'Rimuovi questo suono',
                click: () => {
                  soundFiles.splice(index, 1);
                  store.set('soundFiles', soundFiles);
                  updateMenu();
                  if (mainWindow) mainWindow.webContents.send('update-sounds', soundFiles);
                }
              }
            ]
          })),
          { type: 'separator' },
          {
            label: 'Svuota Lista Suoni',
            click: () => {
              soundFiles = [];
              store.set('soundFiles', []);
              updateMenu();
              if (mainWindow) mainWindow.webContents.send('update-sounds', []);
            }
          },
          { type: 'separator' }
        ] : []),
        ...(!isMac ? [{ role: 'quit', label: 'Esci' }] : [])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Move IPC listeners outside to avoid duplication
ipcMain.on('request-add-sounds', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    soundFiles = [...soundFiles, ...result.filePaths];
    store.set('soundFiles', soundFiles);
    updateMenu();
    if (mainWindow) mainWindow.webContents.send('update-sounds', soundFiles);
  }
});

ipcMain.on('request-clear-sounds', () => {
  soundFiles = [];
  store.set('soundFiles', []);
  updateMenu();
  if (mainWindow) mainWindow.webContents.send('update-sounds', []);
});

ipcMain.on('remove-sound', (event, index) => {
  if (index >= 0 && index < soundFiles.length) {
    soundFiles.splice(index, 1);
    store.set('soundFiles', soundFiles);
    updateMenu();
    if (mainWindow) mainWindow.webContents.send('update-sounds', soundFiles);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
    show: true,
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update-sounds', soundFiles);
  });

  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('camera').then((allowed) => {
      console.log('Camera access:', allowed);
    });
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'videoCapture', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.loadFile('index.html');
  updateMenu();

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }},
  ]);
  tray.setToolTip('Stop Bite');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
