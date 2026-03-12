import React, { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, BookOpen, CheckCircle2, Volume2, VolumeX, Play, Pause, Bookmark, BookmarkCheck, Mic, MicOff, Eye, EyeOff, Settings as SettingsIcon, GraduationCap } from 'lucide-react';
import { quranApi } from '../services/quranApi';
import { Surah, SurahDetail, Ayah } from '../types/quran';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../context/FirebaseContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Quran: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [activeSurahs, setActiveSurahs] = useState<SurahDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { incrementAyahCount, getMemorization, toggleMemorizedAyah, userData } = useFirebase();
  const [readAyahs, setReadAyahs] = useState<Set<number>>(new Set());
  const [memorizedAyahs, setMemorizedAyahs] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAyahId, setPlayingAyahId] = useState<number | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const isTeacherModeRef = useRef(false);
  const layout = userData?.quranLayout || 'vertical';
  
  // New States
  const [hideAyahs, setHideAyahs] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningAyahId, setListeningAyahId] = useState<number | null>(null);
  const [voiceMatch, setVoiceMatch] = useState<boolean | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef<boolean>(false);
  const [selectedAyah, setSelectedAyah] = useState<{ayah: Ayah, surah: SurahDetail} | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const toArabicDigits = (num: number) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().replace(/\d/g, d => arabicDigits[parseInt(d)]);
  };

  const formatAyahText = (text: string, numberInSurah: number, surahNumber: number) => {
    if (numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
      const bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ";
      if (text.startsWith(bismillah)) {
        return text.substring(bismillah.length);
      }
      const bismillahVariant = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
      if (text.startsWith(bismillahVariant)) {
        return text.substring(bismillahVariant.length).trim();
      }
    }
    return text;
  };

  const getQuarterMarker = (hizbQuarter: number) => {
    const hizb = Math.ceil(hizbQuarter / 4);
    const juz = Math.ceil(hizbQuarter / 8);
    const remainder = hizbQuarter % 4;
    
    if (hizbQuarter % 8 === 1) return `الجزء ${toArabicDigits(juz)}`;
    if (remainder === 1) return `الحزب ${toArabicDigits(hizb)}`;
    if (remainder === 2) return `ربع الحزب ${toArabicDigits(hizb)}`;
    if (remainder === 3) return `نصف الحزب ${toArabicDigits(hizb)}`;
    if (remainder === 0) return `ثلاثة أرباع الحزب ${toArabicDigits(hizb)}`;
    return '';
  };

  const quranTheme = userData?.quranTheme || 'classic';
  
  useEffect(() => {
    const fetchSurahs = async () => {
      try {
        const data = await quranApi.getSurahs();
        setSurahs(data);
        setFilteredSurahs(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
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

  const handleSurahClick = async (number: number, autoPlayFirst: boolean = false, autoListenFirst: boolean = false) => {
    setLoading(true);
    try {
      const detail = await quranApi.getSurahDetail(number);
      setActiveSurahs([detail]);
      setReadAyahs(new Set()); // Reset read ayahs for new surah
      setSelectedAyah(null); // Reset selected ayah
      const memorized = await getMemorization(number);
      setMemorizedAyahs(memorized);
      
      if (autoPlayFirst && detail.ayahs.length > 0) {
        // Small delay to ensure state is updated and audio is ready
        setTimeout(() => {
          handleAyahClick(detail.ayahs[0], detail);
        }, 100);
      } else if (autoListenFirst && detail.ayahs.length > 0) {
        setTimeout(() => {
          startListening(detail.ayahs[0], detail);
        }, 100);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadNextSurah = async () => {
    if (activeSurahs.length === 0) return;
    const lastSurah = activeSurahs[activeSurahs.length - 1];
    if (lastSurah.number >= 114) return;
    
    setLoadingMore(true);
    try {
      const nextSurah = await quranApi.getSurahDetail(lastSurah.number + 1);
      setActiveSurahs(prev => [...prev, nextSurah]);
      const memorized = await getMemorization(nextSurah.number);
      setMemorizedAyahs(prev => [...new Set([...prev, ...memorized])]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadPreviousSurah = async () => {
    if (activeSurahs.length === 0) return;
    const firstSurah = activeSurahs[0];
    if (firstSurah.number <= 1) return;
    
    setLoadingPrevious(true);
    try {
      const prevSurah = await quranApi.getSurahDetail(firstSurah.number - 1);
      setActiveSurahs(prev => [prevSurah, ...prev]);
      const memorized = await getMemorization(prevSurah.number);
      setMemorizedAyahs(prev => [...new Set([...prev, ...memorized])]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    shouldBeListeningRef.current = false;
    setListeningAyahId(null);
    setVoiceMatch(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const playPromiseRef = useRef<Promise<void> | null>(null);

  const handleAyahClick = async (ayah: Ayah, surah: SurahDetail) => {
    setSelectedAyah({ ayah, surah });
    if (isListening) {
      stopListening();
    }
    
    if (audioRef.current) {
      if (playingAyahId === ayah.number && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingAyahId(null);
        setIsAutoPlaying(false);
        return;
      }

      try {
        audioRef.current.src = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3`;
        setPlayingAyahId(ayah.number);
        
        playPromiseRef.current = audioRef.current.play();
        await playPromiseRef.current;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Audio playback failed:", err);
          setPlayingAyahId(null);
          setIsAutoPlaying(false);
        }
      }
    }
  };

  const handleAudioEnded = () => {
    if (activeSurahs.length === 0 || playingAyahId === null) return;
    
    // Find which surah the playing ayah belongs to
    let currentSurah: SurahDetail | undefined;
    let currentIndex = -1;
    
    for (const surah of activeSurahs) {
      currentIndex = surah.ayahs.findIndex(a => a.number === playingAyahId);
      if (currentIndex !== -1) {
        currentSurah = surah;
        break;
      }
    }

    if (!currentSurah) return;
    
    if (isTeacherModeRef.current) {
      // Start listening to the ayah that just finished playing
      startListening(currentSurah.ayahs[currentIndex], currentSurah, true);
      return;
    }

    if (currentIndex !== -1 && currentIndex < currentSurah.ayahs.length - 1) {
      if (!isAutoPlaying && !isTeacherModeRef.current) {
        setPlayingAyahId(null);
        return;
      }
      const nextAyah = currentSurah.ayahs[currentIndex + 1];
      handleAyahClick(nextAyah, currentSurah);
    } else if (currentSurah.number < 114) {
      if (!isAutoPlaying && !isTeacherModeRef.current) {
        setPlayingAyahId(null);
        return;
      }
      // Transition to next Surah
      const nextSurahInActive = activeSurahs.find(s => s.number === currentSurah!.number + 1);
      if (nextSurahInActive) {
        handleAyahClick(nextSurahInActive.ayahs[0], nextSurahInActive);
      } else {
        handleSurahClick(currentSurah.number + 1, isAutoPlaying);
      }
    } else {
      setPlayingAyahId(null);
      setIsAutoPlaying(false);
    }
  };

  const toggleAutoPlay = (surah: SurahDetail) => {
    if (isAutoPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsAutoPlaying(false);
      setPlayingAyahId(null);
    } else {
      // Stop listening if active
      if (isListening) stopListening();
      if (isTeacherMode) {
        setIsTeacherMode(false);
        isTeacherModeRef.current = false;
      }
      
      setIsAutoPlaying(true);
      handleAyahClick(surah.ayahs[0], surah);
    }
  };

  const toggleTeacherMode = (surah: SurahDetail, ayah?: Ayah) => {
    if (isTeacherMode) {
      setIsTeacherMode(false);
      isTeacherModeRef.current = false;
      if (audioRef.current) audioRef.current.pause();
      setPlayingAyahId(null);
      stopListening();
    } else {
      setIsTeacherMode(true);
      isTeacherModeRef.current = true;
      setIsAutoPlaying(false);
      stopListening();
      
      if (ayah) {
        handleAyahClick(ayah, surah);
      } else {
        // Start by playing the first unmemorized ayah, or the first ayah
        const firstUnmemorized = surah.ayahs.find(a => !memorizedAyahs.includes(a.number));
        handleAyahClick(firstUnmemorized || surah.ayahs[0], surah);
      }
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, ayahNumber: number) => {
    e.stopPropagation();
    if (readAyahs.has(ayahNumber)) return;
    
    setReadAyahs(prev => new Set(prev).add(ayahNumber));
    await incrementAyahCount();
  };

  const handleToggleMemorize = async (e: React.MouseEvent, ayahNumber: number, surahNumber: number) => {
    e.stopPropagation();
    
    const isMemorized = memorizedAyahs.includes(ayahNumber);
    if (isMemorized) {
      setMemorizedAyahs(prev => prev.filter(id => id !== ayahNumber));
    } else {
      setMemorizedAyahs(prev => [...prev, ayahNumber]);
    }
    
    await toggleMemorizedAyah(surahNumber, ayahNumber);
  };

  const normalizeArabic = (text: string) => {
    return text
      .replace(/[\u064B-\u065F\u0670-\u0673\u06D6-\u06ED]/g, '') // Remove all diacritics and Quranic marks
      .replace(/\u0622|\u0623|\u0625|\u0671/g, '\u0627') // Normalize Alef and Alef Wasla
      .replace(/\u0629/g, '\u0647') // Normalize Teh Marbuta
      .replace(/\u0649/g, '\u064A') // Normalize Alef Maksura
      .replace(/\u0624/g, '\u0648') // Normalize Waw with Hamza
      .replace(/\u0626/g, '\u064A') // Normalize Yeh with Hamza
      .replace(/[^\u0600-\u06FF\s]/g, '') // Remove non-Arabic characters (punctuation)
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };

  const mergeTranscripts = (accumulated: string, current: string): string => {
    if (!accumulated) return current;
    if (!current) return accumulated;
    
    const accStr = accumulated.trim();
    const currStr = current.trim();
    
    if (currStr.startsWith(accStr)) {
      return currStr;
    }
    
    if (accStr.startsWith(currStr)) {
      return accStr;
    }
    
    const accWords = accStr.split(' ').filter(w => w.length > 0);
    const currWords = currStr.split(' ').filter(w => w.length > 0);
    
    let overlapCount = 0;
    for (let i = 1; i <= Math.min(accWords.length, currWords.length); i++) {
      const accSuffix = accWords.slice(-i).join(' ');
      const currPrefix = currWords.slice(0, i).join(' ');
      if (accSuffix === currPrefix) {
        overlapCount = i;
      }
    }
    
    if (overlapCount > 0) {
      const uniqueCurrWords = currWords.slice(overlapCount);
      return [...accWords, ...uniqueCurrWords].join(' ');
    }
    
    return accStr + ' ' + currStr;
  };

  const startListening = (ayah: Ayah, surah: SurahDetail, fromTeacherMode: boolean = false) => {
    setSelectedAyah({ ayah, surah });
    setMicError(null);
    setRecognizedText('');
    
    // We need a ref to accumulate transcript across automatic restarts
    const accumulatedTranscriptRef = { current: '' };
    const latestTranscriptRef = { current: '' };
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMicError("متصفحك لا يدعم خاصية التعرف على الصوت. يرجى استخدام متصفح حديث مثل Chrome.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping previous recognition", e);
      }
    }

    // Stop auto-play if active
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      setPlayingAyahId(null);
    }

    if (!fromTeacherMode && isTeacherModeRef.current) {
      setIsTeacherMode(false);
      isTeacherModeRef.current = false;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = async (event: any) => {
      let currentSessionTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const segment = event.results[i][0].transcript;
        currentSessionTranscript = mergeTranscripts(currentSessionTranscript, segment);
      }

      const transcript = mergeTranscripts(accumulatedTranscriptRef.current, currentSessionTranscript);
      latestTranscriptRef.current = transcript;
      setRecognizedText(transcript);
      const normalizedTranscript = normalizeArabic(transcript);
      const normalizedAyah = normalizeArabic(ayah.text);
      
      const ayahWords = normalizedAyah.split(' ').filter(w => w.length > 0);
      const transcriptWords = normalizedTranscript.split(' ').filter(w => w.length > 0);

      // Count matching words in order
      let matchCount = 0;
      let transcriptIndex = 0;
      for (const word of ayahWords) {
        // Look for the word in the transcript, allowing some flexibility
        let found = false;
        for (let i = transcriptIndex; i < transcriptWords.length; i++) {
          if (transcriptWords[i] === word || transcriptWords[i].includes(word) || word.includes(transcriptWords[i])) {
            matchCount++;
            transcriptIndex = i + 1;
            found = true;
            break;
          }
        }
      }

      // Calculate required matches based on length
      let requiredMatches = ayahWords.length;
      if (ayahWords.length > 5) requiredMatches = Math.floor(ayahWords.length * 0.7);
      else if (ayahWords.length > 2) requiredMatches = ayahWords.length - 1;
      
      // It's a match if required matches are met, or if the transcript directly includes the ayah
      const isMatch = matchCount >= requiredMatches || normalizedTranscript.includes(normalizedAyah);
      
      if (isMatch) {
        setVoiceMatch(true);
        shouldBeListeningRef.current = false;
        if (recognitionRef.current === recognition) {
          recognitionRef.current.stop();
          recognitionRef.current = null; // Prevent onend from clearing state
        }
        
        // Mark as memorized automatically
        if (!memorizedAyahs.includes(ayah.number)) {
          setMemorizedAyahs(prev => [...prev, ayah.number]);
          await toggleMemorizedAyah(surah.number, ayah.number);
        }

        // Automatically move to next ayah after a short delay
        setTimeout(() => {
          const currentIndex = surah.ayahs.findIndex(a => a.number === ayah.number);
          if (currentIndex !== -1 && currentIndex < surah.ayahs.length - 1) {
            const nextAyah = surah.ayahs[currentIndex + 1];
            if (fromTeacherMode) {
              handleAyahClick(nextAyah, surah);
            } else {
              startListening(nextAyah, surah);
            }
          } else if (surah.number < 114) {
            // Move to next surah
            const nextSurahInActive = activeSurahs.find(s => s.number === surah.number + 1);
            if (nextSurahInActive) {
              if (fromTeacherMode) {
                handleAyahClick(nextSurahInActive.ayahs[0], nextSurahInActive);
              } else {
                startListening(nextSurahInActive.ayahs[0], nextSurahInActive);
              }
            } else {
              handleSurahClick(surah.number + 1, fromTeacherMode, !fromTeacherMode);
            }
          }
        }, 1500);
      } else if (event.results.length > 0) {
        if (event.results[event.results.length - 1].isFinal) {
          // Only show "try again" if the latest segment is final and they've spoken enough words
          if (transcriptWords.length >= requiredMatches) {
            setVoiceMatch(false);
          } else {
            setVoiceMatch(null);
          }
        } else {
          // If they are still speaking, show "Listening..."
          setVoiceMatch(null);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') {
        // Ignore aborted error as it happens when we manually stop recognition
        return;
      }
      console.error("Speech recognition error:", event.error);
      
      const clearError = () => setTimeout(() => setMicError(null), 5000);

      if (event.error === 'not-allowed') {
        // In some browsers (like Chrome in an iframe), SpeechRecognition doesn't prompt for permission.
        // We can try to force the prompt using getUserMedia.
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getTracks().forEach(track => track.stop());
              setMicError("تم منح صلاحية الميكروفون بنجاح. يرجى النقر على زر الميكروفون مرة أخرى للبدء.");
              clearError();
            })
            .catch(err => {
              setMicError("تم حظر الوصول إلى الميكروفون. يرجى تفعيله من إعدادات المتصفح (أيقونة القفل) ثم تحديث الصفحة.");
              clearError();
            });
        } else {
          setMicError("تم حظر الوصول إلى الميكروفون. يرجى تفعيله من إعدادات المتصفح (أيقونة القفل) ثم تحديث الصفحة.");
          clearError();
        }
      } else if (event.error === 'no-speech') {
        setMicError("لم يتم اكتشاف صوت. يرجى التأكد من الميكروفون والمحاولة مرة أخرى.");
        clearError();
      } else if (event.error === 'network') {
        setMicError("خطأ في الاتصال بالشبكة. خاصية التعرف على الصوت تتطلب اتصالاً بالإنترنت.");
        clearError();
      } else {
        setMicError("حدث خطأ في التعرف على الصوت. يرجى المحاولة مرة أخرى.");
        clearError();
      }

      setIsListening(false);
      shouldBeListeningRef.current = false;
      setListeningAyahId(null);
      setVoiceMatch(null);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        if (shouldBeListeningRef.current) {
          // Restart recognition if it stopped naturally and we still want to listen
          accumulatedTranscriptRef.current = latestTranscriptRef.current;
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to restart recognition", e);
            setIsListening(false);
            shouldBeListeningRef.current = false;
            setListeningAyahId(null);
            setVoiceMatch(null);
            recognitionRef.current = null;
          }
        } else {
          // Clear listening state immediately when recognition ends intentionally
          setIsListening(false);
          shouldBeListeningRef.current = false;
          setListeningAyahId(null);
          setVoiceMatch(null);
          recognitionRef.current = null;
        }
      }
    };

    try {
      setIsListening(true);
      shouldBeListeningRef.current = true;
      setListeningAyahId(ayah.number);
      setVoiceMatch(null);
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition", e);
      setIsListening(false);
      shouldBeListeningRef.current = false;
      setListeningAyahId(null);
    }
  };

  const getThemeClasses = () => {
    switch (quranTheme) {
      case 'modern': return 'bg-stone-950 text-stone-100 font-serif'; // مصحف طبعة المدينة
      case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636] font-serif'; // المصحف التقليدي
      case 'uthmani': return 'bg-white text-stone-900 font-serif border-[12px] border-double border-stone-200 shadow-inner'; // مصحف طبعة الأزهر
      default: return 'bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100'; // نص قرآني
    }
  };

  const pages = React.useMemo(() => {
    const grouped = new Map<number, { ayahs: (Ayah & { surah: SurahDetail })[], surahs: Set<SurahDetail> }>();
    activeSurahs.forEach(surah => {
      surah.ayahs.forEach(ayah => {
        if (!grouped.has(ayah.page)) {
          grouped.set(ayah.page, { ayahs: [], surahs: new Set() });
        }
        grouped.get(ayah.page)!.ayahs.push({ ...ayah, surah });
        grouped.get(ayah.page)!.surahs.add(surah);
      });
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [activeSurahs]);

  if (loading && activeSurahs.length === 0 && surahs.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        onError={() => setPlayingAyahId(null)}
      />

      <AnimatePresence mode="wait">
        {activeSurahs.length === 0 ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                placeholder="ابحث عن سورة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-100 dark:bg-stone-900 border-none rounded-2xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-emerald-600 transition-all"
              />
            </div>

            <div className="grid gap-2">
              {filteredSurahs.map((surah) => (
                <button
                  key={surah.number}
                  onClick={() => handleSurahClick(surah.number)}
                  className="flex items-center justify-between p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 hover:border-emerald-600/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-sm font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      {surah.number}
                    </div>
                    <div className="text-right">
                      <h3 className="font-bold text-lg">{surah.name}</h3>
                      <p className="text-xs text-stone-500">{surah.englishName} • {surah.numberOfAyahs} آية</p>
                    </div>
                  </div>
                  <ChevronLeft className="text-stone-300 group-hover:text-emerald-600 transition-colors" size={20} />
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
              layout === 'horizontal' 
                ? "flex overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-8 gap-8" 
                : "space-y-12"
            )}
          >
            {pages.map(([pageNum, pageData], index) => (
              <div key={pageNum} className={cn(
                "relative",
                layout === 'horizontal' ? "min-w-full snap-center px-4" : ""
              )}>
                {index === 0 && (
                  <div className="flex justify-between items-center mb-4">
                    <button 
                      onClick={() => {
                        setActiveSurahs([]);
                        setSelectedAyah(null);
                        setPlayingAyahId(null);
                        setIsAutoPlaying(false);
                        stopListening();
                        if (audioRef.current) audioRef.current.pause();
                      }}
                      className="flex items-center gap-2 text-stone-500 hover:text-emerald-600 transition-colors"
                    >
                      <ChevronLeft className="rotate-180" size={20} />
                      <span>العودة للقائمة</span>
                    </button>
                    
                    {activeSurahs.length > 0 && activeSurahs[0].number > 1 && (
                      <button
                        onClick={loadPreviousSurah}
                        disabled={loadingPrevious}
                        className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-sm font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-2 relative z-40"
                      >
                        {loadingPrevious ? (
                          <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>السورة السابقة</span>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {Array.from(pageData.surahs).map(surah => {
                  const isStartOfSurah = pageData.ayahs.some(a => a.surah.number === surah.number && a.numberInSurah === 1);
                  if (isStartOfSurah) {
                    return (
                      <div key={`header-${surah.number}`} className="text-center space-y-4 mb-12">
                        <div className="relative border-y-2 border-double border-emerald-700 dark:border-emerald-500 py-6 my-8 bg-emerald-50/30 dark:bg-emerald-900/10">
                          <div className="absolute inset-0 border-y border-emerald-700/30 dark:border-emerald-500/30 m-1"></div>
                          
                          <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-400 text-sm font-serif px-6 mb-4">
                            <span>الجزء {toArabicDigits(surah.ayahs[0]?.juz || 1)}</span>
                            <span>{surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} - آياتها {toArabicDigits(surah.numberOfAyahs)}</span>
                            <span>الحزب {toArabicDigits(Math.ceil((surah.ayahs[0]?.hizbQuarter || 1) / 4))}</span>
                          </div>

                          <h2 className="text-5xl font-bold font-serif text-emerald-800 dark:text-emerald-400 quran-text py-4">
                            {surah.name}
                          </h2>
                        </div>
                        
                        <div className="max-w-xs mx-auto space-y-2">
                          <div className="flex justify-between text-xs text-stone-500 font-bold">
                            <span>تقدم الحفظ</span>
                            <span>{Math.round((memorizedAyahs.filter(id => surah.ayahs.some(a => a.number === id)).length / surah.numberOfAyahs) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(memorizedAyahs.filter(id => surah.ayahs.some(a => a.number === id)).length / surah.numberOfAyahs) * 100}%` }}
                              className="h-full bg-emerald-500"
                            />
                          </div>
                          <p className="text-[10px] text-stone-400">تم حفظ {memorizedAyahs.filter(id => surah.ayahs.some(a => a.number === id)).length} من أصل {surah.numberOfAyahs} آية</p>
                        </div>

                        {surah.number !== 1 && surah.number !== 9 && (
                          <div className="flex justify-center py-6">
                            <div className="text-3xl font-serif text-emerald-800 dark:text-emerald-400 quran-text">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}

                <div className={cn(
                  "p-8 rounded-3xl transition-colors relative", 
                  getThemeClasses(),
                  "text-center leading-[3.5]"
                )} dir="rtl">
                  {pageData.ayahs.map((ayah, index) => {
                    const isNewQuarter = index === 0 
                      ? ayah.numberInSurah === 1 && ayah.hizbQuarter % 4 !== 1 // If it's the first ayah and not the start of a Hizb, we might show it, but usually we just rely on the next check. Actually, let's just show it if it differs from previous.
                      : ayah.hizbQuarter !== pageData.ayahs[index - 1].hizbQuarter;

                    return (
                      <span key={ayah.number} className="inline">
                        {isNewQuarter && index > 0 && (
                          <span className="inline-flex items-center justify-center mx-2 text-emerald-700 dark:text-emerald-500 text-2xl" title={getQuarterMarker(ayah.hizbQuarter)}>
                            ۞
                          </span>
                        )}
                        <span 
                          className={cn(
                            "group cursor-pointer relative inline transition-all",
                            memorizedAyahs.includes(ayah.number) ? "text-emerald-700 dark:text-emerald-400" : (readAyahs.has(ayah.number) ? "text-emerald-600/70 dark:text-emerald-400/70" : ""),
                            playingAyahId === ayah.number && "text-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/50 rounded px-1",
                            selectedAyah?.ayah.number === ayah.number && "bg-stone-200/50 dark:bg-stone-700/50 rounded px-1",
                            hideAyahs && !memorizedAyahs.includes(ayah.number) && "blur-md select-none opacity-20 hover:blur-none hover:opacity-100"
                          )}
                          onClick={() => setSelectedAyah({ ayah, surah: ayah.surah })}
                        >
                          <span className="text-3xl md:text-4xl quran-text px-1">{formatAyahText(ayah.text, ayah.numberInSurah, ayah.surah.number)}</span>
                          
                          {ayah.sajda && (
                            <span className="inline-flex items-center justify-center mx-1 text-emerald-700 dark:text-emerald-500 text-2xl" title="سجدة تلاوة">
                              ۩
                            </span>
                          )}

                          <span className="mx-1 text-emerald-700 dark:text-emerald-500 quran-text text-3xl md:text-4xl">
                            {'\u06DD'}{toArabicDigits(ayah.numberInSurah)}
                          </span>

                          {playingAyahId === ayah.number && (
                            <motion.span 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-emerald-600"
                            >
                              <Volume2 size={16} className="animate-pulse" />
                            </motion.span>
                          )}
                          {listeningAyahId === ayah.number && (
                            <motion.span 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm font-bold px-4 py-2 rounded-xl z-20 whitespace-nowrap shadow-lg flex flex-col items-center gap-1",
                                voiceMatch === true ? "bg-emerald-100 text-emerald-700" : 
                                voiceMatch === false ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                              )}
                            >
                              <span>
                                {voiceMatch === true ? 'أحسنت! قراءة صحيحة' : 
                                 voiceMatch === false ? 'حاول مرة أخرى' : 'جاري الاستماع...'}
                              </span>
                              {recognizedText && (
                                <span className="text-xs font-normal opacity-80 max-w-[200px] truncate">
                                  {recognizedText}
                                </span>
                              )}
                            </motion.span>
                          )}
                        </span>
                      </span>
                    );
                  })}
                  
                  <div className="mt-12 text-center text-sm text-stone-400 font-sans">
                    {toArabicDigits(pageNum)}
                  </div>
                  
                  {index === pages.length - 1 && activeSurahs.length > 0 && activeSurahs[activeSurahs.length - 1].number < 114 && (
                    <div className="flex justify-center mt-12 pb-32">
                      <button
                        onClick={loadNextSurah}
                        disabled={loadingMore}
                        className="px-6 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-2 relative z-40"
                      >
                        {loadingMore ? (
                          <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span>تحميل السورة التالية</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Floating Action Bar */}
            {activeSurahs.length > 0 && (
              <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50">
                <AnimatePresence>
                  {micError && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="bg-red-500 text-white text-xs md:text-sm px-6 py-2 rounded-full shadow-lg flex items-center gap-2 mb-2"
                    >
                      <MicOff size={16} />
                      <span>{micError}</span>
                      <button onClick={() => setMicError(null)} className="ml-2 hover:opacity-70">✕</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 border border-stone-200 dark:border-stone-800">
                  <button 
                    onClick={() => {
                    if (selectedAyah && playingAyahId !== selectedAyah.ayah.number) {
                      setIsAutoPlaying(true);
                      handleAyahClick(selectedAyah.ayah, selectedAyah.surah);
                    } else if (playingAyahId || isAutoPlaying) {
                      if (audioRef.current) audioRef.current.pause();
                      setPlayingAyahId(null);
                      setIsAutoPlaying(false);
                    } else if (selectedAyah) {
                      setIsAutoPlaying(true);
                      handleAyahClick(selectedAyah.ayah, selectedAyah.surah);
                    } else if (activeSurahs.length > 0) {
                      toggleAutoPlay(activeSurahs[0]);
                    }
                  }}
                  title={playingAyahId || isAutoPlaying ? 'إيقاف التلاوة' : 'تشغيل التلاوة'}
                  className="flex items-center justify-center w-12 h-12 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  {playingAyahId || isAutoPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>

                <button 
                  onClick={() => {
                    if (selectedAyah && listeningAyahId !== selectedAyah.ayah.number) {
                      startListening(selectedAyah.ayah, selectedAyah.surah);
                    } else if (isListening) {
                      stopListening();
                    } else if (selectedAyah) {
                      startListening(selectedAyah.ayah, selectedAyah.surah);
                    } else if (activeSurahs.length > 0) {
                      const surah = activeSurahs[0];
                      const firstUnmemorized = surah.ayahs.find(a => !memorizedAyahs.includes(a.number));
                      startListening(firstUnmemorized || surah.ayahs[0], surah);
                    }
                  }}
                  title={isListening ? "إيقاف الاستماع" : "اختبر حفظك"}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all border",
                    isListening ? "bg-blue-600 text-white border-blue-600" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700"
                  )}
                >
                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button 
                  onClick={(e) => {
                    if (selectedAyah) {
                      handleToggleMemorize(e, selectedAyah.ayah.number, selectedAyah.surah.number);
                    }
                  }}
                  title="حفظ"
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all border",
                    selectedAyah && memorizedAyahs.includes(selectedAyah.ayah.number)
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700",
                    !selectedAyah && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!selectedAyah}
                >
                  {selectedAyah && memorizedAyahs.includes(selectedAyah.ayah.number) ? <BookmarkCheck size={24} /> : <Bookmark size={24} />}
                </button>

                <button 
                  onClick={() => {
                    if (selectedAyah) {
                      toggleTeacherMode(selectedAyah.surah, selectedAyah.ayah);
                    } else if (activeSurahs.length > 0) {
                      toggleTeacherMode(activeSurahs[0]);
                    }
                  }}
                  title={isTeacherMode ? 'إيقاف المصحف المعلم' : 'المصحف المعلم'}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all border",
                    isTeacherMode ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700"
                  )}
                >
                  <GraduationCap size={24} />
                </button>

                <button 
                  onClick={() => setHideAyahs(!hideAyahs)}
                  title={hideAyahs ? 'إظهار الآيات' : 'إخفاء الآيات'}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all border",
                    hideAyahs ? "bg-stone-900 text-white border-stone-900" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700"
                  )}
                >
                  {hideAyahs ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


