export enum RecordType {
  NOTE = 'NOTE',
  BOOK = 'BOOK',
  MOVIE = 'MOVIE',
  MUSIC = 'MUSIC'
}

export interface MediaMetadata {
  title: string;
  creator: string; // Author, Director, Artist
  coverUrl?: string | undefined; // Base64 string
  genre?: string | undefined;
  region?: string | undefined; // For movies
  year?: string | undefined;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface RecordData {
  id: string;
  type: RecordType;
  timestamp: number;
  content: string; // The main text content or summary
  topic: string;
  keywords: string[];
  category: string; // e.g., Life, Work, Creative
  mediaMeta?: MediaMetadata;
  originalImage?: string; // Base64
  chatHistory?: ChatMessage[];
}

// Gemini Response Schema
export interface AnalysisResult {
  isMedia: boolean;
  detectedType: 'BOOK' | 'MOVIE' | 'MUSIC' | 'OTHER';
  mediaMeta?: {
    title: string;
    creator: string;
    genre: string;
    region?: string;
  };
  noteData: {
    content: string;
    topic: string;
    keywords: string[];
    category: string;
  };
}