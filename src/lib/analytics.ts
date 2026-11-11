import { supabase, isSupabaseConfigured, getEstimatedServerNowMs } from './supabase';
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
  /** يُفعّل وقت العرض فقط عندما يكون توقيت الحدث في السحابة متقدماً عن ساعة الخادم */
  clockSkewed?: boolean;
}

interface StoredResearchEvent extends ResearchEvent {
  synced?: boolean;
}

const LOCAL_STORAGE_KEY = 'bahtak_analytics_events';
const RECENT_LOG_LIMIT = 500;
export const FUTURE_SKEW_TOLERANCE_MS = 90_000;
export const ANALYTICS_UPDATED_EVENT = 'bahtak:analytics-updated';
let lastApkTrackAt = 0;

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function notifyAnalyticsUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ANALYTICS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

function parseTimestampMs(iso?: string): number {
  if (!iso) return Number.NaN;
  return Date.parse(iso);
}

function stripInternalEventFields(ev: StoredResearchEvent, clockSkewed?: boolean): ResearchEvent {
  const { synced: _synced, ...clean } = ev;
  return clockSkewed ? { ...clean, clockSkewed: true } : clean;
}

export function getDeviceType(): 'iOS' | 'Android' | 'Desktop' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Desktop';
  if (isIOS()) return 'iOS';
  if (/Android/i.test(navigator.userAgent)) return 'Android';
  return 'Desktop';
}

/**
 * تسجيل حدث جديد (زيارة، توليد بحث، تصدير PDF، تصدير Word، PowerPoint، تحميل APK)
 * يُحفظ محلياً في الكاش ويُرسل لسحابة Supabase بتوقيت الخادم المعتمد (DEFAULT NOW())
 */
export async function trackEvent(
  event: Omit<ResearchEvent, 'id' | 'created_at' | 'device' | 'clockSkewed'> & {
    device?: 'iOS' | 'Android' | 'Desktop';
  },
): Promise<void> {
  const device = event.device || getDeviceType();
  const eventId = generateEventId();
  const fullEvent: StoredResearchEvent = {
    ...event,
    id: eventId,
    device,
    created_at: new Date(getEstimatedServerNowMs()).toISOString(),
    synced: false,
  };

  // 1. الحفظ في التخزين المحلي (Local Storage) فوراً
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: StoredResearchEvent[] = raw ? JSON.parse(raw) : [];
      list.unshift(fullEvent);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, RECENT_LOG_LIMIT)));
      notifyAnalyticsUpdated();
    }
  } catch (err) {
    console.warn('Local analytics storage error:', err);
  }

  // 2. الإرسال إلى سحابة Supabase مع ترك created_at لتوقيت قاعدة البيانات (NOW())
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('research_logs').insert([
        {
          id: eventId,
          event_type: fullEvent.event_type,
          topic: fullEvent.topic || null,
          pages_count: fullEvent.pages_count || 0,
          university: fullEvent.university || null,
          device: fullEvent.device,
        },
      ]);

      if (error) {
        // إذا كان الجدول لم ينشأ بعد في Supabase
        console.info('Supabase research_logs info:', error.message);
      } else {
        try {
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            const list: StoredResearchEvent[] = raw ? JSON.parse(raw) : [];
            const nextList = list.map((item) =>
              item.id === eventId ? { ...item, synced: true } : item,
            );
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
          }
        } catch {
          /* ignore */
        }
        notifyAnalyticsUpdated();
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
  serverNowMs: number;
  futureSkewCount: number;
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

function getEventDedupKey(ev: ResearchEvent): string {
  if (ev.id) return `id:${ev.id}`;
  return `${ev.event_type}|${ev.topic || ''}|${ev.created_at}`;
}

