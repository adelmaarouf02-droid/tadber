import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const geminiService = {
  async generateTadabbur(text: string, surahName: string, ayahNumber: number): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a short, inspiring reflection (Tadabbur) in Arabic for the following Quranic verse:
        Surah: ${surahName}, Ayah: ${ayahNumber}
        Text: "${text}"
        
        The reflection should be concise (2-3 sentences) and spiritually uplifting.`,
      });
      return response.text || "سبحان الله وبحمده";
    } catch (error) {
      console.error("Gemini API error:", error);
      // Return a fallback message if the API call fails (e.g., due to rate limits)
      return "تأمل في هذه الآية الكريمة واستشعر عظمة الله فيها.";
    }
  }
};
