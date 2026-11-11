// منشئ حزم ZIP (PKZIP) خفيف بدون تبعيات خارجية لبناء ملفات Word (.docx) القياسية مباشرة في المتصفح وNode

export interface ZipEntryInput {
  name: string;
  data: string | Uint8Array;
  /** تعطيل الضغط للصور المضغوطة مسبقاً مثل PNG/JPEG */
  store?: boolean;
}

const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type CompressionStreamCtor = new (format: string) => {
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
};

async function deflateRaw(input: Uint8Array): Promise<Uint8Array | null> {
  const Ctor = (globalThis as unknown as { CompressionStream?: CompressionStreamCtor })
    .CompressionStream;
  if (!Ctor || input.length < 64) return null;
  try {
    const cs = new Ctor('deflate-raw');
    const outPromise = new Response(cs.readable).arrayBuffer();
    const writer = cs.writable.getWriter();
    await writer.write(input);
    await writer.close();
    const out = new Uint8Array(await outPromise);
    return out.length < input.length ? out : null;
  } catch {
    return null;
  }
}

export async function createDocxZip(entries: ZipEntryInput[]): Promise<Uint8Array> {
  const prepared = await Promise.all(
    entries.map(async (entry) => {
      const nameBytes = textEncoder.encode(entry.name);
      const raw = typeof entry.data === 'string' ? textEncoder.encode(entry.data) : entry.data;
      const crc = crc32(raw);
      const compressed = entry.store ? null : await deflateRaw(raw);
      const payload = compressed ?? raw;
      const method = compressed ? 8 : 0;
      return { nameBytes, raw, payload, crc, method };
    }),
  );

  let offset = 0;
  let cdSize = 0;
  const localOffsets: number[] = [];

  for (const item of prepared) {
    localOffsets.push(offset);
    offset += 30 + item.nameBytes.length + item.payload.length;
    cdSize += 46 + item.nameBytes.length;
  }

  const totalSize = offset + cdSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  const UTF8_FLAG = 0x0800;
  const DOS_TIME = 0x0000;
  const DOS_DATE = 0x5421; // 2022-01-01

  // 1. Local File Headers + Payloads
  let cursor = 0;
  for (const item of prepared) {
    view.setUint32(cursor, 0x04034b50, true);
    view.setUint16(cursor + 4, 20, true);
    view.setUint16(cursor + 6, UTF8_FLAG, true);
    view.setUint16(cursor + 8, item.method, true);
    view.setUint16(cursor + 10, DOS_TIME, true);
    view.setUint16(cursor + 12, DOS_DATE, true);
    view.setUint32(cursor + 14, item.crc, true);
    view.setUint32(cursor + 18, item.payload.length, true);
    view.setUint32(cursor + 22, item.raw.length, true);
    view.setUint16(cursor + 26, item.nameBytes.length, true);
    view.setUint16(cursor + 28, 0, true);
    out.set(item.nameBytes, cursor + 30);
    out.set(item.payload, cursor + 30 + item.nameBytes.length);
    cursor += 30 + item.nameBytes.length + item.payload.length;
  }

  // 2. Central Directory
  const cdOffset = cursor;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    view.setUint32(cursor, 0x02014b50, true);
    view.setUint16(cursor + 4, 20, true);
    view.setUint16(cursor + 6, 20, true);
    view.setUint16(cursor + 8, UTF8_FLAG, true);
    view.setUint16(cursor + 10, item.method, true);
    view.setUint16(cursor + 12, DOS_TIME, true);
    view.setUint16(cursor + 14, DOS_DATE, true);
    view.setUint32(cursor + 16, item.crc, true);
    view.setUint32(cursor + 20, item.payload.length, true);
    view.setUint32(cursor + 24, item.raw.length, true);
    view.setUint16(cursor + 28, item.nameBytes.length, true);
    view.setUint16(cursor + 30, 0, true);
    view.setUint16(cursor + 32, 0, true);
    view.setUint16(cursor + 34, 0, true);
    view.setUint16(cursor + 36, 0, true);
    view.setUint32(cursor + 38, 0, true);
    view.setUint32(cursor + 42, localOffsets[i], true);
    out.set(item.nameBytes, cursor + 46);
    cursor += 46 + item.nameBytes.length;
  }

  // 3. End of Central Directory Record
  view.setUint32(cursor, 0x06054b50, true);
  view.setUint16(cursor + 4, 0, true);
  view.setUint16(cursor + 6, 0, true);
  view.setUint16(cursor + 8, prepared.length, true);
  view.setUint16(cursor + 10, prepared.length, true);
  view.setUint32(cursor + 12, cdSize, true);
  view.setUint32(cursor + 16, cdOffset, true);
  view.setUint16(cursor + 20, 0, true);

  return out;
}
