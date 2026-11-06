import { createClient } from '@supabase/supabase-js';

// بيانات الاتصال بقاعدة بيانات Supabase الخاصة بموقع «بحثك»
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vtibsaplkpefbvkwrtnf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5qoCZhYRppMgJvqCfQI3wA_8m-O2s9q';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      .limit(60);

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
