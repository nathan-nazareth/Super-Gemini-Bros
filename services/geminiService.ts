import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "../types";

// Helper to get AI instance safely
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const generateGameAsset = async (prompt: string, size: "1K" | "2K" | "4K" = "1K"): Promise<string | null> => {
  try {
    const ai = getAI();
    // Using gemini-3-pro-image-preview for high quality generation
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: size
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image gen error:", error);
    throw error;
  }
};

export const editGameView = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    const ai = getAI();
    // Using gemini-2.5-flash-image for editing tasks as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image edit error:", error);
    throw error;
  }
};

export const askGameAssistant = async (
  query: string, 
  history: ChatMessage[], 
  useGrounding: boolean,
  useThinking: boolean
): Promise<{ text: string, groundingUrls?: string[] }> => {
  try {
    const ai = getAI();
    
    // Choose model based on complexity and requirements
    let modelName = 'gemini-3-flash-preview';
    let config: any = {};

    if (useThinking) {
      modelName = 'gemini-3-pro-preview';
      config.thinkingConfig = { thinkingBudget: 32768 }; // Max budget
    } else if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    // Construct history for context
    // Note: In a real app, we'd use ai.chats.create() for proper history management.
    // Here we just append the latest prompt to a fresh call or managing locally.
    // For simplicity in this demo, we just send the latest query with a system prompt context.

    const systemPrompt = `You are a helper for a retro platformer game called "Super Gemini Bros".
    Help the player with tips, mechanics explanations, or creative ideas for the game universe.
    The game features Mario-like mechanics: jump, run, stomp enemies.`;

    config.systemInstruction = systemPrompt;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: query,
      config: config
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const urls: string[] = [];
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          urls.push(chunk.web.uri);
        }
      });
    }

    return {
      text: response.text || "I couldn't generate a response.",
      groundingUrls: urls
    };

  } catch (error) {
    console.error("Chat error:", error);
    return { text: "Error communicating with AI service." };
  }
};
