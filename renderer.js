const { ipcRenderer } = require('electron');

let inputFolder = '';
let outputFolder = '';
let previewImage = null;
let previewWidth = 0;
let previewHeight = 0;
let updateTimeout = null;
let isProcessing = false;
let isPaused = false;

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

document.getElementById('btnInputFolder').addEventListener('click', async () => {
  const folder = await ipcRenderer.invoke('select-input-folder');
  if (folder) {
    inputFolder = folder;
    document.getElementById('inputFolder').value = folder;
    updateImageCount();
  }
});

document.getElementById('btnOutputFolder').addEventListener('click', async () => {
  const folder = await ipcRenderer.invoke('select-output-folder');
  if (folder) {
    outputFolder = folder;
    document.getElementById('outputFolder').value = folder;
  }
});

document.getElementById('btnChoosePreview').addEventListener('click', async () => {
  const imagePath = await ipcRenderer.invoke('select-preview-image');
  if (imagePath) {
    loadPreviewImage(imagePath);
  }
});

document.getElementById('watermarkText').addEventListener('input', throttleUpdate);
document.getElementById('fontSize').addEventListener('input', throttleUpdate);
document.getElementById('textColor').addEventListener('input', throttleUpdate);
document.getElementById('rotation').addEventListener('input', (e) => {
  document.getElementById('rotationLabel').textContent = `Góc xoay: ${e.target.value}°`;
  throttleUpdate();
});
document.getElementById('hSpacing').addEventListener('input', (e) => {
  document.getElementById('hSpacingLabel').textContent = `Khoảng cách ngang: ${e.target.value}px`;
  throttleUpdate();
});
document.getElementById('vSpacing').addEventListener('input', (e) => {
  document.getElementById('vSpacingLabel').textContent = `Khoảng cách dọc: ${e.target.value}px`;
  throttleUpdate();
});
document.getElementById('opacity').addEventListener('input', (e) => {
  document.getElementById('opacityLabel').textContent = `Độ mờ: ${e.target.value}%`;
  throttleUpdate();
});
document.getElementById('density').addEventListener('input', (e) => {
  document.getElementById('densityLabel').textContent = `Mật độ: ${e.target.value}x`;
  throttleUpdate();
});

document.getElementById('btnStart').addEventListener('click', startProcessing);
document.getElementById('btnPause').addEventListener('click', togglePause);

ipcRenderer.on('process-progress', (event, data) => {
  const percent = Math.round((data.processed / data.total) * 100);
  document.getElementById('progressFill').style.width = `${percent}%`;
  document.getElementById('progressText').textContent = `${percent}%`;
});

async function updateImageCount() {
  if (inputFolder) {
    const count = await ipcRenderer.invoke('count-images', inputFolder);
    document.getElementById('imageCount').textContent = `Tìm thấy: ${count} ảnh`;
    
    if (count > 0 && !previewImage) {
      loadFirstImage();
    }
  }
}

async function loadFirstImage() {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const files = await fs.readdir(inputFolder);
    const imageExts = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'];
    const firstImage = files.find(f => imageExts.includes(path.extname(f).toLowerCase()));
    
    if (firstImage) {
      loadPreviewImage(path.join(inputFolder, firstImage));
    }
  } catch (error) {
    console.error('Load first image error:', error);
  }
}

async function loadPreviewImage(imagePath) {
  const result = await ipcRenderer.invoke('load-image', imagePath);
  
  if (result) {
    const img = new Image();
    img.onload = () => {
      previewImage = img;
      previewWidth = result.width;
      previewHeight = result.height;
      canvas.width = result.width;
      canvas.height = result.height;
      document.getElementById('noPreview').style.display = 'none';
      canvas.style.display = 'block';
      updatePreview();
    };
    img.src = `data:image/png;base64,${result.data}`;
  }
}

function throttleUpdate() {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(updatePreview, 200);
}

function updatePreview() {
  if (!previewImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(previewImage, 0, 0);
  
  const text = document.getElementById('watermarkText').value;
  if (!text) return;
  
  const fontSize = parseInt(document.getElementById('fontSize').value);
  const color = document.getElementById('textColor').value;
  const rotation = parseInt(document.getElementById('rotation').value);
  const hSpacing = parseInt(document.getElementById('hSpacing').value);
  const vSpacing = parseInt(document.getElementById('vSpacing').value);
  const opacity = parseInt(document.getElementById('opacity').value) / 100;
  const density = parseInt(document.getElementById('density').value);
  
  const scale = Math.min(previewWidth, previewHeight) / 1000;
  const scaledHSpacing = Math.round(hSpacing * scale * (11 - density) / 5);
  const scaledVSpacing = Math.round(vSpacing * scale * (11 - density) / 5);
  
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  ctx.save();
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  
  const diagonal = Math.ceil(Math.sqrt(previewWidth * previewWidth + previewHeight * previewHeight));
  
  ctx.translate(previewWidth / 2, previewHeight / 2);
  ctx.rotate(-rotation * Math.PI / 180);
  ctx.translate(-previewWidth / 2, -previewHeight / 2);
  
  for (let y = -diagonal; y < diagonal * 2; y += scaledVSpacing) {
    for (let x = -diagonal; x < diagonal * 2; x += scaledHSpacing) {
      ctx.fillText(text, x, y);
    }
  }
  
  ctx.restore();
}

async function startProcessing() {
  if (!inputFolder || !outputFolder) {
    alert('Vui lòng chọn thư mục ảnh gốc và thư mục lưu kết quả!');
    return;
  }
  
  if (!document.getElementById('watermarkText').value) {
    alert('Vui lòng nhập nội dung watermark!');
    return;
  }
  
  if (inputFolder === outputFolder) {
    alert('Thư mục ảnh gốc và thư mục lưu kết quả phải khác nhau!');
    return;
  }
  
  isProcessing = true;
  document.getElementById('btnStart').disabled = true;
  document.getElementById('btnPause').disabled = false;
  
  const settings = {
    text: document.getElementById('watermarkText').value,
    fontSize: parseInt(document.getElementById('fontSize').value),
    color: document.getElementById('textColor').value,
    rotation: parseInt(document.getElementById('rotation').value),
    hSpacing: parseInt(document.getElementById('hSpacing').value),
    vSpacing: parseInt(document.getElementById('vSpacing').value),
    opacity: parseInt(document.getElementById('opacity').value),
    density: parseInt(document.getElementById('density').value)
  };
  
  const result = await ipcRenderer.invoke('process-images', {
    inputFolder,
    outputFolder,
    settings
  });
  
  isProcessing = false;
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnPause').disabled = true;
  
  if (result.success) {
    const buttonIndex = await ipcRenderer.invoke('show-success-dialog', 
      `Đã xử lý thành công ${result.processed}/${result.total} ảnh!`
    );
    
    if (buttonIndex === 0) {
      await ipcRenderer.invoke('open-folder', outputFolder);
    }
  } else {
    alert(`Lỗi: ${result.error}`);
  }
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById('btnPause').textContent = isPaused ? 'TIẾP TỤC' : 'TẠM DỪNG';
}