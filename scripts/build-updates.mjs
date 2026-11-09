import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION_CONFIG_PATH = path.join(ROOT, 'version.config.json');

if (!fs.existsSync(DIST)) {
  console.error('dist directory not found. Run vite build first.');
  process.exit(1);
}

const versionConfig = JSON.parse(fs.readFileSync(VERSION_CONFIG_PATH, 'utf8'));

const EXCLUDED_NAMES = new Set(['Bahtak.apk', 'version.json', 'subtitles.srt']);
const isExcluded = (relPosix) => {
  const name = path.posix.basename(relPosix);
  if (EXCLUDED_NAMES.has(name)) return true;
  if (relPosix.endsWith('.mp4')) return true;
  if (relPosix === 'updates' || relPosix.startsWith('updates/')) return true;
  if (relPosix === 'assets/univ_logos' || relPosix.startsWith('assets/univ_logos/')) return true;
  return false;
};

function collectFiles(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (rel === 'updates' || rel === 'assets/univ_logos') continue;
      out.push(...collectFiles(full, rel));
    } else if (entry.isFile() && !isExcluded(rel)) {
      out.push({ rel, full });
    }
  }
  return out;
}

// Compute deterministic SHA-256 buildId of app web assets (ignoring any existing bahtak-web-id meta tag)
const indexHtmlPath = path.join(DIST, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const stripMeta = (html) =>
  html.replace(/\s*<meta\s+name="bahtak-web-id"\s+content="[^"]*"\s*\/?>/gi, '');

const initialFiles = collectFiles(DIST).sort((a, b) => a.rel.localeCompare(b.rel));
const hash = crypto.createHash('sha256');
hash.update(`apk:${versionConfig.apkVersionCode}:`);
for (const file of initialFiles) {
  hash.update(file.rel + '\0');
  if (file.rel === 'index.html') {
    hash.update(stripMeta(fs.readFileSync(file.full, 'utf8')));
  } else {
    hash.update(fs.readFileSync(file.full));
  }
}
const webBuildId = hash.digest('hex').slice(0, 12);

// Inject <meta name="bahtak-web-id" content="..." /> into dist/index.html
const cleanHtml = stripMeta(indexHtml);
const stampedHtml = cleanHtml.replace(
  /<\/head>/i,
  `  <meta name="bahtak-web-id" content="${webBuildId}" />\n  </head>`,
);
fs.writeFileSync(indexHtmlPath, stampedHtml, 'utf8');

// Pure JS CRC32 table (compatible with every Node version)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x5421, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

const finalFiles = collectFiles(DIST).sort((a, b) => a.rel.localeCompare(b.rel));
const zipBuffer = buildZip(
  finalFiles.map((f) => ({
    name: f.rel,
    data: fs.readFileSync(f.full),
  })),
);

const updatesDir = path.join(DIST, 'updates');
fs.mkdirSync(updatesDir, { recursive: true });
const bundleZipPath = path.join(updatesDir, 'web-bundle.zip');
fs.writeFileSync(bundleZipPath, zipBuffer);

const manifest = {
  apk: {
    versionCode: Number(versionConfig.apkVersionCode) || 1,
    versionName: String(versionConfig.apkVersionName || '1.0.0'),
    url: `https://bahtek.site/Bahtak.apk?v=${Number(versionConfig.apkVersionCode) || 1}`,
    notes: String(versionConfig.apkNotes || ''),
    mandatory: Boolean(versionConfig.apkMandatory),
  },
  web: {
    buildId: webBuildId,
    url: `https://bahtek.site/updates/web-bundle.zip?v=${webBuildId}`,
    size: zipBuffer.length,
  },
};

fs.writeFileSync(path.join(DIST, 'version.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `[build-updates] webBuildId=${webBuildId}, apkVersion=${manifest.apk.versionCode} (${manifest.apk.versionName}), bundle=${(zipBuffer.length / 1024).toFixed(1)} KB (${finalFiles.length} files)`,
);
