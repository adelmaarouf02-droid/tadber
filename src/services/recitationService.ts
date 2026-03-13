import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const recitationService = {
  async compareRecitation(audioBase64: string, ayahText: string, ayahNumber: number, surahName: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `أنت خبير في التجويد والقراءات. استمع إلى هذا التسجيل الصوتي لمستخدم يقرأ الآية التالية: "${ayahText}" من سورة ${surahName} (الآية رقم ${ayahNumber}).
                قم بمقارنة تلاوته مع قواعد التجويد الصحيحة ومخارج الحروف.
                قدم تقييماً موجزاً ومشجعاً باللغة العربية، موضحاً نقاط القوة ونقاط التحسين (مثل المدود، الغنة، أو مخارج الحروف).
                اجعل الرد بصيغة JSON كالتالي:
                {
                  "score": 0-100,
                  "feedback": "نص التقييم هنا",
                  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
                  "improvements": ["نقطة تحسين 1", "نقطة تحسين 2"]
                }`
              },
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: audioBase64
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Error comparing recitation:", error);
      throw error;
    }
  }
};
