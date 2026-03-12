import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const geminiService = {
  async generateTadabbur(ayahText: string, surahName: string, ayahNumber: number): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `أنت خبير في التفسير والتدبر. قم بتقديم تدبر بسيط ومختصر (حوالي 3-4 جمل) للآية التالية من سورة ${surahName}، الآية رقم ${ayahNumber}: "${ayahText}". ركز على المعنى الإيماني والعملي.`,
        config: {
          systemInstruction: "You are a helpful assistant that provides short, spiritual reflections on Quranic verses in Arabic.",
        },
      });
      return response.text || "لا يتوفر تدبر حالياً.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "حدث خطأ أثناء جلب التدبر.";
    }
  }
};
