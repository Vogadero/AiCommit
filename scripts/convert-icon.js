const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'images', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'images', 'icon.png');

const svgBuffer = fs.readFileSync(svgPath);

sharp(svgBuffer)
  .resize(128, 128)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log(`图标已生成: ${pngPath}`);
  })
  .catch((err) => {
    console.error('转换失败:', err);
    process.exit(1);
  });
