
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
        content: { type: Type.STRING, description: "Refined text content. Fix errors but keep it concise." },
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
        text: `请整理这段文字记录: "${text}"。\n重要：这是一段语音转文字的内容，可能包含同音字错误或口语冗余，请先修复明显的错别字和语病，使内容通顺。请保持精练，不要啰嗦，不要添加过多的解释性语句。然后总结正文、提取主题。请提供 5-8 个相关的关键词供用户选择。`
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

export const extractKeywords = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{
          text: `请分析这段文本，提取 5-8 个核心关键词（Keywords）。请只返回关键词列表，不需要任何解释。文本内容：\n"${text}"`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    const result = JSON.parse(jsonText);
    return result.keywords || [];
  } catch (error) {
    console.error("Keyword Extraction Error:", error);
    return [];
  }
};

export const proofreadText = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{
          text: `请对以下语音转文字的内容进行轻微修正：
1. 修正明显的错别字或同音词错误。
2. 必须添加正确的标点符号，将连续的语音流转换为断句清晰、阅读通顺的文本。
3. 重要：保持原意和说话语气，不要进行总结，不要删减细节，不要大幅改写。
4. 必须使用简体中文（Simplified Chinese）输出，严禁使用繁体字。
直接返回修正后的文本，不要包含任何解释或前缀。

原文：${text}`
        }]
      }
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Proofread Error:", error);
    return text; // Fallback to original on error
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
IMPORTANT: Keep your responses EXTREMELY concise. Max 2-3 sentences.
Fun, and occasionally use space-themed emojis.
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
