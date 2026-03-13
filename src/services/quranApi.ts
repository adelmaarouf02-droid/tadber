import { Surah, SurahDetail, Ayah } from '../types/quran';

const BASE_URL = 'https://api.alquran.cloud/v1';

export const quranApi = {
  async getSurahs(): Promise<Surah[]> {
    const response = await fetch(`${BASE_URL}/surah`);
    const data = await response.json();
    return data.data;
  },

  async getSurahDetail(number: number): Promise<SurahDetail> {
    const response = await fetch(`${BASE_URL}/surah/${number}/quran-uthmani`);
    const data = await response.json();
    return data.data;
  },

  async getAyah(number: number): Promise<Ayah> {
    const response = await fetch(`${BASE_URL}/ayah/${number}/quran-uthmani`);
    const data = await response.json();
    return data.data;
  },

  async search(query: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(query)}/quran-uthmani/ar`);
    const data = await response.json();
    return data.data;
  }
};
