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
  isSaved: boolean;
  flagged?: boolean;
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
  subjectCount?: number;
  thumbnailUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  count: number;
  icon?: string;
  folderName?: string;
  storageKey?: string;
}
