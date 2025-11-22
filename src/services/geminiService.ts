import { GoogleGenAI } from "@google/genai";
import { RsyncConfig } from "../types";

// Helper to get client safely
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateRsyncExplanation = async (config: RsyncConfig, mode: string): Promise<string> => {
  try {
    const client = getClient();
    const model = client.models;
    
    const prompt = `
      Explain what this rsync configuration does in simple terms for a non-technical user.
      Mode: ${mode}
      Configuration: ${JSON.stringify(config)}
      
      Keep it brief (under 50 words) and highlight if any data will be deleted on the destination.
    `;

    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI Assistant unavailable.";
  }
};

export const generateFlagsFromNaturalLanguage = async (input: string): Promise<Partial<RsyncConfig>> => {
  try {
    const client = getClient();
    const model = client.models;

    // We ask for a JSON response to map to our config
    const prompt = `
      User Request: "${input}"
      
      Map this request to rsync boolean flags. 
      Return ONLY a JSON object with these keys: recursive, compress, archive, delete, verbose.
      Also provide a list of exclude patterns if mentioned.
      
      Example output:
      {
        "recursive": true,
        "compress": false,
        "delete": true,
        "excludePatterns": ["*.mp3", "node_modules"]
      }
    `;

    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return {};
  }
};
