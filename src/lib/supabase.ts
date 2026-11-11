import { createClient } from '@supabase/supabase-js';

// بيانات الاتصال بقاعدة بيانات Supabase الخاصة بموقع «بحثك»
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vtibsaplkpefbvkwrtnf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5qoCZhYRppMgJvqCfQI3wA_8m-O2s9q';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let lastServerEpochMs: number | null = null;
let lastServerMonotonicMs = 0;

function getMonotonicMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

const supabaseFetch: typeof fetch = async (input, init) => {
  const method = (
    init?.method ||
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
  ).toUpperCase();

  // منع المتصفح أو WebView من تقديم إحصائيات قديمة مخزنة مؤقتاً
  const nextInit: RequestInit | undefined =
    method === 'GET' || method === 'HEAD'
      ? { ...init, cache: init?.cache ?? 'no-store' }
      : init;

  const response = await fetch(input, nextInit);
  const dateHeader = response.headers.get('date');
  if (dateHeader) {
    const parsed = Date.parse(dateHeader);
    if (Number.isFinite(parsed)) {
      lastServerEpochMs = parsed;
      lastServerMonotonicMs = getMonotonicMs();
    }
  }
  return response;
};

/** إرجاع التوقيت التقديري للخادم (UTC بالمللي ثانية) لتفادي تأثير اختلال ساعة الجهاز المحلي */
export function getEstimatedServerNowMs(): number {
  if (lastServerEpochMs === null) return Date.now();
  return Math.round(lastServerEpochMs + Math.max(0, getMonotonicMs() - lastServerMonotonicMs));
}

export function hasSyncedServerClock(): boolean {
  return lastServerEpochMs !== null;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
});

export interface DbReview {
  id: string;
  name: string;
  university: string;
  rating: number;
  comment: string;
  city?: string;
  country?: string;
  created_at?: string;
}

/** جلب جميع التقييمات الحية لجميع الزوار من Supabase */
export async function getSupabaseReviews(): Promise<DbReview[]> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) {
      console.warn('Supabase fetch error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Supabase network error:', err);
    return [];
  }
}

/** إرسال تقييم جديد إلى Supabase ليظهر لجميع الناس في العالم */
export async function insertSupabaseReview(review: {
  name: string;
  university: string;
  rating: number;
  comment: string;
  city?: string;
  country?: string;
}): Promise<DbReview | null> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert([
        {
          name: review.name,
          university: review.university,
          rating: review.rating,
          comment: review.comment,
          city: review.city || 'الجزائر',
          country: review.country || 'DZ',
        },
      ])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase network error:', err);
    return null;
  }
}
