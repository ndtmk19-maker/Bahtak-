import { supabase, isSupabaseConfigured } from './supabase';
import { isIOS } from './printDocument';

export type AnalyticsEventType =
  | 'visit'
  | 'generate'
  | 'export_pdf'
  | 'export_word'
  | 'export_pptx'
  | 'download_apk';

export interface ResearchEvent {
  id?: string;
  event_type: AnalyticsEventType;
  topic?: string;
  pages_count?: number;
  university?: string;
  device?: 'iOS' | 'Android' | 'Desktop';
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'bahtak_analytics_events';
const RECENT_LOG_LIMIT = 500;
let lastApkTrackAt = 0;

export function getDeviceType(): 'iOS' | 'Android' | 'Desktop' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Desktop';
  if (isIOS()) return 'iOS';
  if (/Android/i.test(navigator.userAgent)) return 'Android';
  return 'Desktop';
}

/**
 * تسجيل حدث جديد (زيارة، توليد بحث، تصدير PDF، تصدير Word، PowerPoint، تحميل APK)
 * يُحفظ محلياً في الكاش ويُرسل لسحابة Supabase لمزامنته
 */
export async function trackEvent(
  event: Omit<ResearchEvent, 'id' | 'created_at' | 'device'> & { device?: 'iOS' | 'Android' | 'Desktop' }
): Promise<void> {
  const device = event.device || getDeviceType();
  const fullEvent: ResearchEvent = {
    ...event,
    device,
    created_at: new Date().toISOString(),
  };

  // 1. الحفظ في التخزين المحلي (Local Storage) فوراً
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: ResearchEvent[] = raw ? JSON.parse(raw) : [];
      list.unshift(fullEvent);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 500)));
    }
  } catch (err) {
    console.warn('Local analytics storage error:', err);
  }

  // 2. الإرسال إلى سحابة Supabase
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('research_logs').insert([
        {
          event_type: fullEvent.event_type,
          topic: fullEvent.topic || null,
          pages_count: fullEvent.pages_count || 0,
          university: fullEvent.university || null,
          device: fullEvent.device,
          created_at: fullEvent.created_at,
        },
      ]);
      if (error) {
        // إذا كان الجدول لم ينشأ بعد في Supabase
        console.info('Supabase research_logs info:', error.message);
      }
    } catch (err) {
      console.warn('Supabase analytics network error:', err);
    }
  }
}

/**
 * تسجيل تحميل ملف تطبيق الأندرويد (Bahtak.apk) مع منع التكرار اللحظي عند النقر المزدوج
 */
export function trackApkDownload(sourceLabel = 'تحميل تطبيق الأندرويد (APK)'): void {
  const now = Date.now();
  if (now - lastApkTrackAt < 2000) return;
  lastApkTrackAt = now;
  void trackEvent({
    event_type: 'download_apk',
    topic: sourceLabel,
  });
}

export interface AnalyticsStats {
  events: ResearchEvent[];
  isCloudSynced: boolean;
  totalVisits: number;
  totalGenerations: number;
  totalPdfExports: number;
  totalWordExports: number;
  totalPptxExports: number;
  totalApkDownloads: number;
  totalDownloads: number;
  devices: {
    ios: number;
    android: number;
    desktop: number;
  };
}

