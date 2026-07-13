import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { ImageCard } from './ImageCard';
import type { GeneratedImage, Category } from '../types';

interface ImageGridProps {
  images: GeneratedImage[];
  categories: Category[];
  selectedCategory: string;
  searchQuery: string;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onDelete: (id: string) => void;
  onGeneratePost: (id: string, prompt: string) => void;
  onBatchMove: (id: string, categoryId: string, localUrl: string) => void;
  onToggleFlag: (id: string) => void;
  groupBySubject: boolean;
  setGroupBySubject: (v: boolean) => void;
  setLightboxSubject: (v: string | null) => void;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onDataChanged: () => void;
}

export function ImageGrid({
  images, categories, selectedCategory, searchQuery, showSearch, setShowSearch,
  setSearchQuery, selectMode, setSelectMode, selectedIds, setSelectedIds,
  onDelete, onGeneratePost, onBatchMove, onToggleFlag,
  groupBySubject, setGroupBySubject, setLightboxSubject,
  total, hasMore, isLoading, onLoadMore, onDataChanged,
}: ImageGridProps) {

  const sorted = useMemo(() => {
    return [...images].sort((a, b) => b.timestamp - a.timestamp);
  }, [images]);

  return (
    <main className="flex-1 flex flex-col bg-editorial-800 relative">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8 custom-scrollbar">
        <div className="w-full space-y-6">

          {/* Search bar */}
          {showSearch && (
            <div className="flex items-center gap-3 max-w-xl">
              <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
              <input
                autoFocus type="text" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
                placeholder="Search subject or prompt..." className="flex-1 bg-transparent border-b border-white/10 text-sm text-white placeholder:text-white/20 py-2 outline-none focus:border-accent/50"
              />
              <span className="text-[10px] text-white/20 font-mono">ESC</span>
            </div>
          )}

          {/* Batch toolbar */}
          <div className="flex items-center gap-3 sticky top-0 z-10 -mx-4 px-4 py-2 bg-editorial-800/95 backdrop-blur-sm">
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${selectMode ? 'bg-accent/20 border-accent text-accent' : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'}`}
            >
              {selectMode ? 'Exit Select' : 'Select Mode'}
            </button>
            <button
              onClick={() => setGroupBySubject(!groupBySubject)}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${groupBySubject ? 'bg-accent/20 border-accent text-accent' : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'}`}
            >
              Group
            </button>
            {selectMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{selectedIds.size} selected</span>
                <select
                  onChange={async (e) => {
                    const catId = e.target.value;
                    if (!catId) return;
                    e.target.value = "";
                    for (const id of selectedIds) {
                      const img = images.find(i => i.id === id);
                      if (img?.localUrl) {
                        try {
                          const res = await fetch("/api/move-image", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ imageId: img.id, localUrl: img.localUrl, categoryId: catId }),
                          });
                          const data = await res.json();
                          if (data.localUrl) {
                            onBatchMove(id, catId, data.localUrl);
                          }
                        } catch (e) {
                          console.error('Batch move failed:', e);
                        }
                      }
                    }
                    setSelectedIds(new Set());
                    onDataChanged();
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="">Move to...</option>
                  {categories.filter(c => c.id !== 'all' && c.id !== 'uncategorized').map(c => (
                    <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                  ))}
                </select>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-white/40 hover:text-white">Clear</button>
              </div>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
            {groupBySubject ? (
              sorted.map((latest) => {
                const subj = latest.subject || 'Untitled';
                const allSelected = selectedIds.has(latest.id);
                const handleToggle = () => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (allSelected) next.delete(latest.id);
                    else next.add(latest.id);
                    return next;
                  });
                };
                return (
                  <div key={latest.id} className="cursor-pointer">
                    <ImageCard
                      image={latest}
                      overriddenSubject={`${subj}  (${latest.subjectCount || 1})`}
                      categoryName={categories.find(c => c.id === latest.categoryId)?.name}
                      onDelete={onDelete}
                      onGeneratePost={onGeneratePost}
                      onToggleFlag={() => onToggleFlag(latest.id)}
                      onOpen={() => setLightboxSubject?.(subj)}
                      selectMode={selectMode}
                      isSelected={allSelected}
                      onToggleSelect={handleToggle}
                    />
                  </div>
                );
              })
            ) : (
              sorted.map(image => (
                <ImageCard
                  key={image.id} image={image}
                  categoryName={categories.find(c => c.id === image.categoryId)?.name}
                  onDelete={onDelete} onGeneratePost={onGeneratePost}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(image.id)}
                  onToggleSelect={() => setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(image.id)) next.delete(image.id); else next.add(image.id);
                    return next;
                  })}
                  onToggleFlag={() => onToggleFlag(image.id)}
                />
              ))
            )}
          </div>

          {(hasMore || isLoading) && (
            <div className="flex justify-center py-6">
              <button
                onClick={onLoadMore}
                disabled={isLoading || !hasMore}
                className="px-5 py-2 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:border-white/30 disabled:opacity-30"
              >
                {isLoading ? 'Loading...' : `Load More (${images.length}/${total})`}
              </button>
            </div>
          )}

          {sorted.length === 0 && total > 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
              <h2 className="text-3xl font-light serif-italic italic tracking-tight text-white/20">No matches found.</h2>
            </div>
          )}

          {total === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
              <h2 className="text-5xl font-light serif-italic italic tracking-tight text-white/20">No images yet.</h2>
              <p className="mt-4 label-caps tracking-[0.4em]">Generate your first subject</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
