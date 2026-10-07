// Copies the built debug APK to releases/pump-up-v<version>.apk,
// taking the version from package.json (also set versionName in android/app/build.gradle).
import fs from "fs";
import path from "path";

const root = process.cwd();
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const src = path.join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");

if (!fs.existsSync(src)) {
  console.error("APK not found at", src, "— run the Gradle build first (see DEPLOYMENT.md).");
  process.exit(1);
}

const outDir = path.join(root, "releases");
fs.mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, `pump-up-v${version}.apk`);
fs.copyFileSync(src, dest);
console.log(`Exported APK -> ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`);
