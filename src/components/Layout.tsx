import React, { useState } from 'react';
import { Home, BookOpen, Music, Users, Search as SearchIcon, Moon, Sun, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search } from './Search';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  isDarkMode, 
  toggleDarkMode 
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const tabs = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'quran', label: 'القرآن', icon: BookOpen },
    { id: 'audio', label: 'الصوتيات', icon: Music },
    { id: 'community', label: 'المجتمع', icon: Users },
    { id: 'profile', label: 'حسابي', icon: User },
  ];

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 flex flex-col font-sans",
      isDarkMode ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
    )} dir="rtl">
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-50 px-4 py-3 flex items-center justify-between backdrop-blur-md border-b",
        isDarkMode ? "bg-stone-950/80 border-stone-800" : "bg-white/80 border-stone-200"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
            ت
          </div>
          <h1 className="text-xl font-bold tracking-tight">تدبر</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleDarkMode}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDarkMode ? "hover:bg-stone-800" : "hover:bg-stone-100"
            )}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsSearchOpen(true)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isDarkMode ? "hover:bg-stone-800" : "hover:bg-stone-100"
            )}
          >
            <SearchIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto p-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-stone-50 dark:bg-stone-950 p-4 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">البحث</h2>
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <Search />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 px-6 py-3 border-t backdrop-blur-lg flex justify-between items-center",
        isDarkMode ? "bg-stone-950/90 border-stone-800" : "bg-white/90 border-stone-200"
      )}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative",
                isActive ? "text-emerald-600" : "text-stone-500 hover:text-stone-400"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 w-1 h-1 bg-emerald-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

