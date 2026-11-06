// أيقونات العلامات التجارية (غير متوفرة في مكتبة lucide) — مسارات SVG من المشروع الأصلي
export function AndroidIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.996-3.4572c.1054-.1824.043-.4163-.1394-.5217-.1824-.1054-.4163-.043-.5217.1394l-2.0225 3.5031C15.5802 8.2114 13.8443 7.788 12 7.788c-1.8443 0-3.5802.4234-5.1939 1.197L4.7836 5.482c-.1054-.1824-.3393-.2448-.5217-.1394-.1824.1054-.2448.3393-.1394.5217l1.996 3.4572C2.6883 11.2338.3435 14.819 0 19h24c-.3435-4.181-2.6883-7.7662-6.1185-9.6786" />
    </svg>
  );
}

export function InstagramIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function YouTubeIcon({ className = 'w-10 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 68 48" className={className} aria-hidden="true">
      <path
        d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
        fill="#FF0000"
      />
      <path d="M45 24L27 14v20z" fill="#FFFFFF" />
    </svg>
  );
}