async function fetchExactCloudCount(
  column: 'event_type' | 'device',
  value: string,
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('research_logs')
      .select('id', { count: 'exact', head: true })
      .eq(column, value);
    if (error || typeof count !== 'number') return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * جلب جميع الإحصائيات المسجلة من Supabase (إجماليات دقيقة عبر كل السجلات) مع الرجوع للكاش المحلي
 */
export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  let events: ResearchEvent[] = [];
  let isCloudSynced = false;
  let cloudCounts: {
    visit: number | null;
    generate: number | null;
    export_pdf: number | null;
    export_word: number | null;
    export_pptx: number | null;
    download_apk: number | null;
    ios: number | null;
    android: number | null;
    desktop: number | null;
  } | null = null;

  // 1. محاولة الجلب والعدّ الدقيق من Supabase
  if (isSupabaseConfigured) {
    try {
      const [
        recentRes,
        visit,
        generate,
        export_pdf,
        export_word,
        export_pptx,
        download_apk,
        ios,
        android,
        desktop,
      ] = await Promise.all([
        supabase
          .from('research_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(RECENT_LOG_LIMIT),
        fetchExactCloudCount('event_type', 'visit'),
        fetchExactCloudCount('event_type', 'generate'),
        fetchExactCloudCount('event_type', 'export_pdf'),
        fetchExactCloudCount('event_type', 'export_word'),
        fetchExactCloudCount('event_type', 'export_pptx'),
        fetchExactCloudCount('event_type', 'download_apk'),
        fetchExactCloudCount('device', 'iOS'),
        fetchExactCloudCount('device', 'Android'),
        fetchExactCloudCount('device', 'Desktop'),
      ]);

      if (!recentRes.error && Array.isArray(recentRes.data)) {
        events = recentRes.data as ResearchEvent[];
        isCloudSynced = true;
        cloudCounts = {
          visit,
          generate,
          export_pdf,
          export_word,
          export_pptx,
          download_apk,
          ios,
          android,
          desktop,
        };
      }
    } catch {
      isCloudSynced = false;
    }
  }

  // 2. الدمج مع الأحداث المحلية غير المتزامنة أو الرجوع للتخزين المحلي عند عدم الاتصال
  let unsyncedLocal: ResearchEvent[] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const localEvents: ResearchEvent[] = JSON.parse(raw);
        if (!isCloudSynced) {
          events = localEvents;
        } else if (events.length === 0) {
          unsyncedLocal = localEvents;
          events = localEvents;
        } else {
          const existingTimestamps = new Set(events.map((e) => e.created_at));
          const isTruncated = events.length >= RECENT_LOG_LIMIT;
          const oldestCloudMs = isTruncated
            ? new Date(events[events.length - 1].created_at).getTime()
            : 0;
          unsyncedLocal = localEvents.filter((e) => {
            if (existingTimestamps.has(e.created_at)) return false;
            if (!isTruncated) return true;
            return new Date(e.created_at).getTime() >= oldestCloudMs;
          });
          if (unsyncedLocal.length > 0) {
            events = [...events, ...unsyncedLocal].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading local events:', err);
  }

  const countFromList = (list: ResearchEvent[], type: AnalyticsEventType) =>
    list.filter((e) => e.event_type === type).length;

  const totalVisits =
    cloudCounts?.visit != null
      ? cloudCounts.visit + countFromList(unsyncedLocal, 'visit')
      : countFromList(events, 'visit');
  const totalGenerations =
    cloudCounts?.generate != null
      ? cloudCounts.generate + countFromList(unsyncedLocal, 'generate')
      : countFromList(events, 'generate');
  const totalPdfExports =
    cloudCounts?.export_pdf != null
      ? cloudCounts.export_pdf + countFromList(unsyncedLocal, 'export_pdf')
      : countFromList(events, 'export_pdf');
  const totalWordExports =
    cloudCounts?.export_word != null
      ? cloudCounts.export_word + countFromList(unsyncedLocal, 'export_word')
      : countFromList(events, 'export_word');
  const totalPptxExports =
    cloudCounts?.export_pptx != null
      ? cloudCounts.export_pptx + countFromList(unsyncedLocal, 'export_pptx')
      : countFromList(events, 'export_pptx');
  const totalApkDownloads =
    cloudCounts?.download_apk != null
      ? cloudCounts.download_apk + countFromList(unsyncedLocal, 'download_apk')
      : countFromList(events, 'download_apk');

  const totalDownloads = totalPdfExports + totalWordExports + totalPptxExports;

  const devices = {
    ios:
      cloudCounts?.ios != null
        ? cloudCounts.ios + unsyncedLocal.filter((e) => e.device === 'iOS').length
        : events.filter((e) => e.device === 'iOS').length,
    android:
      cloudCounts?.android != null
        ? cloudCounts.android + unsyncedLocal.filter((e) => e.device === 'Android').length
        : events.filter((e) => e.device === 'Android').length,
    desktop:
      cloudCounts?.desktop != null
        ? cloudCounts.desktop + unsyncedLocal.filter((e) => e.device === 'Desktop').length
        : events.filter((e) => e.device === 'Desktop').length,
  };

  return {
    events,
    isCloudSynced,
    totalVisits,
    totalGenerations,
    totalPdfExports,
    totalWordExports,
    totalPptxExports,
    totalApkDownloads,
    totalDownloads,
    devices,
  };
}

/**
 * كود SQL لإنشاء جدول research_logs في Supabase
 */
export const SUPABASE_RESEARCH_LOGS_SQL = `-- كود تفعيل جدول إحصائيات بحثك في Supabase
-- افتح حسابك في https://supabase.com ➔ ادخل مشروعك ➔ SQL Editor ➔ الصق هذا الكود واضغط Run

CREATE TABLE IF NOT EXISTS public.research_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    topic TEXT,
    pages_count INT DEFAULT 0,
    university TEXT,
    device TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل سياسة الأمان للقراءة والكتابة
ALTER TABLE public.research_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert" ON public.research_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON public.research_logs FOR SELECT USING (true);
`;
