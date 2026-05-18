import React from 'react';
import { motion } from 'motion/react';
import {
  Loader2,
  Trash2,
  FolderOpen,
  Copy,
  Sparkles,
  RefreshCw,
  ExternalLink,
  GripVertical,
  CheckCircle2,
  Flag
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { GeneratedImage } from '../types';

export interface ImageCardProps {
  key?: string | number;
  image: GeneratedImage;
  categoryName?: string;
  onDelete: (id: string) => void;
  onGeneratePost: (id: string, prompt: string) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onToggleFlag?: () => void;
}

export function ImageCard({ image, categoryName, onDelete, onGeneratePost, selectMode, isSelected, onToggleSelect, onToggleFlag }: ImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({ 
    id: image.id,
    data: { type: 'image', categoryId: image.categoryId },
    disabled: selectMode,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(image.prompt);
  };

  const handleOpenImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const src = image.localUrl || image.url;
    if (src) {
      window.open(src, '_blank');
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={`group relative flex flex-col gap-4 ${selectMode ? 'cursor-pointer' : ''}`}
      onClick={() => { if (selectMode && onToggleSelect) onToggleSelect(); }}
    >
      {/* Flag indicator */}
      {image.flagged && (
        <div className="absolute -top-1 -right-1 z-40 px-2 py-0.5 bg-amber-500/90 text-black text-[9px] font-black uppercase tracking-wider rounded-md shadow-lg flex items-center gap-1">
          <Flag className="w-2.5 h-2.5 fill-black" /> 存疑
        </div>
      )}

      {/* Selection overlay */}
      {selectMode && (
        <div className={`absolute inset-0 z-30 rounded-2xl border-2 pointer-events-none transition-colors ${isSelected ? 'border-accent bg-accent/10' : 'border-transparent group-hover:border-white/10'}`}>
          {isSelected && <CheckCircle2 className="w-6 h-6 text-accent absolute top-3 right-3" />}
        </div>
      )}

      {/* Image Container with Drag Handle */}
      <div className={`relative aspect-[3/4] rounded-2xl overflow-hidden glass border transition-all duration-700 group-hover:border-accent/40 shadow-2xl ${image.flagged ? 'border-amber-500/50 !border-amber-500/50' : 'border-white/10'}`}>
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={handleOpenImage}
                className="p-2 bg-black/40 hover:bg-black/80 backdrop-blur-md text-white rounded-lg transition-all"
                title="View Full Size"
            >
                <ExternalLink className="w-4 h-4" />
            </button>
            <div 
                {...listeners} 
                {...attributes}
                className="p-2 bg-black/40 hover:bg-black/80 backdrop-blur-md text-white rounded-lg cursor-grab active:cursor-grabbing transition-all"
                title="Drag to Category"
            >
                <GripVertical className="w-4 h-4" />
            </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />

        {image.status === 'pending' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 shimmer">
            <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
            <span className="label-caps !text-white/40">Synthesizing...</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all mt-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <img 
              src={image.localUrl || image.url} 
              alt={image.prompt}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src === image.localUrl && image.url) {
                  img.src = image.url;
                }
              }}

              onClick={handleOpenImage}
              className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105 cursor-pointer"
            />
            
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-editorial-950 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
            
            {/* Resolution/Ratio Badges */}
            <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
              <span className="bg-black/40 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-accent">
                {image.metadata.ratio}
              </span>
              <span className="bg-black/40 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-white/60">
                {image.metadata.resolution}
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 z-10">
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
                  className="flex-1 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all flex items-center justify-center gap-2"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Delete</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info Panel Below Card */}
      <div className="px-1 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black uppercase tracking-[0.1em] text-white/90 truncate mr-4" title={image.subject}>
            {image.subject || "Untitled Synthesis"}
          </h4>
          <span className="text-[10px] font-mono text-white/20 whitespace-nowrap">
            {new Date(image.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-3 h-3 text-accent/40" />
            <span className="text-[9px] font-bold text-accent/60 uppercase tracking-widest">
              {categoryName || image.categoryId || 'Uncategorized'}
            </span>
          </div>
          {image.status === 'completed' && (
            <button onClick={(e) => { e.stopPropagation(); onToggleFlag?.(); }} className={`p-1 rounded transition-colors ${image.flagged ? 'text-amber-400 bg-amber-500/10' : 'text-white/15 hover:text-amber-400'}`} title={image.flagged ? '取消标记' : '标记存疑'}>
              <Flag className={`w-3 h-3 ${image.flagged ? 'fill-amber-400' : ''}`} />
            </button>
          )}
        </div>

        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 group-hover:border-white/10 transition-colors relative">
          <p className="text-[10px] font-medium leading-relaxed italic text-white/40 line-clamp-3 pr-8">
            "{image.prompt}"
          </p>
          <button 
            onClick={handleCopyPrompt}
            className="absolute top-3 right-3 p-1.5 bg-white/5 hover:bg-accent hover:text-black text-white/40 rounded-lg transition-colors"
            title="Copy Prompt"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        {/* DeepSeek Social Post Area */}
        {image.status === 'completed' && (
          <div className="bg-editorial-900/50 rounded-xl border border-white/5 p-3 flex flex-col gap-3 group/post relative">
            {!image.postContent && !image.isGeneratingPost && (
              <button 
                onClick={() => onGeneratePost(image.id, image.subject)}
                className="w-full py-2 text-[10px] font-bold text-accent hover:text-accent/80 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                Generate Social Post
              </button>
            )}
            {image.isGeneratingPost && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-3 h-3 text-accent animate-spin" />
                <span className="text-[10px] uppercase tracking-widest text-white/50">Synthesizing Copy...</span>
              </div>
            )}
            {image.postContent && (
              <div className="flex flex-col gap-2 text-left relative">
                <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover/post:opacity-100 z-10 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onGeneratePost(image.id, image.subject);
                    }}
                    className="p-1.5 bg-white/5 hover:bg-accent hover:text-black text-white/40 rounded-lg transition-colors"
                    title="Regenerate Post"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = `${image.postContent?.title || ''}\n\n${image.postContent?.body || ''}\n\n${(image.postContent?.tags || []).map(t => '#' + t.replace(/^#/, '')).join(' ')}`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="p-1.5 bg-white/5 hover:bg-accent hover:text-black text-white/40 rounded-lg transition-colors"
                    title="Copy Post"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <h4 className="text-sm font-bold text-white pr-16">{image.postContent.title || 'Untitled Post'}</h4>
                <p className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap">{image.postContent.body}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(image.postContent.tags || []).map((tag: string, idx: number) => (
                    <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded uppercase font-bold">#{tag.replace(/^#/, '')}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