/**
 * جلب جميع الإحصائيات المسجلة من Supabase (إجماليات دقيقة عبر كل السجلات) مع فرز زمني مضبوط بتوقيت الخادم
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

        // إذا امتلأ الحد الأقصى بأحداث ذات ساعة جهاز متقدمة، نجلب أحدث الأحداث ضمن توقيت الخادم الفعلي
        const syncNowMs = getEstimatedServerNowMs();
        const cutoffIso = new Date(syncNowMs + FUTURE_SKEW_TOLERANCE_MS).toISOString();
        const futureRowsCount = events.filter(
          (ev) => parseTimestampMs(ev.created_at) > syncNowMs + FUTURE_SKEW_TOLERANCE_MS,
        ).length;

        if (futureRowsCount > 0 && events.length >= RECENT_LOG_LIMIT) {
          const { data: normalBackfill, error: backfillErr } = await supabase
            .from('research_logs')
            .select('*')
            .lte('created_at', cutoffIso)
            .order('created_at', { ascending: false })
            .limit(RECENT_LOG_LIMIT);
          if (!backfillErr && Array.isArray(normalBackfill)) {
            const mergedMap = new Map<string, ResearchEvent>();
            for (const row of [...(normalBackfill as ResearchEvent[]), ...events]) {
              mergedMap.set(getEventDedupKey(row), row);
            }
            events = Array.from(mergedMap.values());
          }
        }
      }
    } catch {
      isCloudSynced = false;
    }
  }

  const referenceNowMs = getEstimatedServerNowMs();
  const futureCutoffMs = referenceNowMs + FUTURE_SKEW_TOLERANCE_MS;

  // 2. الدمج مع الأحداث المحلية غير المتزامنة أو الرجوع للتخزين المحلي عند عدم الاتصال
  let unsyncedLocal: ResearchEvent[] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const localEvents: StoredResearchEvent[] = JSON.parse(raw);
        if (!isCloudSynced) {
          events = localEvents.map((e) => stripInternalEventFields(e));
        } else {
          const existingIds = new Set(events.map((e) => e.id).filter(Boolean));
          const validCloudMs = events
            .map((e) => parseTimestampMs(e.created_at))
            .filter((ms) => Number.isFinite(ms) && ms <= futureCutoffMs);
          const isTruncated = events.length >= RECENT_LOG_LIMIT;
          const oldestCloudMs = isTruncated && validCloudMs.length > 0 ? Math.min(...validCloudMs) : 0;

          unsyncedLocal = localEvents
            .filter((e) => {
              if (e.synced === true) return false;
              if (e.id && existingIds.has(e.id)) return false;

              const localMs = parseTimestampMs(e.created_at);
              // منع تكرار الأحداث المحلية القديمة التي لم تكن تحمل معرّفاً (Z مقابل +00:00)
              if (!e.id) {
                const matchesCloudByFields = events.some((cloudEv) => {
                  if (cloudEv.event_type !== e.event_type) return false;
                  if ((cloudEv.topic || null) !== (e.topic || null)) return false;
                  const cloudMs = parseTimestampMs(cloudEv.created_at);
                  return (
                    Number.isFinite(localMs) &&
                    Number.isFinite(cloudMs) &&
                    Math.abs(cloudMs - localMs) <= 5000
                  );
                });
                if (matchesCloudByFields) return false;

                if (events.length > 0 && Number.isFinite(localMs) && localMs < referenceNowMs - 120_000) {
                  return false;
                }
              }
              if (!isTruncated || !Number.isFinite(localMs)) return true;
              return localMs >= oldestCloudMs;
            })
            .map((e) => stripInternalEventFields(e));

          if (unsyncedLocal.length > 0) {
            events = [...events, ...unsyncedLocal];
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading local events:', err);
  }

  // 3. فصل الأحداث ذات الساعة المستقبلية المختلة حتى لا تحجب التحديثات الحقيقية في أعلى القائمة
  const validEvents: ResearchEvent[] = [];
  const skewedEvents: ResearchEvent[] = [];
  for (const ev of events) {
    const ms = parseTimestampMs(ev.created_at);
    if (Number.isFinite(ms) && ms > futureCutoffMs) {
      skewedEvents.push({ ...ev, clockSkewed: true });
    } else {
      validEvents.push({ ...ev, clockSkewed: false });
    }
  }

  const sortDesc = (a: ResearchEvent, b: ResearchEvent) => {
    const msA = parseTimestampMs(a.created_at);
    const msB = parseTimestampMs(b.created_at);
    return (Number.isFinite(msB) ? msB : 0) - (Number.isFinite(msA) ? msA : 0);
  };
  validEvents.sort(sortDesc);
  skewedEvents.sort(sortDesc);
  events = [...validEvents, ...skewedEvents];

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
    serverNowMs: referenceNowMs,
    futureSkewCount: skewedEvents.length,
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
 * الاشتراك في التحديثات الحية للإحصائيات عبر Supabase Realtime + التبويبات المحلية
 */
export function subscribeToAnalyticsUpdates(onChange: () => void): () => void {
  const cleanups: Array<() => void> = [];

  if (typeof window !== 'undefined') {
    const handleLocalUpdate = () => onChange();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) onChange();
    };
    window.addEventListener(ANALYTICS_UPDATED_EVENT, handleLocalUpdate);
    window.addEventListener('storage', handleStorage);
    cleanups.push(() => {
      window.removeEventListener(ANALYTICS_UPDATED_EVENT, handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
    });
  }

  if (isSupabaseConfigured) {
    try {
      const channel = supabase
        .channel(`research_logs_live_${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'research_logs' },
          () => onChange(),
        )
        .subscribe();

      cleanups.push(() => {
        void supabase.removeChannel(channel);
      });
    } catch {
      /* تجاهل إذا لم يكن Realtime مفعلاً */
    }
  }

  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
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
