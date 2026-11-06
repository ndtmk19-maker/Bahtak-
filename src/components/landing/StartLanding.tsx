import { useState, useEffect } from 'react';
import { BackgroundPaths } from '../ui/background-paths';
import { useUI } from '../../state/UIContext';
import { useDocument } from '../../state/DocumentContext';
import { TestimonialGlobe, getStoredAndDefaultReviews, type GlobeTestimonial } from '../ui/testimonial-globe';

export function StartLanding() {
  const { setShowLanding, setViewMode, setWizardStep, setFeedbackOpen } = useUI();
  const { doc } = useDocument();
  const [reviews, setReviews] = useState<GlobeTestimonial[]>(() => getStoredAndDefaultReviews());

  useEffect(() => {
    const handleUpdate = () => {
      setReviews(getStoredAndDefaultReviews());
    };
    window.addEventListener('bahtak:review-added', handleUpdate);
    return () => window.removeEventListener('bahtak:review-added', handleUpdate);
  }, []);

  const handleStart = () => {
    setViewMode('wizard');
    setWizardStep(1);
    setShowLanding(false);
  };

  const handleContinue = () => {
    setViewMode('wizard');
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
      description="منصة مخصصة للطلبة والباحثين لتنسيق وتوليد البحوث الأكاديمية الجزائرية وفق المعايير الرسمية (A4) — مع الغلاف وشعار جامعتك من بين 58 ولاية، شجرة الخطة، ترقيم الهوامش، والطباعة المباشرة لـ PDF وتصدير Word."
      buttonText="ابدأ الآن بإنشاء بحثك"
      onStart={handleStart}
      hasSaved={hasSaved}
      onContinueSaved={handleContinue}
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
