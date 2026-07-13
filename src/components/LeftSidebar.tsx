import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, FolderOpen, Plus } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCategory } from './SortableCategory';
import type { Category } from '../types';
import { CATEGORY_ICON_OPTIONS } from '../category-icons';

interface LeftSidebarProps {
  categories: Category[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  newCategoryStorageKey: string;
  setNewCategoryStorageKey: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  handleAddCategory: () => void;
  newCategoryIcon: string;
  setNewCategoryIcon: (v: string) => void;
  onNativeImageDrop?: (imageId: string, categoryId: string) => void;
  onEditCategory?: (category: Category) => void;
}

export function LeftSidebar({
  categories, isSidebarOpen, setIsSidebarOpen, isAddingCategory, setIsAddingCategory,
  newCategoryName, setNewCategoryName, newCategoryStorageKey, setNewCategoryStorageKey, newCategoryIcon, setNewCategoryIcon,
  selectedCategory, setSelectedCategory, handleAddCategory, onNativeImageDrop,
  onEditCategory,
}: LeftSidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 260 : 72 }}
      className="bg-editorial-850 border-r border-white/10 flex flex-col z-20 relative select-none"
    >
      <div className={`flex-1 flex flex-col gap-10 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'p-6' : 'p-4'}`}>
        <section>
          <div className={`flex items-center ${isSidebarOpen ? 'justify-between mb-5' : 'justify-center mb-5'}`}>
            {isSidebarOpen ? (
              <h3 className="label-caps !mb-0">Creative Library</h3>
            ) : (
              <FolderOpen className="w-4 h-4 text-white/30" />
            )}
            {isSidebarOpen && (
              <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="p-1 hover:bg-white/5 rounded transition-colors text-white/30 hover:text-accent">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          {isAddingCategory && isSidebarOpen && (
            <div className="mb-4 space-y-2">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="New Category..."
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-accent/40 focus:ring-0"
              />
              <input
                value={newCategoryStorageKey}
                onChange={(e) => setNewCategoryStorageKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="ASCII storage key (optional)"
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white focus:border-accent/40 focus:ring-0"
              />
              <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                {CATEGORY_ICON_OPTIONS.map(({ name, Icon }) => (
                  <button key={name} onClick={() => setNewCategoryIcon(name)}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${newCategoryIcon === name ? 'bg-accent/20 text-accent' : 'text-white/30 hover:text-white/60'}`}
                    title={name}>
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {categories.map(cat => (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategory === cat.id}
                  isSidebarOpen={isSidebarOpen}
                  onSelect={setSelectedCategory} onNativeImageDrop={onNativeImageDrop}
                  onEdit={onEditCategory}
                />
              ))}
            </SortableContext>
          </div>
        </section>

        {isSidebarOpen && (
          <section className="mt-auto pt-4 border-t border-white/5">
            <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
              Images · {categories.find(c => c.id === 'all')?.count || 0}
            </div>
          </section>
        )}
      </div>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute -right-3 top-10 w-6 h-6 bg-editorial-850 border border-white/10 rounded-full flex items-center justify-center hover:text-accent transition-colors z-30"
      >
        {isSidebarOpen ? <ChevronLeft className="w-3" /> : <ChevronRight className="w-3" />}
      </button>
    </motion.aside>
  );
}
