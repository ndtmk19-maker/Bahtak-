import { supabase, isSupabaseConfigured } from './supabase';
import { isIOS } from './printDocument';

export interface ResearchEvent {
  id?: string;
  event_type: 'visit' | 'generate' | 'export_pdf' | 'export_word';
  topic?: string;
  pages_count?: number;
  university?: string;
  device?: 'iOS' | 'Android' | 'Desktop';
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'bahtak_analytics_events';

export function getDeviceType(): 'iOS' | 'Android' | 'Desktop' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Desktop';
  if (isIOS()) return 'iOS';
  if (/Android/i.test(navigator.userAgent)) return 'Android';
  return 'Desktop';
}

/**
 * تسجيل حدث جديد (زيارة، توليد بحث، تصدير PDF، تصدير Word)
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

export interface AnalyticsStats {
  events: ResearchEvent[];
  isCloudSynced: boolean;
  totalVisits: number;
  totalGenerations: number;
  totalPdfExports: number;
  totalWordExports: number;
  devices: {
    ios: number;
    android: number;
    desktop: number;
  };
}

/**
 * جلب جميع الإحصائيات المسجلة من Supabase مع الرجوع للكاش المحلي
 */
export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  let events: ResearchEvent[] = [];
  let isCloudSynced = false;

  // 1. محاولة الجلب من Supabase
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('research_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data && data.length > 0) {
        events = data as ResearchEvent[];
        isCloudSynced = true;
      } else if (!error && data && data.length === 0) {
        isCloudSynced = true; // الجدول موجود وشغال لكن لا توجد صفوف بعد
      }
    } catch {
      isCloudSynced = false;
    }
  }

  // 2. الدمج أو الرجوع إلى التخزين المحلي
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const localEvents: ResearchEvent[] = JSON.parse(raw);
        if (!isCloudSynced || events.length === 0) {
          events = localEvents;
        } else {
          // دمج الأحداث المحلية غير الموجودة في السحابة
          const existingTimestamps = new Set(events.map((e) => e.created_at));
          const missing = localEvents.filter((e) => !existingTimestamps.has(e.created_at));
          events = [...events, ...missing].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      }
    }
  } catch (err) {
    console.warn('Error reading local events:', err);
  }

  const totalVisits = events.filter((e) => e.event_type === 'visit').length;
  const totalGenerations = events.filter((e) => e.event_type === 'generate').length;
  const totalPdfExports = events.filter((e) => e.event_type === 'export_pdf').length;
  const totalWordExports = events.filter((e) => e.event_type === 'export_word').length;

  const devices = {
    ios: events.filter((e) => e.device === 'iOS').length,
    android: events.filter((e) => e.device === 'Android').length,
    desktop: events.filter((e) => e.device === 'Desktop').length,
  };

  return {
    events,
    isCloudSynced,
    totalVisits,
    totalGenerations,
    totalPdfExports,
    totalWordExports,
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
