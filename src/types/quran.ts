export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean;
}

export interface SurahDetail extends Surah {
  ayahs: Ayah[];
}

export interface DailyAyah {
  text: string;
  surah: string;
  number: number;
  translation: string;
  tafsir?: string;
}
