import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Check, Heart, MessageSquareHeart, Send, User } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { StarRating } from '../ui/star-rating';
import { Button } from '../ui/Button';
import { InstagramIcon } from '../ui/BrandIcons';
import { LINKS } from '../../data/defaults';
import { useUI } from '../../state/UIContext';
import { useDocument } from '../../state/DocumentContext';
import { usePresentation } from '../../state/PresentationContext';
import { insertSupabaseReview } from '../../lib/supabase';

const RATING_LABELS: Record<number, string> = {
  5: 'ممتاز جداً! سعداء بأن المنصة نالت إعجابك وفادتك 🌟',
  4: 'جيد جداً! شكراً لثقتك ودعمك لمنصة بحثك 👏',
  3: 'جيد، ونعمل باستمرار على تحسين التجربة وتطويرها 👍',
  2: 'نعتذر عن أي تقصير، نود معرفة ما يمكن تحسينه 💬',
  1: 'نأسف لتجربتك، أخبرنا بما واجهته لنصلحه فوراً 🙏',
  0: 'اضغط على النجوم لتحديد تقييمك لتجربة المنصة',
};

export function FeedbackModal() {
  const { feedbackOpen, setFeedbackOpen, product } = useUI();
  const { doc } = useDocument();
  const presentation = usePresentation();
  const [name, setName] = useState<string>('');
  const [university, setUniversity] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  // استرجاع تقييم سابق إن وُجد، أو ملء الجامعة تلقائياً من بحث A4 أو عرض PowerPoint
  useEffect(() => {
    if (!feedbackOpen) return;
    try {
      const fallbackUniv =
        product === 'slides'
          ? presentation?.meta?.institution || doc?.coverState?.universityName || ''
          : doc?.coverState?.universityName || presentation?.meta?.institution || '';
      const saved = localStorage.getItem('bahtak_user_feedback');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.name === 'string') setName(parsed.name);
        if (typeof parsed?.university === 'string' && parsed.university) {
          setUniversity(parsed.university);
        } else if (fallbackUniv) {
          setUniversity(fallbackUniv);
        }
        if (typeof parsed?.rating === 'number') setRating(parsed.rating);
        if (typeof parsed?.comment === 'string') setComment(parsed.comment);
      } else if (fallbackUniv) {
        setUniversity(fallbackUniv);
      }
    } catch {
      /* ignore */
    }
  }, [feedbackOpen, product, doc?.coverState?.universityName, presentation?.meta?.institution]);

  const close = () => {
    setFeedbackOpen(false);
    setTimeout(() => setSubmitted(false), 300);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const finalName = name.trim();
    const finalUniversity = university.trim();
    const finalComment = comment.trim();

    const reviewItem = {
      id: Date.now().toString(),
      name: finalName || 'طالب باحث',
      university: finalUniversity || 'جامعة جزائرية',
      rating,
      comment: finalComment,
      date: new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' }),
      timestamp: Date.now(),
    };

    try {
      // حفظ التقييم الخاص بالمستخدم
      localStorage.setItem(
        'bahtak_user_feedback',
        JSON.stringify({
          name: finalName,
          university: finalUniversity,
          rating,
          comment: finalComment,
          date: new Date().toISOString(),
        })
      );

      // إضافة التقييم إلى قائمة تقييمات المنصة لظهوره في قائمة الـ reviews
      const existingStr = localStorage.getItem('bahtak_all_reviews');
      const existingReviews = existingStr ? JSON.parse(existingStr) : [];
      // منع التكرار وإضافة التقييم الجديد في المقدمة
      const filtered = Array.isArray(existingReviews) ? existingReviews.filter((r: { id?: string }) => r?.id !== reviewItem.id) : [];
      localStorage.setItem('bahtak_all_reviews', JSON.stringify([reviewItem, ...filtered]));

      // إرسال التقييم مباشرة إلى قاعدة بيانات Supabase ليظهر لجميع الناس في العالم
      insertSupabaseReview({
        name: finalName || 'طالب باحث',
        university: finalUniversity || 'جامعة جزائرية',
        rating,
        comment: finalComment,
        city: 'الجزائر',
        country: 'DZ',
      }).finally(() => {
        window.dispatchEvent(new CustomEvent('bahtak:review-added'));
      });
    } catch {
      /* ignore */
    }

    setSubmitted(true);

    setTimeout(() => {
      close();
    }, 2200);
  };

  return (
    <Modal open={feedbackOpen} onClose={close} labelledBy="feedback-modal-title" size="md">
      <ModalHeader
        id="feedback-modal-title"
        icon={<MessageSquareHeart className="text-amber-500" />}
        title="تقييم ورأي في منصة «بحثك»"
        subtitle="ملاحظتك ورأيك سيظهر للطلبة ويساعد في تحسين وتطوير المنصة"
        onClose={close}
      />

      <div className="p-4 sm:p-5 text-right">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-6 text-center"
            >
              <div className="relative mb-4 grid size-16 place-items-center rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-500 dark:text-amber-400">
                <Heart className="size-8 fill-current animate-pulse" />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-3 stroke-[3]" />
                </span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 font-serif">
                شكراً جزيلاً لتقييمك ومشاركتنا رأيك! 🤍
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mb-5 leading-relaxed">
                تم تسجيل تقييمك بنجاح باسم ({name || 'طالب باحث'}). رأيك يهمنا ويسعدنا جداً!
              </p>
              <Button variant="primary" onClick={close} className="px-6 py-2">
                إغلاق
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3.5"
            >
              {/* قسم النجوم */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3.5 text-center">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  اختر تقييمك من 5 نجوم:
                </span>
                <div className="py-1" dir="ltr">
                  <StarRating
                    size="lg"
                    showValue
                    value={rating}
                    onValueChange={(val) => setRating(val)}
                    label="تقييم منصة بحثك"
                  />
                </div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 min-h-[1.25rem] transition-all">
                  {RATING_LABELS[rating] || RATING_LABELS[0]}
                </p>
              </div>

              {/* حقلا الاسم واللقب واسم الجامعة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="feedback-name" className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    <User className="size-3.5 text-zinc-500" />
                    <span>الاسم واللقب:</span>
                  </label>
                  <input
                    id="feedback-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أمين بلقاسم"
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
                  />
                </div>

                <div>
                  <label htmlFor="feedback-university" className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    <Building2 className="size-3.5 text-zinc-500" />
                    <span>اسم الجامعة / الكلية:</span>
                  </label>
                  <input
                    id="feedback-university"
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="مثال: جامعة الجزائر 3"
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
                  />
                </div>
              </div>

              {/* مربع التعليق والملاحظات */}
              <div>
                <label htmlFor="feedback-comment" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  رأيك أو تعليقك حول المنصة:
                </label>
                <textarea
                  id="feedback-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="اكتب تعليقك هنا... ما رأيك في جودة التنسيق وتجربتك مع المنصة؟"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
                />
              </div>

              {/* أزرار الإجراء */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  لاحقاً
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold shadow-md cursor-pointer"
                >
                  <Send className="size-3.5" />
                  <span>إرسال التقييم</span>
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* رسالة الدعاء وحقوق عمل التطبيق */}
        <div className="mt-4 space-y-2.5 border-t border-black/10 dark:border-white/10 pt-3.5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08] px-3.5 py-2 text-center text-xs font-semibold leading-relaxed text-emerald-900 dark:text-emerald-200">
            🤲 إن أفادتكم المنصة ولو بالقليل، ادعوا لنا بالهداية والتوفيق ولكم بالمثل 🤍
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[0.76rem] text-zinc-600 dark:text-zinc-400">
            <span>هذا التطبيق من عمل:</span>
            <a
              href={LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-3 py-1 font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-black/25 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <InstagramIcon className="size-3.5" />
              <span>@{LINKS.instagramHandle}</span>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
