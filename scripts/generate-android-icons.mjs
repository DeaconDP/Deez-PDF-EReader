// Generates the Android launcher icons and splash images from the iOS app icon,
// so both platforms share one source of truth. Run: node scripts/generate-android-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon~ios-marketing.png');
const RES = join(root, 'android/app/src/main/res');
const ICON_BG = '#000000';
const SPLASH_BG = '#060810'; // matches the iOS splash (scripts/generate-icons.mjs)

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** White glyph on transparent, cut from the black-and-white source by luminance. */
async function glyph(size) {
  const alpha = await sharp(SOURCE).resize(size, size).greyscale().raw().toBuffer();
  const white = Buffer.alloc(size * size * 4, 255);
  for (let i = 0; i < size * size; i++) white[i * 4 + 3] = alpha[i];
  return sharp(white, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

/** Glyph centred on a transparent canvas, scaled to `ratio` of it. */
async function centredGlyph(canvas, ratio) {
  const inner = Math.round(canvas * ratio);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await glyph(inner), gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function write(buffer, path) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(buffer).png().toFile(path);
}

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${name}`);
  // Legacy square icon (48dp): the source icon as-is.
  const legacy = Math.round(48 * scale);
  await write(await sharp(SOURCE).resize(legacy, legacy).toBuffer(), join(dir, 'ic_launcher.png'));
  // Legacy round icon: source icon masked to a circle.
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await write(
    await sharp(SOURCE).resize(legacy, legacy).composite([{ input: circle, blend: 'dest-in' }]).toBuffer(),
    join(dir, 'ic_launcher_round.png'),
  );
  // Adaptive foreground (108dp canvas; glyph kept inside the 66dp safe zone).
  const fg = Math.round(108 * scale);
  await write(await centredGlyph(fg, 0.7), join(dir, 'ic_launcher_foreground.png'));
}

// Splash images (pre-Android 12 and the Capacitor SplashScreen plugin).
const SPLASHES = {
  drawable: [480, 320],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
};
for (const [dir, [w, h]] of Object.entries(SPLASHES)) {
  const logo = await glyph(Math.round(Math.min(w, h) * 0.3));
  const png = await sharp({ create: { width: w, height: h, channels: 4, background: SPLASH_BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
  await write(png, join(RES, dir, 'splash.png'));
}

console.log('Android icons and splash written to', RES);
