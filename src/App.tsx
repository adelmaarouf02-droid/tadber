/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Quran } from './components/Quran';
import { Audio } from './components/Audio';
import { Community } from './components/Community';
import { Profile } from './components/Profile';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LogIn, RefreshCw } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { user, loading, signIn, isSigningIn } = useFirebase();

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 gap-4">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
        <p className="text-stone-500 font-medium">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 p-6 text-center space-y-8" dir="rtl">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-emerald-900/20">
            ت
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">مرحباً بك في تدبر</h1>
            <p className="text-stone-500 max-w-xs mx-auto">سجل دخولك لتبدأ رحلتك في تدبر القرآن الكريم ومتابعة تقدمك.</p>
          </div>
          <button 
            onClick={signIn}
            disabled={isSigningIn}
            className="flex items-center gap-3 px-8 py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <LogIn size={20} />
            )}
            {isSigningIn ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول باستخدام جوجل'}
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'quran':
        return <Quran />;
      case 'audio':
        return <Audio />;
      case 'community':
        return <Community />;
      case 'profile':
        return <Profile />;
      default:
        return <Home />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
    >
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}


