/** تحويل صورة إلى Base64 لتضمينها ذاتياً في ملف Word أو PowerPoint */
export async function imageToDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;

  let targetUrl = url;
  if (targetUrl.includes('/api/image-proxy?url=')) {
    try {
      const raw = decodeURIComponent(targetUrl.split('/api/image-proxy?url=')[1]);
      if (raw && raw.startsWith('http')) {
        targetUrl = raw;
      }
    } catch {}
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || targetUrl);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(targetUrl);
        }
      };
      img.onerror = () => resolve(targetUrl);
      img.src = targetUrl;
    });
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
