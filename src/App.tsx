import { useState, useEffect, useCallback } from 'react';
import { Layers, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragOverlay, defaultDropAnimationSideEffects, DragStartEvent, DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Template, GeneratedImage, Category } from './types';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { ImageGrid } from './components/ImageGrid';
import { HistoryTab } from './components/HistoryTab';
import { ModelsTab } from './components/ModelsTab';
import { SubjectLightbox } from './components/SubjectLightbox';
import { TemplateLibrary } from './components/TemplateLibrary';
import { CategoryEditor } from './components/CategoryEditor';

export default function App() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', name: 'All Work', count: 0 },
    { id: 'uncategorized', name: 'Uncategorized', count: 0 },
  ]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryStorageKey, setNewCategoryStorageKey] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("Layers");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'category' | 'template' | null>(null);
  const [subject, setSubject] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [generationStats, setGenerationStats] = useState({ totalAttempts: 0, successful: 0, failed: 0 });
  const [finalPrompt, setFinalPrompt] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("uncategorized");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModel, setActiveModel] = useState("GPT-IMAGE");
  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [resolution, setResolution] = useState("2k");
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'assets' | 'models' | 'history'>('workspace');
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apiHealth, setApiHealth] = useState({ gemini: false, apimart: false, apikeyfun: false, deepseek: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [groupBySubject, setGroupBySubject] = useState(true);
  const [lightboxSubject, setLightboxSubject] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<GeneratedImage[]>([]);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [totalImages, setTotalImages] = useState(0);
  const [queryTotal, setQueryTotal] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const sessionStart = Date.now();
  const [sessionTime, setSessionTime] = useState("00:00:00");

  useEffect(() => {
    const t = setInterval(() => {
      const d = Math.floor((Date.now() - sessionStart) / 1000);
      setSessionTime(`${String(Math.floor(d/3600)).padStart(2,'0')}:${String(Math.floor(d/60)%60).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(""), 5000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: undefined as any }),
  );

  const refreshBootstrap = useCallback(async () => {
    const r = await fetch('/api/bootstrap');
    if (!r.ok) throw new Error('Failed to load workspace');
    const d = await r.json();
    if (d.categories) setCategories(d.categories);
    if (d.templates) {
      setTemplates(d.templates);
      setPromptTemplate(current => current || d.templates[0]?.content || '');
    }
    if (d.stats) setGenerationStats(d.stats);
    setTotalImages(d.totalImages || 0);
    setArchivedCount(d.archived || 0);
  }, []);

  const refreshApiHealth = useCallback(async () => {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Failed to load provider status');
    const data = await response.json();
    setApiHealth(data.keys || { gemini: false, apimart: false, apikeyfun: false, deepseek: false });
  }, []);

  const loadImages = useCallback(async (reset = true) => {
    setIsLoadingImages(true);
    try {
      const params = new URLSearchParams({ category: selectedCategory, group: String(groupBySubject), limit: '60' });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (!reset && nextCursor) params.set('cursor', nextCursor);
      const r = await fetch(`/api/images?${params}`);
      if (!r.ok) throw new Error('Failed to load images');
      const d = await r.json();
      setImages(current => reset ? (d.images || []) : [...current, ...(d.images || [])]);
      setNextCursor(d.nextCursor || null);
      setQueryTotal(d.total || 0);
      if (selectedCategory === 'all' && !searchQuery) setTotalImages(d.total || 0);
    } catch (error: any) {
      showError(error.message || 'Failed to load images');
    } finally {
      setIsLoadingImages(false);
    }
  }, [groupBySubject, nextCursor, searchQuery, selectedCategory]);

  const persistImage = useCallback(async (image: GeneratedImage) => {
    const r = await fetch('/api/images/upsert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(image),
    });
    if (!r.ok) throw new Error('Failed to persist image record');
    return (await r.json()).image as GeneratedImage;
  }, []);

  const openSubject = useCallback(async (value: string | null) => {
    setLightboxSubject(value);
    if (!value) { setLightboxImages([]); return; }
    setLightboxLoading(true);
    try {
      const r = await fetch(`/api/subjects/${encodeURIComponent(value)}/images`);
      if (!r.ok) throw new Error('Failed to load subject');
      setLightboxImages((await r.json()).images || []);
    } catch (error: any) {
      showError(error.message || 'Failed to load subject');
    } finally {
      setLightboxLoading(false);
    }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    refreshApiHealth().catch(() => {});
  }, [refreshApiHealth]);

  useEffect(() => {
    setFinalPrompt(promptTemplate.replace(/{SUBJECT}/g, subject || "[SUBJECT]"));
  }, [subject, promptTemplate]);

  useEffect(() => { // load lightweight workspace metadata
    (async () => {
      try {
        await refreshBootstrap();
        setLoaded(true);
      } catch (error: any) { showError(error.message || 'Failed to load workspace'); }
    })();
  }, [refreshBootstrap]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { loadImages(true); }, 250);
    return () => clearTimeout(t);
  }, [groupBySubject, loaded, searchQuery, selectedCategory]);

  useEffect(() => { // sync only lightweight settings
    if (!loaded) return;
    const t = setTimeout(async () => {
      await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates, stats: generationStats }) });
    }, 3000);
    return () => clearTimeout(t);
  }, [templates, generationStats, loaded]);

  useEffect(() => { // keyboard shortcuts
    const h = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowSearch(p => !p); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (subject && !isGenerating) generateImage(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [subject, isGenerating, finalPrompt, activeModel, aspectRatio, resolution]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), storageKey: newCategoryStorageKey.trim() || undefined, icon: newCategoryIcon }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Category creation failed.');
      setCategories(current => [...current, data.category]);
      setNewCategoryName(''); setNewCategoryStorageKey(''); setNewCategoryIcon('Layers'); setIsAddingCategory(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Category creation failed.');
    }
  };

  const handleUpdateCategory = async (category: Category, changes: { name: string; storageKey: string; icon: string }) => {
    const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Category update failed.');
    setCategories(current => current.map(item => item.id === category.id ? data.category : item));
  };

  const handleDeleteCategory = async (category: Category) => {
    const response = await fetch(`/api/categories/${encodeURIComponent(category.id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Category deletion failed.');
    setCategories(current => current.filter(item => item.id !== category.id));
    if (selectedCategory === category.id) setSelectedCategory('uncategorized');
  };

  const handleGeneratePost = async (id: string, subject: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: true } : img));
    setLightboxImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: true } : img));
    try {
      const r = await fetch("/api/generate-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false, postContent: d } : img));
      setLightboxImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false, postContent: d } : img));
    } catch {
      setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false } : img));
      setLightboxImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false } : img));
      showError("Post generation failed.");
    }
  };

  const handleDeleteImage = async (id: string) => {
    const img = images.find(i => i.id === id) || lightboxImages.find(i => i.id === id);
    try {
      const r = await fetch("/api/delete-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, localUrl: img?.localUrl }) });
      if (!r.ok) throw new Error('Delete failed');
      setImages(prev => prev.filter(i => i.id !== id));
      setLightboxImages(prev => prev.filter(i => i.id !== id));
      await refreshBootstrap();
      await loadImages(true);
    } catch (e) { console.error('Delete file failed:', e); showError('Delete failed.'); }
  };

  const handleBatchMove = (id: string, categoryId: string, localUrl: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, categoryId, localUrl } : i));
  };

  const handleToggleFlag = async (id: string) => {
    const image = images.find(i => i.id === id) || lightboxImages.find(i => i.id === id);
    if (!image) return;
    const flagged = !image.flagged;
    setImages(prev => prev.map(i => i.id === id ? { ...i, flagged } : i));
    setLightboxImages(prev => prev.map(i => i.id === id ? { ...i, flagged } : i));
    try {
      const r = await fetch(`/api/images/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flagged }),
      });
      if (!r.ok) throw new Error('Flag update failed');
    } catch {
      setImages(prev => prev.map(i => i.id === id ? { ...i, flagged: image.flagged } : i));
      setLightboxImages(prev => prev.map(i => i.id === id ? { ...i, flagged: image.flagged } : i));
      showError('Flag update failed.');
    }
  };

  const handleSaveTemplate = (tpl: Partial<Template>) => {
    if (tpl.id) setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, ...tpl } as Template : t));
    else setTemplates(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), name: tpl.name || "Untitled", content: tpl.content || "", isPinned: tpl.isPinned !== false }]);
    setIsAddingTemplate(false); setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => { setTemplates(prev => prev.filter(t => t.id !== id)); };

  const handleEnhancePrompt = async () => {
    if (!subject) return; setEnhanceLoading(true);
    try {
      const r = await fetch("/api/enhance-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) });
      if (!r.ok) throw new Error("Failed");
      setSubject((await r.json()).text || "");
    } catch { showError("Enhance failed."); }
    finally { setEnhanceLoading(false); }
  };

  const moveImageToCategory = async (id: string, localUrl: string | undefined, categoryId: string) => {
    try {
      const r = await fetch("/api/move-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: id, localUrl, categoryId }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Move failed');
      const d = await r.json();
      if (d.localUrl) setImages(prev => prev.map(img => img.id === id ? { ...img, localUrl: d.localUrl, categoryId } : img));
      await refreshBootstrap();
      await loadImages(true);
    } catch (error: any) { showError(error.message || 'Move failed.'); }
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    if (categories.find(c => c.id === e.active.id)) setDragType('category');
    else if (templates.find(t => t.id === e.active.id)) setDragType('template');
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (dragType === 'category' && over && active.id !== over.id) {
      const oldIndex = categories.findIndex(item => item.id === active.id);
      const newIndex = categories.findIndex(item => item.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        const previous = categories;
        const next = arrayMove(categories, oldIndex, newIndex);
        setCategories(next);
        fetch('/api/categories/order', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map(item => item.id) }),
        }).then(async response => {
          if (!response.ok) throw new Error((await response.json()).error || 'Category reorder failed.');
        }).catch(error => {
          setCategories(previous);
          showError(error instanceof Error ? error.message : 'Category reorder failed.');
        });
      }
    }
    if (dragType === 'template' && over && active.id !== over.id) {
      setTemplates(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
    }
    setActiveId(null); setDragType(null);
  };

  const generateImage = async () => {
    if (!subject || isGenerating) return;
    setIsGenerating(true);
    setGenerationStats(prev => ({ ...prev, totalAttempts: prev.totalAttempts + 1 }));
    const imageId = Math.random().toString(36).slice(2, 11);
    const pending: GeneratedImage = {
      id: imageId, url: '', subject, prompt: finalPrompt, timestamp: Date.now(), status: 'pending',
      isSaved: false, categoryId: 'uncategorized', metadata: { model: activeModel, ratio: aspectRatio, resolution },
    };
    setImages(prev => [pending, ...prev]);
    try {
      await persistImage(pending);
      if (groupBySubject) await loadImages(true);
      const gr = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId, subject, prompt: finalPrompt, model: activeModel, size: aspectRatio, resolution, image_urls: referenceImages }) });
      const gd = await gr.json();

      if (gd.provider === "apikeyfun" && gd.localUrl) {
        const completed = { ...pending, status: 'completed', localUrl: gd.localUrl, categoryId: gd.categoryId || pending.categoryId, isSaved: true } as GeneratedImage;
        await persistImage(completed);
        setImages(prev => prev.map(img => img.id === imageId ? completed : img));
        setIsGenerating(false);
        setGenerationStats(prev => ({ ...prev, successful: prev.successful + 1 }));
        await refreshBootstrap();
        await loadImages(true);
        if (lightboxSubject === subject) await openSubject(subject);
        return;
      }

      if (!gr.ok || !gd.data?.[0]?.task_id) {
        const message = typeof gd.error === 'string'
          ? gd.error
          : gd.error?.message || gd.message || 'Generation failed';
        throw new Error(message);
      }
      const taskId = gd.data[0].task_id;

      const poll = async (): Promise<boolean> => {
        try {
          const qr = await fetch(`/api/query?task_id=${taskId}${activeModel === 'APIKEYFUN' ? '&model=APIKEYFUN' : ''}`);
          const qd = await qr.json(); const td = qd.data;
          if (!td) return false;
          if (td.status === "completed") {
            const url = td.result?.images?.[0]?.url?.[0];
            if (url) {
              const sr = await fetch("/api/save-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: imageId, url, subject }) });
              if (!sr.ok) throw new Error('Image download failed');
              const sd = await sr.json();
              const completed = { ...pending, status: 'completed', url, localUrl: sd.localUrl || '', categoryId: sd.categoryId || pending.categoryId, isSaved: true } as GeneratedImage;
              await persistImage(completed);
              setImages(prev => prev.map(img => img.id === imageId ? completed : img));
              setIsGenerating(false);
              setGenerationStats(prev => ({ ...prev, successful: prev.successful + 1 }));
              await refreshBootstrap();
              await loadImages(true);
              if (lightboxSubject === subject) await openSubject(subject);
              return true;
            }
          } else if (td.status === "failed") {
            const failed = { ...pending, status: 'failed' } as GeneratedImage;
            await persistImage(failed);
            setImages(prev => prev.map(img => img.id === imageId ? failed : img));
            setIsGenerating(false);
            setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            if (groupBySubject) await loadImages(true);
            return true;
          }
          return false;
        } catch { return false; }
      };

      let done = false;
      let pollCount = 0;
      const MAX_POLLS = 60;
      while (!done && pollCount < MAX_POLLS) {
        await new Promise(r => setTimeout(r, 3000));
        done = await poll();
        pollCount++;
      }
      if (!done) {
        const failed = { ...pending, status: 'failed' } as GeneratedImage;
        await persistImage(failed);
        setImages(prev => prev.map(img => img.id === imageId ? failed : img));
        setIsGenerating(false);
        setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
        if (groupBySubject) await loadImages(true);
      }
    } catch (e: any) {
      const failed = { ...pending, status: 'failed' } as GeneratedImage;
      try { await persistImage(failed); } catch {}
      setImages(prev => prev.map(img => img.id === imageId ? failed : img));
      showError(e.message); setIsGenerating(false); setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      if (groupBySubject) await loadImages(true);
    }
  };

  const handleNativeImageDrop = (imageId: string, categoryId: string) => {
    const img = images.find(i => i.id === imageId);
    if (!img) return;
    moveImageToCategory(imageId, img.localUrl, categoryId);
  };

  const handleExport = () => {
    const data = { templates, categories: categories.filter(c => c.id !== 'all' && c.id !== 'uncategorized'), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `wildsalt-export-${new Date().toISOString().slice(0,10)}.json`; a.click();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`flex flex-col h-screen h-full w-full overflow-hidden bg-editorial-950 transition-all duration-700 ${theme === 'light' ? 'invert hue-rotate-180' : ''}`}>

        <AnimatePresence>
          {errorMessage && (
            <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="fixed top-20 left-1/2 z-50 py-3 px-6 bg-red-500/90 text-white rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-2xl flex items-center gap-2">
              <Zap className="w-3 h-3 fill-white" />{errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <Header apiHealth={apiHealth} activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} setTheme={setTheme} onExport={handleExport} />

        <div className="flex-1 flex overflow-hidden">
          {(activeTab === 'workspace' || activeTab === 'assets') && (
            <LeftSidebar
              categories={categories} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
              isAddingCategory={isAddingCategory} setIsAddingCategory={setIsAddingCategory}
              newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
              newCategoryStorageKey={newCategoryStorageKey} setNewCategoryStorageKey={setNewCategoryStorageKey}
              newCategoryIcon={newCategoryIcon} setNewCategoryIcon={setNewCategoryIcon}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              handleAddCategory={handleAddCategory} onNativeImageDrop={handleNativeImageDrop}
              onEditCategory={setEditingCategory}
            />
          )}

          {(activeTab === 'workspace' || activeTab === 'assets') ? (
            <>
              <ImageGrid
                images={images} categories={categories} selectedCategory={selectedCategory}
                searchQuery={searchQuery} showSearch={showSearch} setShowSearch={setShowSearch} setSearchQuery={setSearchQuery}
                selectMode={selectMode} setSelectMode={setSelectMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                onDelete={handleDeleteImage} onGeneratePost={handleGeneratePost} onBatchMove={handleBatchMove} onToggleFlag={handleToggleFlag}
                groupBySubject={groupBySubject} setGroupBySubject={setGroupBySubject} setLightboxSubject={openSubject}
                total={queryTotal}
                hasMore={!!nextCursor} isLoading={isLoadingImages} onLoadMore={() => loadImages(false)}
                onDataChanged={async () => { await refreshBootstrap(); await loadImages(true); }}
              />
              <TemplateLibrary
                showTemplateLibrary={showTemplateLibrary} setShowTemplateLibrary={setShowTemplateLibrary}
                templates={templates} isAddingTemplate={isAddingTemplate} setIsAddingTemplate={setIsAddingTemplate}
                editingTemplate={editingTemplate} setEditingTemplate={setEditingTemplate}
                handleSaveTemplate={handleSaveTemplate} handleDeleteTemplate={handleDeleteTemplate}
                setPromptTemplate={setPromptTemplate}
              />
            </>
          ) : activeTab === 'history' ? (
            <HistoryTab generationStats={generationStats} archivedCount={archivedCount} />
          ) : (
            <ModelsTab activeModel={activeModel} setActiveTab={setActiveTab} onHealthChanged={refreshApiHealth} />
          )}

          {activeTab === 'workspace' && (
            <RightSidebar
              subject={subject} setSubject={setSubject} promptTemplate={promptTemplate} setPromptTemplate={setPromptTemplate}
              templates={templates} activeModel={activeModel} setActiveModel={setActiveModel}
              aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} resolution={resolution} setResolution={setResolution}
              generateImage={generateImage} isGenerating={isGenerating} enhanceLoading={enhanceLoading}
              handleEnhancePrompt={handleEnhancePrompt} setShowTemplateLibrary={setShowTemplateLibrary}
              referenceImages={referenceImages} setReferenceImages={setReferenceImages}
            />
          )}
        </div>

        <footer className="h-8 bg-black border-t border-white/10 flex items-center px-6 justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
          <div className="flex gap-8"><span>Active Session: {sessionTime}</span><span>Images: {totalImages}</span></div>
          <div className="flex gap-6 items-center">
            <span>WildSalt v1.2</span>
          </div>
        </footer>
      </div>

      {lightboxSubject && (
        <SubjectLightbox
          subject={lightboxSubject}
          images={lightboxImages}
          categoryName={(catId) => categories.find(c => c.id === catId)?.name || 'Uncategorized'}
          onDelete={handleDeleteImage}
          onGeneratePost={handleGeneratePost}
          onToggleFlag={handleToggleFlag}
          onClose={() => openSubject(null)}
          isLoading={lightboxLoading}
        />
      )}

      {editingCategory && (
        <CategoryEditor category={editingCategory} onClose={() => setEditingCategory(null)} onSave={handleUpdateCategory} onDelete={handleDeleteCategory} />
      )}

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeId && dragType === 'category' ? (
          <div className="w-64 bg-editorial-900 border border-accent/50 p-3 rounded-lg flex items-center gap-3 text-white"><Layers className="w-4 h-4 text-accent" /><span className="text-[11px] font-bold uppercase">{categories.find(c => c.id === activeId)?.name}</span></div>
        ) : activeId && dragType === 'template' ? (
          <div className="w-64 bg-editorial-900 border border-accent/50 p-3 rounded-lg text-white"><span className="text-[11px] font-bold">{templates.find(t => t.id === activeId)?.name}</span></div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
