import React, { useState } from 'react';
import { Search as SearchIcon, X, BookOpen } from 'lucide-react';
import { quranApi } from '../services/quranApi';
import { motion, AnimatePresence } from 'motion/react';

export const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await quranApi.search(query);
      setResults(data.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="relative">
        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
        <input
          type="text"
          placeholder="ابحث عن كلمة أو آية..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-stone-100 dark:bg-stone-900 border-none rounded-2xl py-4 pr-12 pl-4 focus:ring-2 focus:ring-emerald-600 transition-all text-lg"
        />
        {query && (
          <button 
            type="button"
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X size={18} />
          </button>
        )}
      </form>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {results.map((result, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-6 space-y-3"
              >
                <p className="text-xl leading-relaxed font-serif text-right text-stone-800 dark:text-stone-200">
                  {result.text}
                </p>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} />
                    <span>{result.surah.name} • الآية {result.numberInSurah}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {query && !loading && results.length === 0 && (
              <p className="text-center text-stone-500 py-10">لم يتم العثور على نتائج لـ "{query}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
