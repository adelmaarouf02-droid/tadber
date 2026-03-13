import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, List, Search, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { quranApi } from '../services/quranApi';
import { Surah } from '../types/quran';
import { useFirebase } from '../context/FirebaseContext';

export const Audio: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const { userData, updateAudioProgress } = useFirebase();

  useEffect(() => {
    const fetchSurahs = async () => {
      const data = await quranApi.getSurahs();
      setSurahs(data);
      setFilteredSurahs(data);
    };
    fetchSurahs();
  }, []);

  useEffect(() => {
    const filtered = surahs.filter(s => 
      s.name.includes(searchQuery) || 
      s.englishName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSurahs(filtered);
  }, [searchQuery, surahs]);

  const handlePlaySurah = async (surah: Surah) => {
    setCurrentSurah(surah);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.husarymujawwad/${surah.number}.mp3`;
      
      const playAudio = async () => {
        try {
          playPromiseRef.current = audioRef.current!.play();
          await playPromiseRef.current;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error("Audio playback failed:", err);
            setIsPlaying(false);
          }
        }
      };

      // Resume from saved progress if available
      const savedProgress = userData?.audioProgress?.[surah.number] || 0;
      if (savedProgress > 0 && savedProgress < 99) {
        // We need to wait for metadata to be loaded to set currentTime accurately
        audioRef.current.onloadedmetadata = () => {
          if (audioRef.current) {
            audioRef.current.currentTime = (savedProgress / 100) * audioRef.current.duration;
            playAudio();
          }
        };
      } else {
        playAudio();
      }
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        try {
          playPromiseRef.current = audioRef.current.play();
          await playPromiseRef.current;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error("Audio playback failed:", err);
            setIsPlaying(false);
          }
        }
      }
    }
  };

  const handleNext = () => {
    if (!currentSurah) return;
    const nextNum = currentSurah.number + 1;
    const nextSurah = surahs.find(s => s.number === (nextNum > 114 ? 1 : nextNum));
    if (nextSurah) handlePlaySurah(nextSurah);
  };

  const handlePrev = () => {
    if (!currentSurah) return;
    const prevNum = currentSurah.number - 1;
    const prevSurah = surahs.find(s => s.number === (prevNum < 1 ? 114 : prevNum));
    if (prevSurah) handlePlaySurah(prevSurah);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && currentSurah) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      if (duration) {
        const currentProgress = (current / duration) * 100;
        setProgress(currentProgress);

        // Throttle updates to Firestore (every 5 seconds or when finished)
        const now = Date.now();
        if (now - lastUpdateRef.current > 5000 || currentProgress >= 99) {
          updateAudioProgress(currentSurah.number, Math.round(currentProgress));
          lastUpdateRef.current = now;
        }
      }
    }
  };

  return (
    <div className="space-y-8">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
      />

      {/* Player Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-stone-900 text-white rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-24 h-24 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Music size={48} />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">{currentSurah?.name || 'اختر سورة'}</h2>
            <p className="text-stone-400 text-sm">{currentSurah?.englishName || 'مشاري راشد العفاسي'}</p>
          </div>
        </div>

        <div className="space-y-2 relative z-10">
          <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-emerald-500"
              animate={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-stone-500 font-mono">
            <span>00:00</span>
            <span>--:--</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 relative z-10">
          <button 
            onClick={handlePrev}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <SkipForward size={24} />
          </button>
          <button 
            onClick={togglePlay}
            className="w-16 h-16 bg-white text-stone-950 rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </button>
          <button 
            onClick={handleNext}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <SkipBack size={24} />
          </button>
        </div>
      </motion.div>

      {/* Surah List for Audio */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold flex items-center gap-2 shrink-0">
            <List size={20} className="text-emerald-600" />
            قائمة السور
          </h3>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder="ابحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-100 dark:bg-stone-900 border-none rounded-xl py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-emerald-600 transition-all"
            />
          </div>
        </div>

        <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredSurahs.map((surah) => {
            const surahProgress = userData?.audioProgress?.[surah.number] || 0;
            const isCompleted = surahProgress >= 99;

            return (
              <button
                key={surah.number}
                onClick={() => handlePlaySurah(surah)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all group relative overflow-hidden ${
                  currentSurah?.number === surah.number 
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" 
                  : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 hover:border-stone-200"
                }`}
              >
                {/* Individual Surah Progress Bar */}
                {surahProgress > 0 && !isCompleted && (
                  <div className="absolute bottom-0 left-0 h-1 bg-emerald-600/20 w-full">
                    <div 
                      className="h-full bg-emerald-600/40 transition-all duration-300" 
                      style={{ width: `${surahProgress}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    {/* Circular Progress Ring */}
                    {surahProgress > 0 && (
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                        <circle
                          cx="24"
                          cy="24"
                          r="22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-stone-100 dark:text-stone-800"
                        />
                        <motion.circle
                          cx="24"
                          cy="24"
                          r="22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray="138.23"
                          initial={{ strokeDashoffset: 138.23 }}
                          animate={{ strokeDashoffset: 138.23 - (surahProgress / 100) * 138.23 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="text-emerald-600"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-colors relative z-10 ${
                      currentSurah?.number === surah.number 
                      ? "bg-emerald-600 text-white" 
                      : isCompleted
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-500 group-hover:bg-stone-200"
                    }`}>
                      {isCompleted ? <CheckCircle2 size={16} /> : surah.number}
                    </div>
                  </div>
                  <div className="text-right">
                    <h4 className={`font-bold text-sm ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                      {surah.name}
                    </h4>
                    <p className="text-[10px] text-stone-500">
                      {surah.englishName} 
                      {surahProgress > 0 && !isCompleted && ` • ${surahProgress}%`}
                    </p>
                  </div>
                </div>
                
                <div className="relative z-10">
                  {currentSurah?.number === surah.number && isPlaying ? (
                    <div className="flex gap-1 items-end h-4">
                      <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-emerald-600 rounded-full" />
                    </div>
                  ) : (
                    <Play size={18} className={`${isCompleted ? 'text-emerald-600' : 'text-stone-300'} group-hover:text-emerald-600 transition-colors`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};


