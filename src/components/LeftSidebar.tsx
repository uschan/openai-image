import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, FolderOpen, Plus } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCategory } from './SortableCategory';
import type { Category } from '../types';

interface LeftSidebarProps {
  categories: Category[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isAddingCategory: boolean;
  setIsAddingCategory: (v: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  handleAddCategory: () => void;
}

export function LeftSidebar({
  categories, isSidebarOpen, setIsSidebarOpen, isAddingCategory, setIsAddingCategory,
  newCategoryName, setNewCategoryName, selectedCategory, setSelectedCategory, handleAddCategory,
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
            <div className="mb-4 flex gap-2">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="New Category..."
                className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-accent/40 focus:ring-0"
              />
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
                  onSelect={setSelectedCategory}
                />
              ))}
            </SortableContext>
          </div>
        </section>

        {isSidebarOpen && (
          <section className="mt-auto">
            <div className="flex items-center justify-between text-[9px] font-bold text-white/30 mb-3 uppercase tracking-widest">
              <span>GPU Performance</span>
              <span className="text-accent">92% Optimal</span>
            </div>
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: '92%' }} className="h-full bg-accent" />
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
