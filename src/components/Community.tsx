import React, { useEffect, useState } from 'react';
import { Users, Trophy, ArrowRight, MessageCircle, RefreshCw, Plus, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../context/FirebaseContext';

export const Community: React.FC = () => {
  const [khatmahs, setKhatmahs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKhatmahTitle, setNewKhatmahTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { user } = useFirebase();

  useEffect(() => {
    const q = query(collection(db, 'khatmahs'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setKhatmahs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'khatmahs');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateKhatmah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKhatmahTitle.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'khatmahs'), {
        title: newKhatmahTitle,
        creatorId: user.uid,
        participantsCount: 1,
        progress: 0,
        status: 'active',
        createdAt: serverTimestamp()
      });
      
      // Also add creator as participant
      await setDoc(doc(db, `khatmahs/${docRef.id}/participants`, user.uid), {
        khatmahId: docRef.id,
        userId: user.uid,
        progress: 0,
        joinedAt: serverTimestamp()
      });

      setNewKhatmahTitle('');
      setShowCreateModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'khatmahs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinKhatmah = async (khatmahId: string) => {
    if (!user || joiningId) return;

    setJoiningId(khatmahId);
    try {
      const participantRef = doc(db, `khatmahs/${khatmahId}/participants`, user.uid);
      const participantDoc = await getDoc(participantRef);

      if (participantDoc.exists()) {
        alert('أنت مشترك بالفعل في هذه الختمة');
        return;
      }

      await setDoc(participantRef, {
        khatmahId,
        userId: user.uid,
        progress: 0,
        joinedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'khatmahs', khatmahId), {
        participantsCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `khatmahs/${khatmahId}/participants`);
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold font-serif italic">المجتمع</h2>
          <p className="text-stone-500 text-sm">شارك الآخرين في ختم القرآن الكريم.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </header>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-950/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6"
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">إنشاء ختمة جديدة</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateKhatmah} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-500">اسم الختمة</label>
                  <input 
                    type="text" 
                    value={newKhatmahTitle}
                    onChange={(e) => setNewKhatmahTitle(e.target.value)}
                    placeholder="مثلاً: ختمة شهر رمضان"
                    className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-emerald-600 transition-all"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : 'إنشاء الختمة'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" />
          الختمات الجماعية
        </h3>

        {khatmahs.length === 0 ? (
          <div className="text-center py-12 bg-stone-100 dark:bg-stone-900 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700 space-y-4">
            <p className="text-stone-500">لا توجد ختمات نشطة حالياً.</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="text-emerald-600 font-bold text-sm underline underline-offset-4"
            >
              كن أول من ينشئ ختمة
            </button>
          </div>
        ) : (
          khatmahs.map((khatmah) => (
            <motion.div
              key={khatmah.id}
              whileHover={{ y: -2 }}
              className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-lg">{khatmah.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Users size={14} />
                    <span>{khatmah.participantsCount || 0} مشارك</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  khatmah.status === 'active' 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                  : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                }`}>
                  {khatmah.status === 'active' ? 'نشط' : 'مكتمل'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-stone-500">التقدم الإجمالي</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${khatmah.progress || 0}%` }}
                      className="h-full bg-gradient-to-l from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    />
                  </div>
                  <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{khatmah.progress || 0}%</span>
                </div>
              </div>

              <button 
                onClick={() => handleJoinKhatmah(khatmah.id)}
                disabled={joiningId === khatmah.id || khatmah.status !== 'active'}
                className="w-full py-3 bg-stone-950 dark:bg-stone-100 text-white dark:text-stone-950 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {joiningId === khatmah.id ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : khatmah.status === 'active' ? (
                  <>
                    انضم الآن
                    <ArrowRight size={16} className="rotate-180" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    عرض التفاصيل
                  </>
                )}
              </button>
            </motion.div>
          ))
        )}
      </div>

      <section className="bg-emerald-600 rounded-3xl p-8 text-white space-y-4 relative overflow-hidden">
        <div className="absolute -bottom-4 -right-4 opacity-20 rotate-12">
          <MessageCircle size={120} />
        </div>
        <div className="relative z-10 space-y-2">
          <h3 className="text-xl font-bold">هل لديك سؤال في التدبر؟</h3>
          <p className="text-emerald-100 text-sm">اطرح سؤالك وسيقوم المجتمع أو الذكاء الاصطناعي بمساعدتك.</p>
          <button className="mt-4 px-6 py-2 bg-white text-emerald-600 rounded-full text-sm font-bold hover:bg-emerald-50 transition-colors">
            اسأل الآن
          </button>
        </div>
      </section>
    </div>
  );
};



