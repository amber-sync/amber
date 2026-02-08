const sharp = require('sharp');
const generateIcon = require('icon-gen');
const fs = require('fs-extra');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const LOGO_PATH = path.join(ROOT_DIR, 'public/logo.svg');
const ICONS_DIR = path.join(ROOT_DIR, 'src-tauri/icons');

async function buildIcons() {
  console.log(`Building application icons from ${LOGO_PATH}...`);

  // Ensure output directory exists
  await fs.ensureDir(ICONS_DIR);

  // Generate PNGs required by src-tauri/tauri.conf.json
  const requiredPngs = [
    { file: '32x32.png', size: 32 },
    { file: '128x128.png', size: 128 },
    { file: '128x128@2x.png', size: 256 },
  ];

  console.log('Generating required PNG files...');
  for (const { file, size } of requiredPngs) {
    const outputPath = path.join(ICONS_DIR, file);
    await sharp(LOGO_PATH).resize(size, size).png().toFile(outputPath);
    console.log(`  ✓ Generated ${file}`);
  }

  // Generate .icns (macOS) and .ico (Windows) using icon-gen
  console.log('Generating platform-specific icon files...');

  try {
    await generateIcon(LOGO_PATH, ICONS_DIR, {
      icns: {
        name: 'icon',
        sizes: [16, 32, 64, 128, 256, 512, 1024],
      },
      ico: {
        name: 'icon',
        sizes: [16, 32, 64, 128, 256],
      },
      report: true,
    });
    console.log('  ✓ Generated icon.icns (macOS)');
    console.log('  ✓ Generated icon.ico (Windows)');
  } catch (error) {
    console.error('Error generating icns/ico files:', error.message);
    console.log('Continuing anyway - PNG files were generated successfully.');
  }

  console.log('\n✅ Icon generation complete!');
}

buildIcons().catch(error => {
  console.error('Failed to build icons:', error);
  process.exit(1);
});
