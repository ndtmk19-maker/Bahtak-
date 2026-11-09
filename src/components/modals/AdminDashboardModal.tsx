import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudCheck,
  Copy,
  Database,
  Download,
  FileDown,
  FileText,
  GraduationCap,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Monitor,
  Presentation,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Modal, ModalHeader } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useUI } from '../../state/UIContext';
import {
  getAnalyticsStats,
  SUPABASE_RESEARCH_LOGS_SQL,
  type AnalyticsStats,
  type ResearchEvent,
} from '../../lib/analytics';

const ADMIN_PASSWORD = '1919';
const AUTH_STORAGE_KEY = 'bahtak_admin_auth_token';

export function AdminDashboardModal() {
  const { adminModalOpen, setAdminModalOpen, toast } = useUI();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_STORAGE_KEY) === ADMIN_PASSWORD;
    } catch {
      return false;
    }
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // تحميل الإحصائيات عند الفتح والمصادقة
  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getAnalyticsStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminModalOpen && isAuthenticated) {
      loadStats();
    }
  }, [adminModalOpen, isAuthenticated]);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput.trim() === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError(false);
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, ADMIN_PASSWORD);
      } catch {}
      setPasswordInput('');
      toast('تم تسجيل الدخول للوحة الإدارة بنجاح', { tone: 'success' });
    } else {
      setAuthError(true);
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    toast('تم قفل لوحة الإدارة', { tone: 'info' });
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_RESEARCH_LOGS_SQL);
      setCopiedSql(true);
      toast('تم نسخ كود SQL بنجاح', {
        description: 'الصقه في SQL Editor في حسابك في Supabase واضغط Run.',
        tone: 'success',
      });
      setTimeout(() => setCopiedSql(false), 4000);
    } catch {
      toast('تعذر نسخ الكود تلقائياً', { tone: 'error' });
    }
  };

  const handleClearLocal = () => {
    if (window.confirm('هل تريد بالتأكيد مسح سجل الإحصائيات المخزن محلياً على هذا الجهاز؟')) {
      try {
        localStorage.removeItem('bahtak_analytics_events');
        loadStats();
        toast('تم مسح السجل المحلي بنجاح', { tone: 'info' });
      } catch {}
    }
  };

  const handleExportJson = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bahtak_stats_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = useMemo(() => {
    if (!stats?.events) return [];
    return stats.events.filter((ev) => {
      if (filterType !== 'all' && ev.event_type !== filterType) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.topic?.toLowerCase().includes(q) ||
        ev.university?.toLowerCase().includes(q) ||
        ev.device?.toLowerCase().includes(q)
      );
    });
  }, [stats?.events, filterType, searchQuery]);

  if (!adminModalOpen) return null;

  return (
    <Modal
      open={adminModalOpen}
      onClose={() => setAdminModalOpen(false)}
      labelledBy="admin-modal-title"
      size="lg"
    >
      {!isAuthenticated ? (
        /* شاشة إدخال رمز المرور السري */
        <div>
          <ModalHeader
            id="admin-modal-title"
            title="لوحة التحكم السرية للموقع"
            subtitle="هذه الصفحة خاصة بمالك الموقع فقط لمتابعة الزوار والبحوث"
            icon={<Lock className="size-5" />}
            onClose={() => setAdminModalOpen(false)}
          />
          <form onSubmit={handleLogin} className="p-6 sm:p-8 flex flex-col items-center text-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md mb-4">
              <KeyRound className="size-8" />
            </span>
            <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-white">
              أدخل رمز المرور السري
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
              يرجى إدخال الرمز السري المكون من 4 أرقام الذي حددته للدخول إلى لوحة المتابعة.
            </p>

            <div className="mt-6 w-full max-w-xs">
              <input
                data-autofocus
                type="password"
                maxLength={8}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(false);
                }}
                placeholder="• • • •"
                className={`w-full text-center text-2xl font-mono tracking-[0.5em] py-3.5 rounded-2xl border bg-black/[0.02] dark:bg-white/[0.04] text-zinc-900 dark:text-white outline-none transition ${
                  authError
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-black/15 dark:border-white/15 focus:border-zinc-900 dark:focus:border-white focus:ring-2 focus:ring-black/5'
                }`}
              />
              {authError && (
                <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 animate-rise">
                  رمز المرور غير صحيح. يرجى المحاولة مرة أخرى.
                </p>
              )}
            </div>

            <div className="mt-6 flex w-full max-w-xs gap-2">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                className="flex-1 justify-center !rounded-2xl !py-3.5"
              >
                دخول اللوحة ➔
              </Button>
              <Button
                variant="ghost"
                size="lg"
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="!rounded-2xl"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* شاشة لوحة الإحصائيات الكاملة */
        <div>
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs">
                <BarChart3 className="size-5" />
              </span>
              <div>
                <h2 id="admin-modal-title" className="text-base font-bold text-zinc-900 dark:text-white">
                  لوحة إحصائيات منصة «بحثك»
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold ${
                      stats?.isCloudSynced
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${stats?.isCloudSynced ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {stats?.isCloudSynced ? 'مزامنة حية مع Supabase' : 'تخزين محلي (يتطلب كود SQL)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadStats}
                disabled={loading}
                title="تحديث البيانات"
                className="grid size-9 place-items-center rounded-xl text-zinc-600 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="قفل اللوحة والخروج"
                className="grid size-9 place-items-center rounded-xl text-zinc-600 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <LogOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                title="إغلاق"
                className="grid size-9 place-items-center rounded-xl text-zinc-600 dark:text-zinc-400 transition hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex flex-col gap-5 text-sm">
            {/* بطاقات الإحصائيات الكبرى */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <Users className="size-3.5 text-zinc-600 dark:text-zinc-300" /> زوار الموقع
                </span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                  {stats?.totalVisits ?? 0}
                </div>
                <span className="text-[0.66rem] text-zinc-400">جلسات الدخول</span>
              </div>

              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <Sparkles className="size-3.5 text-zinc-600 dark:text-zinc-300" /> بحوث مولدة
                </span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                  {stats?.totalGenerations ?? 0}
                </div>
                <span className="text-[0.66rem] text-zinc-400">بالذكاء الاصطناعي</span>
              </div>

              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <Printer className="size-3.5 text-zinc-600 dark:text-zinc-300" /> تصدير PDF
                </span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                  {stats?.totalPdfExports ?? 0}
                </div>
                <span className="text-[0.66rem] text-zinc-400">طباعة / حفظ PDF</span>
              </div>

              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <FileDown className="size-3.5 text-zinc-600 dark:text-zinc-300" /> تصدير Word
                </span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                  {stats?.totalWordExports ?? 0}
                </div>
                <span className="text-[0.66rem] text-zinc-400">ملفات .doc محملة</span>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-center">
                <span className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <Presentation className="size-3.5 text-zinc-600 dark:text-zinc-300" /> PowerPoint
                </span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                  {stats?.totalPptxExports ?? 0}
                </div>
                <span className="text-[0.66rem] text-zinc-400">عروض .pptx محملة</span>
              </div>
            </div>

            {/* توزيع الأجهزة ومستعملي المنصة */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4">
              <h4 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 mb-3 flex items-center justify-between">
                <span>توزيع أجهزة المستخدمين:</span>
                <span className="text-[0.72rem] font-normal text-zinc-400">
                  إجمالي المسجل: {(stats?.devices.ios ?? 0) + (stats?.devices.android ?? 0) + (stats?.devices.desktop ?? 0)}
                </span>
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-zinc-800/70 p-2.5">
                  <span className="flex items-center justify-center gap-1 text-[0.74rem] font-medium text-zinc-600 dark:text-zinc-300">
                    <Smartphone className="size-3.5 text-zinc-700 dark:text-zinc-300" /> آيفون (iOS)
                  </span>
                  <div className="mt-1 font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                    {stats?.devices.ios ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-zinc-800/70 p-2.5">
                  <span className="flex items-center justify-center gap-1 text-[0.74rem] font-medium text-zinc-600 dark:text-zinc-300">
                    <Smartphone className="size-3.5 text-emerald-600 dark:text-emerald-400" /> أندرويد
                  </span>
                  <div className="mt-1 font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                    {stats?.devices.android ?? 0}
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-zinc-800/70 p-2.5">
                  <span className="flex items-center justify-center gap-1 text-[0.74rem] font-medium text-zinc-600 dark:text-zinc-300">
                    <Monitor className="size-3.5 text-blue-600 dark:text-blue-400" /> كمبيوتر
                  </span>
                  <div className="mt-1 font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                    {stats?.devices.desktop ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* بطاقة إرشاد تفعيل الحفظ السحابي في Supabase */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-4">
              <button
                type="button"
                onClick={() => setShowSqlGuide((v) => !v)}
                className="flex w-full items-center justify-between text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-zinc-700 dark:text-zinc-300" />
                  <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    تفعيل الحفظ السحابي الدائم في Supabase (بنقرة واحدة)
                  </span>
                </div>
                {showSqlGuide ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
              </button>

              {showSqlGuide && (
                <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 animate-rise">
                  <p>
                    لتخزين كل الزيارات والبحوث في قاعدة بيانات Supabase مدى الحياة حتى تراها من أي جهاز في العالم:
                  </p>
                  <ol className="mt-2 list-decimal list-inside space-y-1">
                    <li>افتح حسابك في <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="font-bold underline text-zinc-900 dark:text-white">Supabase Dashboard</a> وافتح مشروعك.</li>
                    <li>اضغط على <strong>SQL Editor</strong> من القائمة الجانبية.</li>
                    <li>انسخ كود الـ SQL أدناه، الصقه واضغط على زر <strong>Run</strong> الأخضر.</li>
                  </ol>

                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-black/5 dark:bg-white/5 p-2.5 font-mono text-[0.7rem]">
                    <span className="truncate">CREATE TABLE IF NOT EXISTS public.research_logs...</span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={copiedSql ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      onClick={handleCopySql}
                      className="shrink-0 !rounded-lg !py-1 !px-2.5 !text-xs"
                    >
                      {copiedSql ? 'تم النسخ!' : 'نسخ كود SQL'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* سجل العمليات الحية ومواضيع البحوث */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="size-4" /> سجل العمليات والبحوث الأخيرة:
                </h4>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="بحث في المواضيع..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 pr-8 pl-2.5 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-900 dark:focus:border-white"
                    />
                  </div>

                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none"
                  >
                    <option value="all">كل الأحداث</option>
                    <option value="generate">بحوث مولدة</option>
                    <option value="visit">زيارات</option>
                    <option value="export_pdf">تصدير PDF</option>
                    <option value="export_word">تصدير Word</option>
                    <option value="export_pptx">تصدير PowerPoint</option>
                  </select>
                </div>
              </div>

              {/* جدول السجل */}
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 scroll-thin">
                {filteredEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    لا توجد أحداث مطابقة حالياً. بمجرد قيام أي زائر ببحث أو زيارة، ستظهر تفاصيلها هنا فوراً.
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredEvents.map((ev, idx) => (
                      <div key={ev.id || `${ev.created_at}-${idx}`} className="flex items-center justify-between p-3 text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-lg text-[0.7rem] ${
                              ev.event_type === 'generate'
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold'
                                : ev.event_type === 'visit'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                : ev.event_type === 'export_pdf'
                                ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                : ev.event_type === 'export_pptx'
                                ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {ev.event_type === 'generate' ? '⚡' : ev.event_type === 'visit' ? '👁️' : ev.event_type === 'export_pdf' ? '📄' : ev.event_type === 'export_pptx' ? '📊' : '📝'}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-zinc-900 dark:text-white truncate">
                              {ev.topic || (ev.event_type === 'visit' ? 'زيارة جديدة للمنصة' : 'بدون عنوان')}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[0.68rem] text-zinc-400">
                              {ev.pages_count ? <span>{ev.pages_count} {ev.event_type === 'export_pptx' ? 'شريحة' : 'صفحة A4'} ·</span> : null}
                              {ev.university ? <span className="truncate">{ev.university} ·</span> : null}
                              <span>جهاز: {ev.device || 'غير محدد'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 pe-2">
                          <span className="text-[0.66rem] text-zinc-400 font-mono">
                            {formatRelativeDate(ev.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* أزرار الإجراءات السفلية */}
            <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4">
              <button
                type="button"
                onClick={handleClearLocal}
                className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
              >
                <Trash2 className="size-3.5" /> مسح السجل المحلي
              </button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="size-3.5" />}
                  onClick={handleExportJson}
                  className="!rounded-xl !text-xs"
                >
                  تصدير JSON
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAdminModalOpen(false)}
                  className="!rounded-xl !text-xs !bg-zinc-900 dark:!bg-white !text-white dark:!text-zinc-950"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function formatRelativeDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    return new Date(iso).toLocaleDateString('ar-DZ');
  } catch {
    return iso;
  }
}
