import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const src = resolve("APP logo.png");

// Web icons (always)
await sharp(src).resize(32, 32).png().toFile("public/favicon.png");
await sharp(src).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icon-512.png");
console.log("✓ Web icons generated");

// Android launcher icons (only once `npx cap add android` has created the project)
if (existsSync("android")) {
  const androidSizes = [
    { dir: "android/app/src/main/res/mipmap-mdpi", size: 48 },
    { dir: "android/app/src/main/res/mipmap-hdpi", size: 72 },
    { dir: "android/app/src/main/res/mipmap-xhdpi", size: 96 },
    { dir: "android/app/src/main/res/mipmap-xxhdpi", size: 144 },
    { dir: "android/app/src/main/res/mipmap-xxxhdpi", size: 192 },
  ];
  for (const { dir, size } of androidSizes) {
    mkdirSync(dir, { recursive: true });
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      await sharp(src).resize(size, size).png().toFile(join(dir, name));
    }
    // Adaptive icon foreground: 108dp canvas, launchers crop to the inner 72dp,
    // so the logo sits in the middle 72/108 with the logo's black around it.
    const canvas = Math.round((size * 108) / 48);
    const logo = Math.round((canvas * 72) / 108);
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: "#000000" } })
      .composite([{ input: await sharp(src).resize(logo, logo).png().toBuffer(), gravity: "center" }])
      .png()
      .toFile(join(dir, "ic_launcher_foreground.png"));
    console.log(`✓ ${size}x${size} → ${dir}`);
  }

  // Black background behind the adaptive icon, to match the logo
  const bg = "android/app/src/main/res/values/ic_launcher_background.xml";
  writeFileSync(bg, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n`);
}
