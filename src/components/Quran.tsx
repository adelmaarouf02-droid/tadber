import React, { useEffect, useState, useRef } from 'react';
import { Search, ChevronLeft, BookOpen, CheckCircle2, Volume2, VolumeX, Play, Pause, Bookmark, BookmarkCheck, Mic, MicOff, Eye, EyeOff, Settings as SettingsIcon, GraduationCap, WrapText, Loader2, AlertCircle, Plus, X, GripHorizontal } from 'lucide-react';
import { quranApi } from '../services/quranApi';
import { Surah, SurahDetail, Ayah } from '../types/quran';
import { recitationService } from '../services/recitationService';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../context/FirebaseContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SearchResultAyah {
  number: number;
  text: string;
  surah: {
    number: number;
    name: string;
  };
  numberInSurah: number;
}

export const Quran: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [ayahResults, setAyahResults] = useState<SearchResultAyah[]>([]);
  const [isSearchingDeep, setIsSearchingDeep] = useState(false);
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
  const [reciter, setReciter] = useState('ar.husary');
  const [showReciters, setShowReciters] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Suppress ResizeObserver loop limit exceeded error
  useEffect(() => {
    const errorHandler = (e: ErrorEvent) => {
      if (e.message.includes('ResizeObserver loop')) {
        const resizeObserverErrGuid = '84460ccc-a170-43ad-85f5-afc72e08e71c';
        if (e.stopImmediatePropagation) {
          e.stopImmediatePropagation();
        } else {
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  // Auto-scroll to active ayah
  useEffect(() => {
    if (playingAyahId) {
      const element = document.getElementById(`ayah-${playingAyahId}`);
      if (element) {
        // Use a slight delay to ensure rendering is complete
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [playingAyahId]);

  const reciters = [
    { id: 'ar.husary', name: 'الحصري (مرتل)', description: 'واضح جداً للتعلم' },
    { id: 'ar.husarymujawwad', name: 'الحصري (مجود)', description: 'تلاوة مجودة بطيئة' },
    { id: 'ar.alafasy', name: 'مشاري العفاسي', description: 'صوت عذب وحديث' },
    { id: 'ar.minshawi', name: 'المنشاوي (مرتل)', description: 'تلاوة خاشعة' },
    { id: 'ar.abdulsamad', name: 'عبد الباسط (مرتل)', description: 'صوت قوي ومميز' },
  ];
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const isTeacherModeRef = useRef(false);
  const layout = userData?.quranLayout || 'vertical';
  
  // New States
  const [hideAyahs, setHideAyahs] = useState(false);
  const [splitLongAyahs, setSplitLongAyahs] = useState(false);
  const [expandedAyahs, setExpandedAyahs] = useState<Set<number>>(new Set());
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [listeningAyahId, setListeningAyahId] = useState<number | null>(null);
  const [voiceMatch, setVoiceMatch] = useState<boolean | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldBeListeningRef = useRef<boolean>(false);
  const [selectedAyah, setSelectedAyah] = useState<{ayah: Ayah, surah: SurahDetail} | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);
  const indicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (selectedAyah) {
      setShowIndicator(true);
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
      indicatorTimeoutRef.current = setTimeout(() => {
        setShowIndicator(false);
      }, 30000); // 30 seconds
    }
    return () => {
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    };
  }, [selectedAyah]);

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

  const splitAyahText = (text: string): string[] => {
    if (!splitLongAyahs) return [text];
    
    // Split by Waqf marks: ۖ ۗ ۘ ۙ ۚ ۛ
    const parts = text.split(/([\u06D6-\u06DB])/g);
    const segments: string[] = [];
    let currentSegment = "";
    
    for (let i = 0; i < parts.length; i++) {
      currentSegment += parts[i];
      if (parts[i].match(/[\u06D6-\u06DB]/)) {
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
        }
        currentSegment = "";
      }
    }
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    // If no Waqf marks were found and the ayah is very long, split by words
    if (segments.length === 1) {
      const words = text.split(' ');
      if (words.length > 15) {
        const newSegments = [];
        for (let i = 0; i < words.length; i += 12) {
          newSegments.push(words.slice(i, i + 12).join(' '));
        }
        return newSegments;
      }
    }

    return segments;
  };

  const toggleAyahExpansion = (ayahNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedAyahs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ayahNumber)) {
        newSet.delete(ayahNumber);
      } else {
        newSet.add(ayahNumber);
      }
      return newSet;
    });
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
    console.log("Search query changed:", searchQuery);
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setFilteredSurahs(surahs);
        setAyahResults([]);
        return;
      }

      // 1. Local Surah Filter
      const filtered = surahs.filter(s => 
        s.name.includes(searchQuery) || 
        s.englishName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSurahs(filtered);

      // 2. API Word Search
      if (searchQuery.length > 2) {
        setIsSearchingDeep(true);
        try {
          const apiResults = await quranApi.search(searchQuery);
          if (apiResults && apiResults.matches) {
            // Fetch actual Ayah text for each result to ensure it's the Ayah itself
            const withText = await Promise.all(apiResults.matches.slice(0, 10).map(async (match: any) => {
              try {
                const ayah = await quranApi.getAyah(match.number);
                return {
                  ...match,
                  text: ayah.text
                };
              } catch (e) {
                return match;
              }
            }));
            setAyahResults(withText);
          } else {
            setAyahResults([]);
          }
        } catch (error) {
          console.error("Search failed", error);
        } finally {
          setIsSearchingDeep(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, surahs]);

  const handleAyahResultClick = async (surahNumber: number, globalAyahNumber: number) => {
    await handleSurahClick(surahNumber);
    // After surah is loaded, scroll to ayah
    setTimeout(() => {
      const element = document.getElementById(`ayah-${globalAyahNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight it briefly
        element.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2');
        }, 3000);
      }
    }, 1000);
  };

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          if (selectedAyah) {
            setIsAnalyzing(true);
            setAnalysisResult(null);
            try {
              const result = await recitationService.compareRecitation(
                base64Audio,
                selectedAyah.ayah.text,
                selectedAyah.ayah.numberInSurah,
                selectedAyah.surah.name
              );
              setAnalysisResult(result);
            } catch (err) {
              console.error("Analysis failed:", err);
              setMicError("فشل تحليل التلاوة. يرجى المحاولة مرة أخرى.");
            } finally {
              setIsAnalyzing(false);
            }
          }
        };
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAnalysisResult(null);
    } catch (err) {
      console.error("Microphone access failed:", err);
      setMicError("لا يمكن الوصول إلى الميكروفون. يرجى التأكد من إعطاء الصلاحية.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

  const selectedAyahTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAyahClick = async (ayah: Ayah, surah: SurahDetail) => {
    // Clear existing timer if any
    if (selectedAyahTimerRef.current) {
      clearTimeout(selectedAyahTimerRef.current);
    }

    setSelectedAyah({ ayah, surah });

    // Set timer to clear selectedAyah after 30 seconds
    selectedAyahTimerRef.current = setTimeout(() => {
      setSelectedAyah(null);
      selectedAyahTimerRef.current = null;
    }, 30000);

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
        audioRef.current.src = `https://cdn.islamic.network/quran/audio/128/${reciter}/${ayah.number}.mp3`;
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
      .replace(/[أإآاىءؤئ]/g, 'ا') // Phonetic: All Alefs, Hamzas, and Alef Maksura to basic Alef
      .replace(/[ةه]/g, 'ه') // Phonetic: Teh Marbuta and Heh
      .replace(/[ثسص]/g, 'س') // Phonetic: Sibilants (Thaa, Seen, Saad)
      .replace(/[ذزظ]/g, 'ز') // Phonetic: Z-like sounds (Thal, Zain, Zah)
      .replace(/[ضد]/g, 'د') // Phonetic: D-like sounds (Daad, Daal)
      .replace(/[تط]/g, 'ت') // Phonetic: T-like sounds (Teh, Tah)
      .replace(/[قكغ]/g, 'ك') // Phonetic: K/Q/Gh sounds (Qaaf, Kaaf, Ghain)
      .replace(/[^\u0600-\u06FF\s]/g, '') // Remove non-Arabic characters (punctuation)
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };

  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
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
        console.warn("Warning stopping previous recognition", e);
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
      let maxConsecutiveMatches = 0;
      let currentConsecutiveMatches = 0;

      for (const word of ayahWords) {
        // Look for the word in the transcript, allowing some flexibility
        let found = false;
        for (let i = transcriptIndex; i < transcriptWords.length; i++) {
          const tWord = transcriptWords[i];
          const distance = levenshteinDistance(tWord, word);
          const maxDistance = Math.max(1, Math.floor(word.length * 0.3)); // Allow 30% error (e.g., 1 char for 3-5 char words, 2 for 6+)
          
          if (tWord === word || tWord.includes(word) || word.includes(tWord) || distance <= maxDistance) {
            matchCount++;
            currentConsecutiveMatches++;
            if (currentConsecutiveMatches > maxConsecutiveMatches) {
              maxConsecutiveMatches = currentConsecutiveMatches;
            }
            transcriptIndex = i + 1;
            found = true;
            break;
          }
        }
        if (!found) {
          currentConsecutiveMatches = 0;
        }
      }

      // Calculate required matches based on length - Make it VERY forgiving
      // Browser speech recognition is bad at Quran, so we just want to know they are reading the right ayah
      let requiredMatches = ayahWords.length;
      if (ayahWords.length > 10) requiredMatches = Math.floor(ayahWords.length * 0.4); // 40% for long ayahs
      else if (ayahWords.length > 5) requiredMatches = Math.floor(ayahWords.length * 0.5); // 50% for medium ayahs
      else if (ayahWords.length > 2) requiredMatches = ayahWords.length - 1; // Allow 1 mistake for short ayahs
      
      // It's a match if:
      // 1. Required total matches are met OR
      // 2. The transcript directly includes the ayah OR
      // 3. They got at least 3 consecutive words right (or 2 for very short ayahs)
      const isMatch = 
        matchCount >= requiredMatches || 
        normalizedTranscript.includes(normalizedAyah) ||
        (ayahWords.length > 15 && maxConsecutiveMatches >= Math.floor(ayahWords.length * 0.3)) || // For very long ayahs, require 30% consecutive matches
        (ayahWords.length >= 6 && ayahWords.length <= 15 && maxConsecutiveMatches >= 4) || // For medium ayahs, require 4 consecutive
        (ayahWords.length >= 4 && ayahWords.length < 6 && maxConsecutiveMatches >= 3) || // For short ayahs, require 3 consecutive
        (ayahWords.length < 4 && maxConsecutiveMatches >= 2);
      
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
            
            if (fromTeacherMode) {
              shouldBeListeningRef.current = false;
              if (recognitionRef.current === recognition) {
                recognitionRef.current.stop();
                recognitionRef.current = null; // Prevent onend from clearing state
              }
              setTimeout(() => {
                handleAyahClick(ayah, surah);
              }, 1000); // Wait 1 second before replaying the audio
            }
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
      
      const clearError = () => setTimeout(() => setMicError(null), 5000);

      if (event.error === 'not-allowed') {
        console.warn("Speech recognition not allowed. Requesting permission...");
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
            console.warn("Failed to restart recognition", e);
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
      console.warn("Failed to start recognition", e);
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
    <div className="space-y-6" ref={constraintsRef}>
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
                className="w-full bg-stone-100 dark:bg-stone-900 border-none rounded-2xl py-3 pr-12 pl-10 focus:ring-2 focus:ring-emerald-600 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {/* Search Status Indicator */}
            {searchQuery.length > 2 && (
              <div className="text-xs text-stone-500 mt-2 px-2">
                {isSearchingDeep ? "جاري البحث..." : (ayahResults.length > 0 ? `تم العثور على ${ayahResults.length} آية` : "لا توجد نتائج مطابقة")}
              </div>
            )}

            <div className="grid gap-2">
              {filteredSurahs.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs font-bold text-stone-400 px-2 mb-2">السور</h4>
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
                </div>
              )}

              {isSearchingDeep && (
                <div className="flex items-center justify-center py-8 gap-3 text-stone-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-medium">جاري البحث العميق...</span>
                </div>
              )}

              {ayahResults.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs font-bold text-stone-400 px-2 mb-2">آيات مطابقة</h4>
                  <div className="grid gap-2">
                    {ayahResults.map((result, idx) => (
                      <button
                        key={`${result.number}-${idx}`}
                        onClick={() => handleAyahResultClick(result.surah.number, result.number)}
                        className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 hover:border-emerald-600/30 text-right transition-all"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                            {result.surah.name} • آية {toArabicDigits(result.numberInSurah)}
                          </span>
                        </div>
                        <p className="text-sm font-serif leading-relaxed line-clamp-2">{result.text}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && !filteredSurahs.length && !ayahResults.length && !isSearchingDeep && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-stone-100 dark:bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-stone-300" />
                  </div>
                  <p className="text-stone-500 font-medium">لم يتم العثور على نتائج لـ "{searchQuery}"</p>
                  <p className="text-xs text-stone-400 mt-2">جرب البحث بكلمة أخرى</p>
                </div>
              )}
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
                ? "flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar pb-8 gap-8" 
                : "h-[85vh] overflow-y-auto snap-y snap-mandatory scroll-smooth hide-scrollbar space-y-12"
            )}
          >
            {pages.map(([pageNum, pageData], index) => (
              <div key={pageNum} className={cn(
                "relative",
                layout === 'horizontal' ? "min-w-full snap-center snap-always px-4" : "min-h-full snap-start snap-always py-8"
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
                  "text-center leading-[2.5] md:leading-[3]"
                )} dir="rtl">
                  {pageData.ayahs.map((ayah, index) => {
                    const isNewQuarter = index === 0 
                      ? ayah.numberInSurah === 1 && ayah.hizbQuarter % 4 !== 1 // If it's the first ayah and not the start of a Hizb, we might show it, but usually we just rely on the next check. Actually, let's just show it if it differs from previous.
                      : ayah.hizbQuarter !== pageData.ayahs[index - 1].hizbQuarter;

                    const formattedText = formatAyahText(ayah.text, ayah.numberInSurah, ayah.surah.number);
                    const words = formattedText.split(' ');
                    const isLongAyah = words.length > 40;
                    const isExpanded = expandedAyahs.has(ayah.number) || playingAyahId === ayah.number;
                    
                    const displayText = isLongAyah && !isExpanded && !splitLongAyahs
                      ? words.slice(0, 30).join(' ') + ' ...'
                      : formattedText;

                    return (
                      <span key={ayah.number} className="inline">
                        {isNewQuarter && index > 0 && (
                          <span className="inline-flex items-center justify-center mx-2 text-emerald-700 dark:text-emerald-500 text-2xl" title={getQuarterMarker(ayah.hizbQuarter)}>
                            ۞
                          </span>
                        )}
                        <span 
                          id={`ayah-${ayah.number}`}
                          className={cn(
                            "group cursor-pointer relative inline transition-all",
                            memorizedAyahs.includes(ayah.number) ? "text-emerald-700 dark:text-emerald-400" : (readAyahs.has(ayah.number) ? "text-emerald-600/70 dark:text-emerald-400/70" : ""),
                            playingAyahId === ayah.number && "text-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/50 rounded px-1",
                            selectedAyah?.ayah.number === ayah.number && "bg-stone-200/50 dark:bg-stone-700/50 rounded px-1",
                            hideAyahs && !memorizedAyahs.includes(ayah.number) && "blur-md select-none opacity-20 hover:blur-none hover:opacity-100",
                            splitLongAyahs && "block mb-6"
                          )}
                          onClick={() => setSelectedAyah({ ayah, surah: ayah.surah })}
                        >
                          {splitAyahText(displayText).map((segment, i, arr) => (
                            <span key={i} className={cn("text-3xl md:text-4xl quran-text px-1", splitLongAyahs && i < arr.length - 1 && "block mb-4")}>
                              {segment}
                            </span>
                          ))}
                          
                          {isLongAyah && !splitLongAyahs && playingAyahId !== ayah.number && (
                            <button 
                              onClick={(e) => toggleAyahExpansion(ayah.number, e)}
                              className="text-sm md:text-base text-emerald-600 dark:text-emerald-400 mx-2 hover:underline font-sans font-medium bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full inline-flex items-center"
                            >
                              {isExpanded ? 'إخفاء' : 'قراءة المزيد'}
                            </button>
                          )}

                          {ayah.sajda && (
                            <span className="inline-flex items-center justify-center mx-1 text-emerald-700 dark:text-emerald-500 text-2xl" title="سجدة تلاوة">
                              ۩
                            </span>
                          )}

                          <span className={cn("mx-1 text-emerald-700 dark:text-emerald-500 quran-text text-3xl md:text-4xl", splitLongAyahs && "inline-block mt-2")}>
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
                  {showReciters && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.95 }}
                      className="bg-white dark:bg-stone-800 p-4 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-700 mb-4 w-64"
                    >
                      <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-3 text-center">اختر القارئ</h4>
                      <div className="space-y-2">
                        {reciters.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setReciter(r.id);
                              setShowReciters(false);
                              if (audioRef.current) audioRef.current.pause();
                              setPlayingAyahId(null);
                            }}
                            className={cn(
                              "w-full text-right px-4 py-2 rounded-xl text-sm transition-colors flex flex-col",
                              reciter === r.id 
                                ? "bg-emerald-600 text-white" 
                                : "hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300"
                            )}
                          >
                            <span className="font-bold">{r.name}</span>
                            <span className={cn("text-[10px]", reciter === r.id ? "text-emerald-100" : "text-stone-400")}>
                              {r.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {analysisResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="bg-white dark:bg-stone-800 p-6 rounded-3xl shadow-2xl border border-emerald-100 dark:border-emerald-900/30 mb-4 max-w-md w-full"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-800 dark:text-stone-100">تقييم التلاوة</h4>
                            <p className="text-xs text-stone-500">بواسطة الذكاء الاصطناعي</p>
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-xl">
                          {analysisResult.score}%
                        </div>
                      </div>
                      
                      <p className="text-stone-700 dark:text-stone-300 text-sm mb-4 leading-relaxed">
                        {analysisResult.feedback}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-2xl">
                          <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                            <CheckCircle2 size={12} /> نقاط القوة
                          </h5>
                          <ul className="text-[10px] space-y-1 text-stone-600 dark:text-stone-400">
                            {analysisResult.strengths?.map((s: string, i: number) => (
                              <li key={i}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-2xl">
                          <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                            <AlertCircle size={12} /> نقاط التحسين
                          </h5>
                          <ul className="text-[10px] space-y-1 text-stone-600 dark:text-stone-400">
                            {analysisResult.improvements?.map((s: string, i: number) => (
                              <li key={i}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setAnalysisResult(null)}
                        className="w-full mt-4 py-2 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                      >
                        إغلاق
                      </button>
                    </motion.div>
                  )}

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

                <AnimatePresence>
                  {!showReciters && (
                    <motion.div 
                      drag
                      dragConstraints={constraintsRef}
                      dragMomentum={false}
                      dragElastic={0.1}
                      whileDrag={{ scale: 1.05, zIndex: 1000 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="fixed bottom-6 left-6 md:bottom-10 md:left-10 z-[100] flex flex-col items-start gap-4 touch-none"
                    >
                      {/* Selected Context Indicator (Floating above menu) */}
                      <AnimatePresence mode="wait">
                        {(showIndicator || playingAyahId) && !isMenuOpen && (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 text-[10px] md:text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-2 shadow-xl mb-2 min-w-[150px] pointer-events-auto cursor-default"
                          >
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (playingAyahId) {
                                  if (audioRef.current) audioRef.current.pause();
                                  setPlayingAyahId(null);
                                  setIsAutoPlaying(false);
                                } else if (isListening) {
                                  stopListening();
                                } else if (isRecording) {
                                  stopRecording();
                                } else if (isTeacherMode) {
                                  setIsTeacherMode(false);
                                  isTeacherModeRef.current = false;
                                  if (audioRef.current) audioRef.current.pause();
                                  setPlayingAyahId(null);
                                } else if (selectedAyah) {
                                  handleAyahClick(selectedAyah.ayah, selectedAyah.surah);
                                }
                              }}
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 hover:scale-110 shadow-sm",
                                playingAyahId ? "bg-emerald-500 text-white animate-pulse" : 
                                isListening ? "bg-blue-500 text-white" :
                                isRecording ? "bg-red-500 text-white" :
                                isTeacherMode ? "bg-purple-500 text-white" :
                                "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                              )}
                            >
                              {playingAyahId ? <Pause size={18} /> : 
                               isListening ? <MicOff size={18} /> :
                               isRecording ? <MicOff size={18} /> :
                               isTeacherMode ? <GraduationCap size={18} /> :
                               <Play size={18} className="mr-0.5" />}
                            </button>
                            <div className="flex flex-col items-start">
                              <span className="text-[10px] opacity-60">
                                {playingAyahId ? 'تلاوة الآن' : 
                                 isListening ? 'اختبار الآن' :
                                 isRecording ? 'تقييم الآن' :
                                 isTeacherMode ? 'وضع المعلم' :
                                 'الآية المختارة'}
                              </span>
                              <span>
                                {playingAyahId ? (
                                  // Find the playing ayah info
                                  (() => {
                                    let playingSurahName = '';
                                    let playingAyahNum = 0;
                                    
                                    for (const s of activeSurahs) {
                                      const a = s.ayahs.find(ayah => ayah.number === playingAyahId);
                                      if (a) {
                                        playingSurahName = s.name;
                                        playingAyahNum = a.numberInSurah;
                                        break;
                                      }
                                    }
                                    return playingSurahName ? `سورة ${playingSurahName} • آية ${toArabicDigits(playingAyahNum)}` : '...'
                                  })()
                                ) : (
                                  selectedAyah ? `سورة ${selectedAyah.surah.name} • آية ${toArabicDigits(selectedAyah.ayah.numberInSurah)}` : '...'
                                )}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Vertical Menu Container */}
                      <div className="relative group">
                        {/* Drag Handle Indicator (Visible on hover) */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
                          <GripHorizontal size={16} className="text-stone-400" />
                        </div>

                        <AnimatePresence>
                          {isMenuOpen && (
                            <>
                              {/* Backdrop to close menu */}
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMenuOpen(false)}
                                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1]"
                              />
                              
                              {/* Menu Items - Stacked Vertically */}
                              {[
                                { 
                                  icon: playingAyahId || isAutoPlaying ? <Pause size={24} /> : <Play size={24} />, 
                                  title: 'تلاوة', 
                                  color: 'bg-emerald-600',
                                  onClick: () => {
                                    setIsMenuOpen(false);
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
                                  }
                                },
                                { 
                                  icon: isListening ? <MicOff size={22} /> : <Mic size={22} />, 
                                  title: 'اختبار', 
                                  color: isListening ? 'bg-blue-600' : 'bg-stone-800',
                                  onClick: () => {
                                    setIsMenuOpen(false);
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
                                  }
                                },
                                { 
                                  icon: isAnalyzing ? <Loader2 size={22} className="animate-spin" /> : isRecording ? <MicOff size={22} /> : <Sparkles size={22} />, 
                                  title: 'تقييم', 
                                  color: isRecording ? 'bg-red-600' : 'bg-stone-800',
                                  onClick: () => {
                                    setIsMenuOpen(false);
                                    isRecording ? stopRecording() : startRecording();
                                  }
                                },
                                { 
                                  icon: selectedAyah && memorizedAyahs.includes(selectedAyah.ayah.number) ? <BookmarkCheck size={20} /> : <Bookmark size={20} />, 
                                  title: 'حفظ', 
                                  color: selectedAyah && memorizedAyahs.includes(selectedAyah.ayah.number) ? 'bg-emerald-600' : 'bg-stone-800',
                                  onClick: (e: any) => {
                                    setIsMenuOpen(false);
                                    selectedAyah && handleToggleMemorize(e, selectedAyah.ayah.number, selectedAyah.surah.number);
                                  }
                                },
                                { 
                                  icon: <GraduationCap size={20} />, 
                                  title: 'معلم', 
                                  color: isTeacherMode ? 'bg-purple-600' : 'bg-stone-800',
                                  onClick: () => {
                                    setIsMenuOpen(false);
                                    if (selectedAyah) {
                                      toggleTeacherMode(selectedAyah.surah, selectedAyah.ayah);
                                    } else if (activeSurahs.length > 0) {
                                      toggleTeacherMode(activeSurahs[0]);
                                    }
                                  }
                                },
                                { 
                                  icon: <SettingsIcon size={20} />, 
                                  title: 'قارئ', 
                                  color: showReciters ? 'bg-amber-600' : 'bg-stone-800',
                                  onClick: () => {
                                    setIsMenuOpen(false);
                                    setShowReciters(!showReciters);
                                  }
                                },
                                { 
                                  icon: hideAyahs ? <EyeOff size={20} /> : <Eye size={20} />, 
                                  title: 'إخفاء', 
                                  color: hideAyahs ? 'bg-indigo-600' : 'bg-stone-800',
                                  onClick: () => setHideAyahs(!hideAyahs)
                                },
                                { 
                                  icon: <WrapText size={20} />, 
                                  title: 'تقسيم', 
                                  color: splitLongAyahs ? 'bg-teal-600' : 'bg-stone-800',
                                  onClick: () => setSplitLongAyahs(!splitLongAyahs)
                                }
                              ].map((item, index) => {
                                const yOffset = -(index + 1) * (typeof window !== 'undefined' && window.innerWidth < 768 ? 58 : 68);

                                return (
                                  <motion.button
                                    key={index}
                                    initial={{ opacity: 0, scale: 0, y: 0 }}
                                    animate={{ opacity: 1, scale: 1, y: yOffset }}
                                    exit={{ opacity: 0, scale: 0, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30, delay: index * 0.03 }}
                                    onClick={(e) => {
                                      item.onClick(e);
                                      setIsMenuOpen(false);
                                    }}
                                    className={cn(
                                      "absolute bottom-2 left-2 flex items-center gap-3 px-4 py-3 rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95 z-20 min-w-[120px]",
                                      item.color
                                    )}
                                  >
                                    <div className="shrink-0">{item.icon}</div>
                                    <span className="text-xs font-bold whitespace-nowrap">
                                      {item.title}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </>
                          )}
                        </AnimatePresence>

                        {/* Main FAB */}
                        <motion.button
                          layout
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className={cn(
                            "relative z-10 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full text-white shadow-[0_10px_40px_rgba(0,0,0,0.3)] transition-all active:scale-90",
                            isMenuOpen ? "bg-stone-800" : "bg-emerald-600"
                          )}
                        >
                          <AnimatePresence mode="wait">
                            {isMenuOpen ? (
                              <motion.div
                                key="close"
                                initial={{ opacity: 0, rotate: -90 }}
                                animate={{ opacity: 1, rotate: 0 }}
                                exit={{ opacity: 0, rotate: 90 }}
                              >
                                <X size={28} />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="play"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.5 }}
                                className="flex items-center justify-center"
                              >
                                <Play size={28} className="mr-1" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


