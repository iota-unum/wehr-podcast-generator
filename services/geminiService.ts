import { GoogleGenAI, Modality } from '@google/genai';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second

export const generateSpeech = async (scriptSegment: string, speaker1: string, speaker2: string): Promise<string> => {
    // Clean the script segment but keep the line breaks and speaker tags
    const cleanedScript = scriptSegment
        .split('\n')
        .map(line => line.replace(/<mark[^>]*>/g, '').trim()) // remove mark tags
        .map(line => line.replace(/\*/g, '')) // remove asterisks
        .filter(line => line.trim().length > 0) // remove empty lines
        .join('\n');

    // Check if there is any actual dialogue to generate
    if (!cleanedScript.includes(`${speaker1}:`) && !cleanedScript.includes(`${speaker2}:`)) {
        // Return a short silent audio clip to prevent downstream errors
        return "AAA="; 
    }

    const ttsPrompt = `Sintetizza vocalmente (TTS) la seguente conversazione tra ${speaker1} e ${speaker2}. Usa un tono vivace e coinvolgente, con un ritmo veloce e sostenuto. La lingua è l'italiano.
**REGOLA CRITICA:** DEVI seguire ALLA LETTERA qualsiasi tag SSML, come <phoneme>. La pronuncia specificata nel tag ha la priorità ASSOLUTA su qualsiasi altra regola di pronuncia che conosci. Se trovi un tag <phoneme>, IGNORA la pronuncia standard della parola e usa SOLO la trascrizione fonetica fornita nell'attributo 'ph'. Presta anche attenzione agli accenti tonici indicati nel testo, quando specificati tra parentesi quadre o con accenti grafici (es. Arìstocle).

${cleanedScript}`;
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: ttsPrompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                {
                                    speaker: speaker1, // e.g., 'Voce 1'
                                    voiceConfig: {
                                        prebuiltVoiceConfig: { voiceName: 'Kore' } // Female
                                    }
                                },
                                {
                                    speaker: speaker2, // e.g., 'Voce 2'
                                    voiceConfig: {
                                        prebuiltVoiceConfig: { voiceName: 'Orus' } // Male
                                    }
                                }
                            ]
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                return base64Audio; // Success!
            }
            
            const reason = response.candidates?.[0]?.finishReason;
            const message = response.candidates?.[0]?.finishMessage;
            lastError = new Error(`Audio data not found. Reason: ${reason}, Message: ${message}`);
            console.warn(`Audio generation attempt ${attempt} failed: ${lastError.message}`);

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Audio generation attempt ${attempt} threw an error:`, lastError);
        }
        
        // Don't wait after the last attempt
        if (attempt < MAX_RETRIES) {
             console.log(`Waiting ${RETRY_DELAY_MS * attempt}ms before retrying...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Linear backoff
        }
    }

    // If loop completes, all retries have failed.
    throw new Error(`Failed to generate audio for script segment after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
};


export const getPhonemeForWord = async (word: string): Promise<string> => {
  if (!word || !word.trim()) {
    throw new Error("La parola non può essere vuota.");
  }

  const prompt = `Fornisci la trascrizione fonetica IPA per la seguente parola italiana. Rispondi SOLO con la trascrizione IPA, senza barre laterali (/ /) o altre spiegazioni.

Parola: "${word.trim()}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });
    
    let ipa = response.text.trim();
    // Sanitize the response: remove leading/trailing slashes which can confuse the TTS engine.
    ipa = ipa.replace(/^\/|\/$/g, ''); 
    
    if (!ipa) {
        throw new Error("La risposta dell'API era vuota.");
    }
    return ipa;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Impossibile ottenere il fonema per "${word}":`, err);
    throw new Error(`Non è stato possibile generare il fonema per "${word}". ${err.message}`);
  }
};