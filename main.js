const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
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
        
        const watermarkBase64 = await event.sender.invoke('create-watermark', { 
          width: newWidth, 
          height: newHeight, 
          settings 
        });
        
        const watermarkBuffer = Buffer.from(watermarkBase64, 'base64');
        
        const watermarked = await sharp(resized)
          .composite([{
            input: watermarkBuffer,
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

async function applyWatermark(imageBuffer, width, height, settings) {
  return imageBuffer;
}