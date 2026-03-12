import React, { useEffect, useState, useRef } from 'react';
import { Share2, BookOpen, RefreshCw, Download, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { quranApi } from '../services/quranApi';
import { geminiService } from '../services/geminiService';
import { DailyAyah } from '../types/quran';
import { useFirebase } from '../context/FirebaseContext';
import { toPng } from 'html-to-image';

export const Home: React.FC = () => {
  const [dailyAyah, setDailyAyah] = useState<DailyAyah | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { userData } = useFirebase();
  const shareCardRef = useRef<HTMLDivElement>(null);

  const fetchDailyAyah = async () => {
    setLoading(true);
    try {
      const randomAyahNum = Math.floor(Math.random() * 6236) + 1;
      const ayahData = await quranApi.getAyah(randomAyahNum);
      
      const tadabbur = await geminiService.generateTadabbur(
        ayahData.text, 
        (ayahData as any).surah?.name || '', 
        ayahData.numberInSurah
      );

      setDailyAyah({
        text: ayahData.text,
        surah: (ayahData as any).surah?.name || '',
        number: ayahData.numberInSurah,
        translation: (ayahData as any).surah?.englishName || '',
        tafsir: tadabbur
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    if (!dailyAyah) return;
    const text = `${dailyAyah.text}\n\n[${dailyAyah.surah} - الآية ${dailyAyah.number}]\n\nتدبر الآية:\n${dailyAyah.tafsir}\n\nتمت المشاركة عبر تطبيق تدبر`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareImage = async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        backgroundColor: '#f5f5f0',
        style: {
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          width: '600px',
        }
      });

      const link = document.createElement('a');
      link.download = `tadabbur-${dailyAyah?.surah}-${dailyAyah?.number}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error sharing image:', err);
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    fetchDailyAyah();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
        <p className="text-stone-500 animate-pulse">جاري جلب آية اليوم...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden Share Card Template */}
      <div className="fixed -left-[9999px] top-0">
        <div 
          ref={shareCardRef}
          className="bg-[#f5f5f0] p-12 text-stone-900 font-sans"
          dir="rtl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              ت
            </div>
            <span className="text-2xl font-bold tracking-tight">تدبر</span>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-4xl leading-relaxed text-center font-serif text-emerald-800">
                {dailyAyah?.text}
              </p>
              <div className="flex items-center justify-center gap-2 text-stone-500 text-lg">
                <span>{dailyAyah?.surah}</span>
                <span>•</span>
                <span>الآية {dailyAyah?.number}</span>
              </div>
            </div>

            <div className="h-px bg-stone-200 w-full" />

            <div className="space-y-4">
              <h3 className="text-xl font-bold font-serif italic text-emerald-700">تدبر الآية</h3>
              <p className="text-xl leading-relaxed text-stone-700">
                {dailyAyah?.tafsir}
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-stone-200 text-center text-stone-400 text-sm">
            تم التوليد عبر تطبيق تدبر - رحلتك في فهم القرآن
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold font-serif italic">آية اليوم</h2>
          <button 
            onClick={fetchDailyAyah}
            className="text-stone-500 hover:text-emerald-600 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-900/10 border border-emerald-900/20 rounded-3xl p-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BookOpen size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <p className="text-3xl leading-relaxed text-center font-serif text-emerald-800 dark:text-emerald-400">
              {dailyAyah?.text}
            </p>
            
            <div className="flex items-center justify-center gap-2 text-stone-500 text-sm">
              <span>{dailyAyah?.surah}</span>
              <span>•</span>
              <span>الآية {dailyAyah?.number}</span>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <button 
                onClick={handleShareImage}
                disabled={isSharing}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSharing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <ImageIcon size={18} />
                )}
                <span>صورة</span>
              </button>
              <button 
                onClick={handleCopyText}
                className="flex items-center gap-2 px-5 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full text-sm font-bold hover:opacity-90 transition-all active:scale-95"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif italic">تدبر الآية</h2>
        <div className="bg-stone-100 dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800">
          <p className="text-lg leading-relaxed text-stone-700 dark:text-stone-300">
            {dailyAyah?.tafsir}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="bg-stone-100 dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-bold text-emerald-600">{userData?.completedAyahsToday || 0}</span>
          <span className="text-[10px] text-stone-500 uppercase tracking-widest">آيات اليوم</span>
        </div>
        <div className="bg-stone-100 dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-bold text-emerald-600">{userData?.totalMemorized || 0}</span>
          <span className="text-[10px] text-stone-500 uppercase tracking-widest">آيات محفوظة</span>
        </div>
        <div className="bg-stone-100 dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-bold text-emerald-600">{userData?.dailyGoal || 10}</span>
          <span className="text-[10px] text-stone-500 uppercase tracking-widest">الهدف اليومي</span>
        </div>
      </section>
    </div>
  );
};



