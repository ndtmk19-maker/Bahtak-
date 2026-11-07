import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function merge() {
  const root = path.resolve('.');
  const videoIn = path.join(root, 'demo-recordings', 'video', 'bahtak_synced_recording.webm');
  const audioIn = path.join(root, 'demo-recordings', 'audio', 'voiceover_dz.mp3');
  const srtIn = path.join(root, 'demo-recordings', 'subtitles.srt');
  const outputMp4 = path.join(root, 'demo-recordings', 'bahtak_tutorial_final.mp4');
  const publicMp4 = path.join(root, 'public', 'bahtak_tutorial.mp4');

  if (!fs.existsSync(videoIn)) {
    console.error(`❌ ملف الفيديو المسجل غير موجود: ${videoIn}`);
    process.exit(1);
  }
  if (!fs.existsSync(audioIn)) {
    console.error(`❌ ملف الصوت غير موجود: ${audioIn}`);
    process.exit(1);
  }

  console.log('🔄 جاري دمج وضغط الفيديو النهائي بجودة فائقة Full HD 1080p مع الصوت والترجمة...');

  // أمر FFmpeg عالي الجودة والاحترافية
  const cmd = `ffmpeg -y -i "${videoIn}" -i "${audioIn}" -i "${srtIn}" -map 0:v:0 -map 1:a:0 -map 2:s:0? -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -c:s mov_text -metadata:s:s:0 language=ara -metadata:s:s:0 title="العربية (الدارجة الجزائرية)" -movflags +faststart -shortest "${outputMp4}"`;

  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });

  // نسخ الملف إلى مجلد public ليكون متاحاً للمعاينة والتحميل المباشر من المتصفح
  fs.copyFileSync(outputMp4, publicMp4);

  // استخراج لقطات تأكيدية لكل مشهد
  const shotsDir = path.join(root, 'demo-recordings', 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const snaps = [
    { name: 'snap_01_intro.png', time: '00:00:12' },
    { name: 'snap_02_step1.png', time: '00:00:34' },
    { name: 'snap_03_step2.png', time: '00:00:54' },
    { name: 'snap_04_step3.png', time: '00:01:25' },
    { name: 'snap_05_step4.png', time: '00:01:50' },
    { name: 'snap_06_outro.png', time: '00:02:12' },
  ];

  for (const s of snaps) {
    const dest = path.join(shotsDir, s.name);
    try {
      execSync(`ffmpeg -y -ss ${s.time} -i "${outputMp4}" -frames:v 1 -q:v 2 "${dest}"`, { stdio: 'ignore' });
    } catch {}
  }

  const stats = fs.statSync(outputMp4);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n🎉 تم إنتاج وتصدير الفيديو الشارح النهائي بنجاح!`);
  console.log(`📁 المسار: ${outputMp4}`);
  console.log(`🌐 الرابط المباشر في المتصفح: http://localhost:8443/bahtak_tutorial.mp4`);
  console.log(`📊 الحجم: ${sizeMb} ميغابايت`);
}

merge().catch(err => {
  console.error('حدث خطأ أثناء الدمج:', err);
  process.exit(1);
});
