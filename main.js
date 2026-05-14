const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const fs = require('fs')
const path = require('path')

let dataFilePath;
let imageFolderPath;

// 🔒 在最顶级注册一个专属的谷子协议，强行绕过 Windows 拦截策略！
protocol.registerSchemesAsPrivileged([
  { scheme: 'guzi-local', privileges: { bypassCSP: true, stream: true, corsEnabled: true, secure: true } }
])

function createWindow () {
  const baseDataPath = "D:\\MyGuziData"; 
  dataFilePath = path.join(baseDataPath, 'data.json')
  imageFolderPath = path.join(baseDataPath, 'GoodsImage')

  if (!fs.existsSync(imageFolderPath)){
      fs.mkdirSync(imageFolderPath, { recursive: true });
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build/SNGN.ico'),
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js') 
    }
  })
  win.loadFile('index.html')
}

// 📡 1. 原生文件选择器
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0]; 
})

// 📡 2. 读取数据
ipcMain.handle('read-data', () => {
  if (!dataFilePath) dataFilePath = "D:\\MyGuziData\\data.json";
  if (!fs.existsSync(dataFilePath)) fs.writeFileSync(dataFilePath, '[]', 'utf-8')
  return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'))
})

// 📡 3. 保存数据
ipcMain.handle('save-data', (event, newData) => {
  if (!dataFilePath) dataFilePath = "D:\\MyGuziData\\data.json";
  fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2), 'utf-8')
  return true
})

// 📡 4. 图片搬家工具
ipcMain.handle('upload-image', (event, sourcePath) => {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) return '';
    if (!imageFolderPath) imageFolderPath = "D:\\MyGuziData\\GoodsImage";

    const ext = path.extname(sourcePath);
    const newFilename = Date.now() + ext;
    const destPath = path.resolve(imageFolderPath, newFilename);
    
    fs.copyFileSync(sourcePath, destPath);
    return newFilename;
  } catch (err) {
    console.error(err);
    return '';
  }
})

app.whenReady().then(() => {
  // 🛠️ 核心修复：建立一个绝对安全的特权虚拟通道，让网页可以用 guzi-local:// 顺畅读取 D 盘图片！
  protocol.registerFileProtocol('guzi-local', (request, callback) => {
    const url = request.url.replace('guzi-local://', '')
    try {
      return callback({ path: path.normalize(decodeURIComponent(url)) })
    } catch (error) {
      console.error(error)
    }
  })

  createWindow()
})