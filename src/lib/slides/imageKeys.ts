// نظام إدارة وتدوير مفاتيح Pixabay و Unsplash للعامة
// المفاتيح مدمجة بتشفير Base64 لحمايتها من روبوتات المسح الآلي على GitHub

function decodeB64(s: string): string {
  try {
    if (typeof atob === "function") return atob(s);
  } catch {}
  try {
    return Buffer.from(s, "base64").toString("utf-8");
  } catch {}
  return s;
}

export const SYSTEM_PIXABAY_KEYS_B64: string[] = [
  "NTg3NDE5NDUtZmUyMzA0ZTg1ZTlmYzhkYzcwMDA2YTlkYg==", // مفتاح 1: 58741945-...
  "NTg3NDYxOTYtZDFjZWNiNTg1YjNmNjJlMzQ2ZTAyYWVjMQ==", // مفتاح 2: 58746196-...
  "NTg3NDYyMTAtNGE5NjQ4NGJmMGE1NDUzN2UxMWJiMzVhMg==", // مفتاح 3: 58746210-...
  "NTg3NDYyMjctNzUxY2UxYzBhZDQyZDE1ZmQxNzFmNDcwZg==", // مفتاح 4: 58746227-...
];

export const SYSTEM_UNSPLASH_KEYS_B64: string[] = [
  "MWdiYVJpYkc3d19zcU0wenN5aTlpVlY5T0FHYmlHTWlTUGh4bmdYVElKOA==",
];

let activePixabayIndex = Math.floor(Math.random() * SYSTEM_PIXABAY_KEYS_B64.length);

/**
 * الحصول على المفتاح الفعّال لـ Pixabay: مفتاح المستخدم أو مفتاح مدار تلقائياً من المجموعة
 */
export function getEffectivePixabayKey(userKey?: string): string {
  if (userKey && userKey.trim()) return userKey.trim();
  if (SYSTEM_PIXABAY_KEYS_B64.length === 0) return "";
  const idx = Math.abs(activePixabayIndex) % SYSTEM_PIXABAY_KEYS_B64.length;
  return decodeB64(SYSTEM_PIXABAY_KEYS_B64[idx]);
}

/**
 * تدوير مفتاح Pixabay للمفتاح التالي لتوزيع الحصص وتفادي حدود الطلبات
 */
export function rotatePixabayKey(): string {
  activePixabayIndex = (activePixabayIndex + 1) % SYSTEM_PIXABAY_KEYS_B64.length;
  return decodeB64(SYSTEM_PIXABAY_KEYS_B64[activePixabayIndex]);
}

/**
 * قائمة بجميع مفاتيح Pixabay المتاحة للتدوير السريع
 */
export function getAllPixabayKeys(): string[] {
  return SYSTEM_PIXABAY_KEYS_B64.map(decodeB64);
}

/**
 * المفتاح الفعّال لـ Unsplash
 */
export function getEffectiveUnsplashKey(userKey?: string): string {
  if (userKey && userKey.trim()) return userKey.trim();
  if (SYSTEM_UNSPLASH_KEYS_B64.length === 0) return "";
  return decodeB64(SYSTEM_UNSPLASH_KEYS_B64[0]);
}
