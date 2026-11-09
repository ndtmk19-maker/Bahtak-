import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ANDROID_PUBLIC = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');

execSync('npx @capacitor/cli sync android', { cwd: ROOT, stdio: 'inherit' });

// إزالة الملفات الكبيرة أو الخاصة بالسيرفر حتى لا تُدمج مرتين داخل ملف APK
for (const rel of ['Bahtak.apk', 'version.json', 'subtitles.srt', 'updates']) {
  const target = path.join(ANDROID_PUBLIC, rel);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

for (const entry of fs.readdirSync(ANDROID_PUBLIC)) {
  if (entry.endsWith('.mp4')) {
    fs.rmSync(path.join(ANDROID_PUBLIC, entry), { force: true });
  }
}

console.log('[sync-android] Android public assets cleaned and ready for Gradle.');
