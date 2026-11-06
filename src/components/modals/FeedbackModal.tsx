import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Check, Heart, MessageSquareHeart, Send, User } from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { StarRating } from '../ui/star-rating';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';
import { useDocument } from '../../state/DocumentContext';

const RATING_LABELS: Record<number, string> = {
  5: 'ممتاز جداً! سعداء بأن المنصة نالت إعجابك وفادتك 🌟',
  4: 'جيد جداً! شكراً لثقتك ودعمك لمنصة بحثك 👏',
  3: 'جيد، ونعمل باستمرار على تحسين التجربة وتطويرها 👍',
  2: 'نعتذر عن أي تقصير، نود معرفة ما يمكن تحسينه 💬',
  1: 'نأسف لتجربتك، أخبرنا بما واجهته لنصلحه فوراً 🙏',
  0: 'اضغط على النجوم لتحديد تقييمك لتجربة المنصة',
};

export function FeedbackModal() {
  const { feedbackOpen, setFeedbackOpen, toast } = useUI();
  const { doc } = useDocument();
  const [name, setName] = useState<string>('');
  const [university, setUniversity] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  // استرجاع تقييم سابق إن وُجد، أو ملء البيانات تلقائياً من صفحة الغلاف الحالية
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bahtak_user_feedback');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.name === 'string') setName(parsed.name);
        if (typeof parsed?.university === 'string') setUniversity(parsed.university);
        if (typeof parsed?.rating === 'number') setRating(parsed.rating);
        if (typeof parsed?.comment === 'string') setComment(parsed.comment);
      } else {
        if (doc?.coverState?.universityName) {
          setUniversity(doc.coverState.universityName);
        }
      }
    } catch {
      /* ignore */
    }
  }, [doc]);

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
      window.dispatchEvent(new CustomEvent('bahtak:review-added'));
    } catch {
      /* ignore */
    }

    setSubmitted(true);
    toast('شكراً لتقييمك!', {
      description: 'تم تسجيل رأيك بنجاح وسيظهر في قائمة تقييمات المنصة.',
      tone: 'success',
    });

    setTimeout(() => {
      close();
    }, 2400);
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

      <div className="p-5 sm:p-6 text-right">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-8 text-center"
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
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed">
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
              className="space-y-4"
            >
              {/* قسم النجوم */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  اختر تقييمك من 5 نجوم:
                </span>
                <div className="py-1.5" dir="ltr">
                  <StarRating
                    size="lg"
                    showValue
                    value={rating}
                    onValueChange={(val) => setRating(val)}
                    label="تقييم منصة بحثك"
                  />
                </div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1.5 min-h-[1.25rem] transition-all">
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
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
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
                    className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
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
                  rows={3}
                  className="w-full resize-none rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30"
                />
              </div>

              {/* أزرار الإجراء */}
              <div className="flex items-center justify-between gap-3 pt-1">
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
      </div>
    </Modal>
  );
}
