import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Schema definition for Gemini JSON output
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    isMedia: { type: Type.BOOLEAN, description: "True if the input is clearly a Book Cover, Movie Poster, or Music Album Cover." },
    detectedType: { type: Type.STRING, enum: ["BOOK", "MOVIE", "MUSIC", "OTHER"] },
    mediaMeta: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        title: { type: Type.STRING },
        creator: { type: Type.STRING, description: "Author for books, Director for movies, Artist for music" },
        genre: { type: Type.STRING },
        region: { type: Type.STRING, description: "Country or region of origin if applicable" }
      }
    },
    noteData: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "Refined text content. Fix any obvious speech-to-text errors or typos." },
        topic: { type: Type.STRING, description: "A short subject line (max 5 words)." },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5-8 relevant keywords for selection." },
        category: { type: Type.STRING, enum: ["生活", "工作", "创意", "娱乐", "其他"] }
      }
    }
  },
  required: ["isMedia", "detectedType", "noteData"]
};

export const analyzeInput = async (
  text: string, 
  imageBase64?: string
): Promise<AnalysisResult> => {
  
  try {
    const modelId = "gemini-2.5-flash";
    
    const parts: any[] = [];
    
    if (imageBase64) {
      // Extract base64 data if it contains the prefix
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg" // Assuming JPEG for simplicity from camera/file input
        }
      });
      parts.push({
        text: "分析这张图片。如果它是书籍封面、电影海报或音乐专辑，请提取其详细信息。如果不是媒体封面，请将其视为普通的生活/工作灵感图片笔记，提取其视觉主题。如果附带了文字，请结合文字进行理解。"
      });
    } 
    
    if (text) {
      parts.push({
        text: `请整理这段文字记录: "${text}"。\n重要：这是一段语音转文字的内容，可能包含同音字错误或口语冗余，请先修复明显的错别字和语病，使内容通顺，然后总结正文、提取主题。请提供 5-8 个相关的关键词供用户选择。`
      });
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "你是 Xyla，一个智能生活记录助手。请将输入整理为结构化的笔记或特定的媒体记录（书籍、影视、音乐）。请务必使用中文（Simplified Chinese）返回所有文本内容。"
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("AI 未返回数据");
    
    return JSON.parse(jsonText) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback object in case of failure
    return {
      isMedia: false,
      detectedType: 'OTHER',
      noteData: {
        content: text || "无法分析内容，请重试。",
        topic: "分析失败",
        keywords: ["错误"],
        category: "其他"
      }
    };
  }
};

export const generateChatReply = async (
  recordContext: string,
  history: { role: 'user' | 'model', text: string }[],
  message: string
) => {
  try {
    // Construct history in the format expected by Gemini
    const formattedHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: formattedHistory,
      config: {
        systemInstruction: `You are an Alien AI Assistant (Avatar: 👽). 
Your name is 'Xyla'. You are quirky, curious, and very helpful.
You are currently discussing a specific note/record with the user.
The content of the note is: "${recordContext}".
Use this content as context to answer questions or provide insights.
Keep your responses concise, fun, and occasionally use space-themed emojis.
Reply in Simplified Chinese.`
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Chat Error", error);
    return "通讯受到干扰... 🛸 (Error)";
  }
};