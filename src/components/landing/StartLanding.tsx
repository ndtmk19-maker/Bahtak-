import { useState, useEffect, useCallback, useRef } from 'react';
import { Presentation } from 'lucide-react';
import { BackgroundPaths } from '../ui/background-paths';
import { MetallicButton } from '../ui/metallic-button';
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
      description="منصة مخصصة للطلبة والباحثين لتنسيق وتوليد البحوث الأكاديمية الجزائرية وفق المعايير الرسمية (A4) — مع الغلاف وشعار جامعتك من بين 69 ولاية، شجرة الخطة، ترقيم الهوامش، والتحميل المباشر لـ PDF وتصدير Word."
      buttonText="ابدأ الآن بإنشاء بحثك"
      onStart={handleStart}
      hasSaved={hasSaved}
      onContinueSaved={handleContinue}
      onLogoClick={handleLogoClick}
      secondaryAction={
        <MetallicButton
          tone="secondary"
          ariaLabel="أو أنشئ عرضاً تقديمياً PowerPoint جديد"
          onClick={handleSlides}
          baseColor="#09090b"
          sheenColor="#e4e4e7"
          bandCount={3}
          edgeBlur={0.55}
          flowAngle={35}
          zoom={8}
          redFringe={0.22}
          blueFringe={0.28}
          idleSpeed={0.45}
          hoverSpeed={0.95}
          clickSpeed={2.2}
          contentClassName="gap-2 sm:gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 text-[0.82rem] sm:text-[0.95rem] font-bold"
        >
          {({ isHovered }) => (
            <>
              <span
                className={`grid size-7 sm:size-8 shrink-0 place-items-center rounded-full bg-white text-zinc-950 shadow-xs transition-transform duration-300 ${
                  isHovered ? 'scale-105' : 'scale-100'
                }`}
              >
                <Presentation className="size-3.5 sm:size-4" />
              </span>
              <span className="text-zinc-100">أو أنشئ عرضاً تقديمياً PowerPoint</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[0.64rem] font-bold text-zinc-100">
                جديد
              </span>
            </>
          )}
        </MetallicButton>
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
