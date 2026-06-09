import { X } from 'lucide-react';
import { ImageCard } from './ImageCard';
import type { GeneratedImage } from '../types';

interface SubjectLightboxProps {
  subject: string;
  images: GeneratedImage[];
  categoryName: (catId: string | undefined) => string;
  onDelete: (id: string) => void;
  onGeneratePost: (id: string, prompt: string) => void;
  onToggleFlag: (id: string) => void;
  onClose: () => void;
}

export function SubjectLightbox({ subject, images, categoryName, onDelete, onGeneratePost, onToggleFlag, onClose }: SubjectLightboxProps) {
  return (
    <div className="fixed inset-0 lg:right-80 z-50 bg-black/80 backdrop-blur-md flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black uppercase tracking-wider text-white">{subject} <span className="text-white/30 text-sm">({images.length})</span></h2>
        <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
          {images.map(img => (
            <ImageCard
              key={img.id}
              image={img}
              categoryName={categoryName(img.categoryId)}
              onDelete={onDelete}
              onGeneratePost={onGeneratePost}
              onToggleFlag={onToggleFlag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
