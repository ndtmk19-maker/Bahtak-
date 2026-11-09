import { useState, useEffect, useCallback, useRef } from 'react';
import { Presentation } from 'lucide-react';
import { BackgroundPaths } from '../ui/background-paths';
import { useUI } from '../../state/UIContext';
import { useDocument } from '../../state/DocumentContext';
import { TestimonialGlobe, getStoredAndDefaultReviews, type GlobeTestimonial } from '../ui/testimonial-globe';
import { getSupabaseReviews, type DbReview } from '../../lib/supabase';

// إحداثيات قارية على اليابسة (الجزائر ومناطق متباعدة) لضمان عدم سقوط أي نقطة في البحر
const LAND_COORDINATES = [
  { lat: 36.75, lng: 3.06, defaultCity: 'الجزائر العاصمة' },
  { lat: 41.88, lng: -87.63, defaultCity: 'وهران' },
  { lat: 39.90, lng: 116.41, defaultCity: 'قسنطينة' },
  { lat: 35.69, lng: -0.63, defaultCity: 'وهران' },
  { lat: 36.36, lng: 6.61, defaultCity: 'قسنطينة' },
  { lat: 36.19, lng: 5.41, defaultCity: 'سطيف' },
  { lat: 36.90, lng: 7.76, defaultCity: 'عنابة' },
  { lat: 34.88, lng: -1.31, defaultCity: 'تلمسان' },
  { lat: 35.55, lng: 6.17, defaultCity: 'باتنة' },
  { lat: 31.95, lng: 5.32, defaultCity: 'ورقلة' },
  { lat: 33.36, lng: 6.86, defaultCity: 'الوادي' },
  { lat: 32.48, lng: 3.67, defaultCity: 'غرداية' },
];

export function StartLanding() {
  const { setShowLanding, setViewMode, setWizardStep, setFeedbackOpen, setAdminModalOpen, setProduct } = useUI();
  const { doc } = useDocument();
  const [reviews, setReviews] = useState<GlobeTestimonial[]>(() => getStoredAndDefaultReviews());
  const logoClicksRef = useRef(0);

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0;
      setAdminModalOpen(true);
    }
    setTimeout(() => {
      logoClicksRef.current = 0;
    }, 1500);
  };

  // جلب التقييمات الحية من قاعدة بيانات Supabase لجميع الزوار
  const refreshReviews = useCallback(async () => {
    try {
      const dbReviews = await getSupabaseReviews();
      if (Array.isArray(dbReviews) && dbReviews.length > 0) {
        const formatted: GlobeTestimonial[] = dbReviews.map((item, idx) => {
          const coord = LAND_COORDINATES[idx % LAND_COORDINATES.length];
          return {
            id: item.id,
            quote: item.comment,
            name: item.name,
            role: 'طالب باحث',
            company: item.university,
            city: item.city || coord.defaultCity,
            country: item.country || 'DZ',
            lat: coord.lat,
            lng: coord.lng,
            rating: item.rating,
            tone: (((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5),
          };
        });
        setReviews(formatted);
        return;
      }
    } catch {
      /* ignore */
    }
    // في حال تعذر الاتصال، الاعتماد على التقييمات المحلية والافتراضية
    setReviews(getStoredAndDefaultReviews());
  }, []);

  useEffect(() => {
    refreshReviews();

    const handleUpdate = () => {
      refreshReviews();
    };

    window.addEventListener('bahtak:review-added', handleUpdate);
    return () => window.removeEventListener('bahtak:review-added', handleUpdate);
  }, [refreshReviews]);

  const handleStart = () => {
    setProduct('research');
    setViewMode('wizard');
    setWizardStep(1);
    setShowLanding(false);
  };

  const handleContinue = () => {
    setProduct('research');
    setViewMode('wizard');
    setShowLanding(false);
  };

  const handleSlides = () => {
    setProduct('slides');
    setShowLanding(false);
  };

  const handleAddReview = () => {
    setFeedbackOpen(true);
  };

  const hasSaved = Boolean(
    doc?.coverState?.title?.trim() || doc?.pages?.some((p) => p?.content?.trim())
  );

  return (
    <BackgroundPaths
      title="ارتقِ ببحوثك إلى مستوى آخر"
      subtitle="Bahtak — بحثك"
      description="منصة مخصصة للطلبة والباحثين لتنسيق وتوليد البحوث الأكاديمية الجزائرية وفق المعايير الرسمية (A4) — مع الغلاف وشعار جامعتك من بين 69 ولاية، شجرة الخطة، ترقيم الهوامش، والطباعة المباشرة لـ PDF وتصدير Word."
      buttonText="ابدأ الآن بإنشاء بحثك"
      onStart={handleStart}
      hasSaved={hasSaved}
      onContinueSaved={handleContinue}
      onLogoClick={handleLogoClick}
      secondaryAction={
        <button
          type="button"
          onClick={handleSlides}
          className="group inline-flex items-center gap-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 px-5 py-3 text-[0.95rem] font-bold text-neutral-900 dark:text-neutral-100 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white dark:hover:bg-neutral-900 cursor-pointer"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <Presentation className="size-4" />
          </span>
          <span>أو أنشئ عرضاً تقديمياً PowerPoint</span>
          <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[0.66rem] font-bold">جديد</span>
        </button>
      }
      extraContent={
        <div id="reviews-section" className="w-full py-6 sm:py-10">
          <TestimonialGlobe
            items={reviews}
            eyebrow="آراء موثوقة من جامعات الجزائر 🇩🇿"
            heading="ماذا يقول الطلبة والباحثون عن تجربة «بحثك»؟"
            caption="تجارب حقيقية لطلبة الجامعات الجزائرية بعد إعداد وتنسيق وطباعة بحوثهم الأكاديمية وفق المعايير الرسمية."
            autoplay={true}
            interval={4500}
            onAddReview={handleAddReview}
          />
        </div>
      }
    />
  );
}

export default StartLanding;
