import React from 'react';
import { Layers, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Category } from '../types';

export interface SortableCategoryProps {
  key?: string | number;
  category: Category;
  isSelected: boolean;
  isSidebarOpen: boolean;
  onSelect: (id: string) => void;
}

export function SortableCategory({ 
  category, 
  isSelected, 
  isSidebarOpen, 
  onSelect,
}: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ 
    id: category.id,
    data: { categoryId: category.id }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div 
        onClick={() => onSelect(category.id)}
        title={!isSidebarOpen ? `${category.name} (${category.count})` : undefined}
        className={`w-full flex items-center transition-all cursor-pointer rounded-lg border-2 ${
          isSidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-3'
        } ${
          isSelected 
            ? 'bg-white/5 border-accent/20 text-white' 
            : isOver 
              ? 'bg-accent/10 border-accent text-accent scale-105'
              : 'border-transparent text-white/40 hover:bg-white/5 hover:text-white'
        }`}
      >
        {isSidebarOpen && (
          <div {...listeners} {...attributes} className="cursor-grab hover:text-white transition-colors">
            <GripVertical className="w-3 h-3 opacity-30 group-hover:opacity-100" />
          </div>
        )}
        <Layers className={`shrink-0 ${isSidebarOpen ? 'w-4 h-4' : 'w-5 h-5'} ${isSelected ? 'text-accent' : ''}`} />
        {isSidebarOpen && (
          <>
            <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wide truncate">
              {category.name}
            </span>
            <span className="text-[10px] font-mono text-white/20">{category.count}</span>
          </>
        )}
      </div>
    </div>
  );
}
