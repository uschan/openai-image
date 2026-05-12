export interface Template {
  id: string;
  name: string;
  content: string;
  isPinned?: boolean;
}

export interface GeneratedImage {
  id: string;
  url: string;
  localUrl?: string;
  subject: string;
  prompt: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  categoryId?: string;
  isSaved: boolean; // Retained for backwards compatibility if needed
  metadata: {
    model: string;
    ratio: string;
    resolution: string;
  };
  isGeneratingPost?: boolean;
  postContent?: {
    title: string;
    body: string;
    tags: string[];
  };
}

export interface Category {
  id: string;
  name: string;
  count: number;
}
