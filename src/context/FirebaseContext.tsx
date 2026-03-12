import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';

interface FirebaseContextType {
  user: FirebaseUser | null;
  loading: boolean;
  userData: any | null;
  signIn: () => Promise<void>;
  isSigningIn: boolean;
  logout: () => Promise<void>;
  updateUserData: (data: any) => Promise<void>;
  incrementAyahCount: () => Promise<void>;
  updateAudioProgress: (surahNumber: number, progress: number) => Promise<void>;
  getMemorization: (surahNumber: number) => Promise<number[]>;
  toggleMemorizedAyah: (surahNumber: number, ayahNumber: number) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            // Create user profile if it doesn't exist
            const newUserData = {
              uid: currentUser.uid,
              displayName: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              createdAt: serverTimestamp(),
              completedAyahsToday: 0,
              totalCompletedAyahs: 0,
              totalMemorized: 0,
              dailyGoal: 10
            };
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    if (isSigningIn) return;
    
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log("Sign in popup request was cancelled (another popup was opened).");
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("Sign in popup was closed by the user.");
      } else {
        console.error("Sign in error:", error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateUserData = async (data: any) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, data, { merge: true });
      setUserData((prev: any) => ({ ...prev, ...data }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const incrementAyahCount = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const newCountToday = (userData?.completedAyahsToday || 0) + 1;
      const newTotalCount = (userData?.totalCompletedAyahs || 0) + 1;
      
      await setDoc(userDocRef, { 
        completedAyahsToday: newCountToday,
        totalCompletedAyahs: newTotalCount
      }, { merge: true });
      
      setUserData((prev: any) => ({ 
        ...prev, 
        completedAyahsToday: newCountToday,
        totalCompletedAyahs: newTotalCount
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const updateAudioProgress = async (surahNumber: number, progress: number) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const audioProgress = userData?.audioProgress || {};
      audioProgress[surahNumber] = progress;
      
      await setDoc(userDocRef, { audioProgress }, { merge: true });
      setUserData((prev: any) => ({ ...prev, audioProgress }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const getMemorization = async (surahNumber: number): Promise<number[]> => {
    if (!user) return [];
    try {
      const memDocRef = doc(db, 'users', user.uid, 'memorization', surahNumber.toString());
      const memDoc = await getDoc(memDocRef);
      if (memDoc.exists()) {
        return memDoc.data().memorizedAyahs || [];
      }
      return [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/memorization/${surahNumber}`);
      return [];
    }
  };

  const toggleMemorizedAyah = async (surahNumber: number, ayahNumber: number) => {
    if (!user) return;
    try {
      const memDocRef = doc(db, 'users', user.uid, 'memorization', surahNumber.toString());
      const userRef = doc(db, 'users', user.uid);
      const currentMem = await getMemorization(surahNumber);
      let newMem: number[];
      let isAdding = true;
      
      if (currentMem.includes(ayahNumber)) {
        newMem = currentMem.filter(id => id !== ayahNumber);
        isAdding = false;
      } else {
        newMem = [...currentMem, ayahNumber];
      }

      await setDoc(memDocRef, {
        surahNumber,
        memorizedAyahs: newMem,
        updatedAt: serverTimestamp()
      });

      // Update total count in user profile
      await updateDoc(userRef, {
        totalMemorized: increment(isAdding ? 1 : -1)
      });

      // Update local state
      setUserData((prev: any) => ({
        ...prev,
        totalMemorized: (prev?.totalMemorized || 0) + (isAdding ? 1 : -1)
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/memorization/${surahNumber}`);
    }
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      loading, 
      userData, 
      signIn, 
      isSigningIn,
      logout, 
      updateUserData, 
      incrementAyahCount, 
      updateAudioProgress,
      getMemorization,
      toggleMemorizedAyah
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
