import { GoogleGenAI } from '@google/genai';
import { generateTimelinePrompt } from './prompt';
import { timelineSchema } from './schema';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTimeline = async (finalContentJson: string): Promise<string> => {
  if (!finalContentJson || finalContentJson.trim() === '{}' || finalContentJson.trim() === '') {
      return JSON.stringify({ events: [] });
  }
  const prompt = generateTimelinePrompt(finalContentJson);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: timelineSchema,
      },
    });

    // The response.text should be a JSON string that conforms to the schema
    const parsedData = JSON.parse(response.text);
    return JSON.stringify(parsedData, null, 2);
  } catch (e) {
    console.error("Gemini API call for timeline failed or returned non-JSON response:", e);
    // Return an empty structure on failure to prevent app crash
    return JSON.stringify({ events: [] });
  }
};
