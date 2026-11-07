# Openverse API — Free Sound Effects & Background Music

**API Endpoint:** `https://api.openverse.org/v1/`  
**Search Audio:** `https://api.openverse.org/v1/audio/?q=`  
**License:** 100% Free / Creative Commons / Public Domain (No copyright strikes)

Over 2.5 million royalty-free sound effects, ambient audio, and music tracks for motion graphics and promo videos.

## Search Audio via API (cURL):
```bash
curl -X GET "https://api.openverse.org/v1/audio/?q=whoosh+ui+tech&license_type=all" -H "accept: application/json"
```

## Quick Node.js Search Function:
```javascript
async function searchSoundEffects(query) {
  const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&page_size=5`;
  const res = await fetch(url);
  const data = await res.json();
  
  return (data.results || []).map(audio => ({
    title: audio.title,
    creator: audio.creator,
    url: audio.url,
    download_url: audio.download_url,
    duration: audio.duration,
    license: audio.license
  }));
}

// Example usage:
// const whooshSfx = await searchSoundEffects('interface click pop whoosh');
```

## Recommended Queries for Product/App Videos:
- `whoosh` : انتقال حركي سريع وسلس
- `pop` / `click` : نقر الأزرار والتفاعل
- `ambient tech` : موسيقى خلفية تقنية هادئة
- `shimmer` / `chime` : نجاح العملية وتوليد الذكاء الاصطناعي
