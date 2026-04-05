'use strict'

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const http = require('http')

const PORT = 3141

function waitForServer(timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    function attempt() {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.resume()
        resolve()
      })
      req.setTimeout(1000, () => req.destroy())
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`OpenCode Radar server not ready after ${timeout}ms`))
        } else {
          setTimeout(attempt, 500)
        }
      })
    }
    attempt()
  })
}

let httpServer = null

async function startProductionServer() {
  const appRoot = path.join(process.resourcesPath, 'app')
  // Resolve `next` from the bundled node_modules, not from Electron itself
  const nextLib = require(path.join(appRoot, 'node_modules', 'next'))
  const createNextApp = nextLib.default ?? nextLib

  const nextApp = createNextApp({ dev: false, dir: appRoot })
  const handle = nextApp.getRequestHandler()
  await nextApp.prepare()

  httpServer = http.createServer((req, res) => handle(req, res))
  await new Promise((resolve) => httpServer.listen(PORT, '127.0.0.1', resolve))
}

let mainWindow = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'OpenCode Radar',
    backgroundColor: '#0a0a0a',
    show: false, // avoids white flash; revealed after loadFile settles
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  await mainWindow.loadFile(path.join(__dirname, 'loading.html'))
  mainWindow.show()

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await createWindow()

    if (app.isPackaged) {
      await startProductionServer()
    } else {
      // Dev mode: `npm run dev` is running separately — wait for it
      await waitForServer()
    }

    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
    }
  } catch (err) {
    console.error('[opencode-radar] startup error:', err)
    app.quit()
  }

  app.on('activate', async () => {
    if (!mainWindow) {
      await createWindow()
      if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
    }
  })
})

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close()
  if (process.platform !== 'darwin') app.quit()
})
