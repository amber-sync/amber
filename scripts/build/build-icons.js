const sharp = require('sharp');
const generateIcon = require('icon-gen');
const fs = require('fs-extra');
const path = require('path');

const LOGO_PATH = path.join(__dirname, 'public/logo.svg');
const ICONS_DIR = path.join(__dirname, 'build/icons');

async function buildIcons() {
  console.log('Building application icons from public/logo.svg...');

  // Ensure build/icons directory exists
  await fs.ensureDir(ICONS_DIR);

  // Icon sizes needed
  const sizes = [16, 32, 64, 128, 256, 512, 1024];

  // Generate PNG files at different sizes
  console.log('Generating PNG files...');
  for (const size of sizes) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await sharp(LOGO_PATH).resize(size, size).png().toFile(outputPath);
    console.log(`  ✓ Generated icon-${size}.png`);
  }

  // Generate tray icon (16x16 for macOS menu bar)
  const trayPath = path.join(ICONS_DIR, 'tray.png');
  await sharp(LOGO_PATH).resize(16, 16).png().toFile(trayPath);
  console.log('  ✓ Generated tray.png (16x16)');

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
