const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 750,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('select-input-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-preview-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'tiff', 'webp'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('count-images', async (event, folderPath) => {
  try {
    const files = await fs.readdir(folderPath);
    const imageExts = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'];
    return files.filter(f => imageExts.includes(path.extname(f).toLowerCase())).length;
  } catch {
    return 0;
  }
});

ipcMain.handle('load-image', async (event, imagePath) => {
  try {
    const buffer = await fs.readFile(imagePath);
    const metadata = await sharp(buffer).metadata();
    
    const minDim = Math.min(metadata.width, metadata.height);
    const scale = 2048 / minDim;
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);
    
    const resized = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: 'fill' })
      .toBuffer();
    
    return {
      data: resized.toString('base64'),
      width: newWidth,
      height: newHeight
    };
  } catch (error) {
    console.error('Load image error:', error);
    return null;
  }
});

function createWatermarkSVG(width, height, settings) {
  const { text, fontSize, color, rotation, hSpacing, vSpacing, opacity, density } = settings;
  
  const scale = Math.min(width, height) / 1000;
  const scaledHSpacing = Math.round(hSpacing * scale * (11 - density) / 5);
  const scaledVSpacing = Math.round(vSpacing * scale * (11 - density) / 5);
  
  const diagonal = Math.ceil(Math.sqrt(width * width + height * height));
  
  let textElements = '';
  for (let y = -diagonal; y < diagonal * 2; y += scaledVSpacing) {
    for (let x = -diagonal; x < diagonal * 2; x += scaledHSpacing) {
      textElements += `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="bold" font-family="Arial" fill="${color}" fill-opacity="${opacity / 100}">${text}</text>`;
    }
  }
  
  const svg = `
    <svg width="${width}" height="${height}">
      <g transform="translate(${width/2}, ${height/2}) rotate(${-rotation}) translate(${-width/2}, ${-height/2})">
        ${textElements}
      </g>
    </svg>
  `;
  
  return Buffer.from(svg);
}

ipcMain.handle('process-images', async (event, options) => {
  const { inputFolder, outputFolder, settings } = options;
  
  try {
    const files = await fs.readdir(inputFolder);
    const imageExts = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'];
    const imageFiles = files.filter(f => imageExts.includes(path.extname(f).toLowerCase()));
    
    let processed = 0;
    
    for (const file of imageFiles) {
      try {
        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file);
        
        const buffer = await fs.readFile(inputPath);
        const metadata = await sharp(buffer).metadata();
        
        const minDim = Math.min(metadata.width, metadata.height);
        const scale = 2048 / minDim;
        const newWidth = Math.round(metadata.width * scale);
        const newHeight = Math.round(metadata.height * scale);
        
        const resized = await sharp(buffer)
          .resize(newWidth, newHeight, { fit: 'fill' })
          .toBuffer();
        
        const watermarkSVG = createWatermarkSVG(newWidth, newHeight, settings);
        
        const watermarked = await sharp(resized)
          .composite([{
            input: watermarkSVG,
            blend: 'over'
          }])
          .toBuffer();
        
        await sharp(watermarked).toFile(outputPath);
        
        processed++;
        event.sender.send('process-progress', { processed, total: imageFiles.length });
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }
    
    return { success: true, processed, total: imageFiles.length };
  } catch (error) {
    console.error('Process images error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-success-dialog', async (event, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Hoàn tất',
    message: message,
    buttons: ['Mơ thư mục', 'Đóng'],
    defaultId: 0,
    cancelId: 1
  });
  
  return result.response;
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});