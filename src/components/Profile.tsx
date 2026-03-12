import React, { useState } from 'react';
import { User, Settings, LogOut, Target, Award, Calendar, ChevronLeft, Save, RefreshCw, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useFirebase } from '../context/FirebaseContext';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

export const Profile: React.FC = () => {
  const { user, userData, logout, updateUserData } = useFirebase();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState(userData?.dailyGoal || 10);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateGoal = async () => {
    setIsSaving(true);
    try {
      await updateUserData({ dailyGoal: Number(newGoal) });
      setIsEditingGoal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Profile Header */}
      <section className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-emerald-600/20">
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=059669&color=fff`} 
              alt={user?.displayName || ''} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2 rounded-xl shadow-lg">
            <Award size={16} />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{user?.displayName}</h2>
          <p className="text-stone-500 text-sm">{user?.email}</p>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <Target size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">الهدف اليومي</span>
          </div>
          <div className="flex items-center justify-between">
            {isEditingGoal ? (
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={newGoal}
                  onChange={(e) => setNewGoal(Number(e.target.value))}
                  className="w-16 bg-stone-100 dark:bg-stone-800 border-none rounded-lg py-1 px-2 text-lg font-bold"
                />
                <button 
                  onClick={handleUpdateGoal}
                  disabled={isSaving}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                </button>
              </div>
            ) : (
              <>
                <span className="text-2xl font-bold">{userData?.dailyGoal || 10}</span>
                <button 
                  onClick={() => setIsEditingGoal(true)}
                  className="text-stone-400 hover:text-emerald-600 transition-colors"
                >
                  <Settings size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-500">
            <Award size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">إجمالي الآيات</span>
          </div>
          <span className="text-2xl font-bold block">{userData?.totalCompletedAyahs || 0}</span>
        </div>
      </section>

      {/* Settings List */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-4">تخصيص المصحف</h3>
        <div className="grid grid-cols-2 gap-3 px-4">
          {[
            { id: 'classic', name: 'نص قرآني', class: 'bg-white border-stone-200' },
            { id: 'modern', name: 'مصحف طبعة المدينة', class: 'bg-stone-900 border-stone-800 text-white' },
            { id: 'uthmani', name: 'مصحف طبعة الأزهر', class: 'bg-white border-stone-200 font-serif border-4 border-double' },
            { id: 'sepia', name: 'المصحف التقليدي', class: 'bg-[#f4ecd8] border-[#eaddc0] text-[#5b4636]' },
          ].map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateUserData({ quranTheme: theme.id })}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center relative h-24 flex items-center justify-center",
                theme.class,
                userData?.quranTheme === theme.id || (!userData?.quranTheme && theme.id === 'classic')
                  ? "border-emerald-600 ring-2 ring-emerald-600/20"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <span className="font-bold text-sm leading-tight">{theme.name}</span>
              {(userData?.quranTheme === theme.id || (!userData?.quranTheme && theme.id === 'classic')) && (
                <div className="absolute top-2 right-2 text-emerald-600">
                  <Check size={14} />
                </div>
              )}
            </button>
          ))}
        </div>

        <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-4 mt-6">طريقة العرض</h3>
        <div className="grid grid-cols-2 gap-3 px-4">
          {[
            { id: 'vertical', name: 'عرض عمودي', desc: 'الآيات تحت بعضها' },
            { id: 'horizontal', name: 'عرض أفقي', desc: 'الآيات متراصة' },
          ].map((layout) => (
            <button
              key={layout.id}
              onClick={() => updateUserData({ quranLayout: layout.id })}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center relative h-24 flex flex-col items-center justify-center gap-1",
                userData?.quranLayout === layout.id || (!userData?.quranLayout && layout.id === 'vertical')
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400"
                  : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 opacity-70 hover:opacity-100"
              )}
            >
              <span className="font-bold text-sm leading-tight">{layout.name}</span>
              <span className="text-[10px] opacity-70">{layout.desc}</span>
              {(userData?.quranLayout === layout.id || (!userData?.quranLayout && layout.id === 'vertical')) && (
                <div className="absolute top-2 right-2 text-emerald-600">
                  <Check size={14} />
                </div>
              )}
            </button>
          ))}
        </div>

        <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-4 mt-6">الإعدادات العامة</h3>
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-500">
                <Calendar size={20} />
              </div>
              <span className="font-medium">تذكيرات القراءة</span>
            </div>
            <ChevronLeft size={20} className="text-stone-300" />
          </button>
          
          <button className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-500">
                <Settings size={20} />
              </div>
              <span className="font-medium">تفضيلات اللغة</span>
            </div>
            <ChevronLeft size={20} className="text-stone-300" />
          </button>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-red-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <LogOut size={20} />
              </div>
              <span className="font-bold">تسجيل الخروج</span>
            </div>
          </button>
        </div>
      </section>

      {/* App Info */}
      <div className="text-center space-y-1">
        <p className="text-xs text-stone-500">تدبر v1.0.0</p>
        <p className="text-[10px] text-stone-400">صنع بكل حب لخدمة كتاب الله</p>
      </div>
    </div>
  );
};
