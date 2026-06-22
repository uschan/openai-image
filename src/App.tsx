import { useState, useEffect } from 'react';
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

export default function App() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', name: 'All Work', count: 0 },
    { id: 'uncategorized', name: 'Uncategorized', count: 0 },
  ]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("Layers");
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apiHealth, setApiHealth] = useState({ gemini: false, apimart: false, deepseek: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [groupBySubject, setGroupBySubject] = useState(true);
  const [lightboxSubject, setLightboxSubject] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
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

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(d => setApiHealth(d.keys || { gemini: false, apimart: false, deepseek: false })).catch(() => {});
  }, []);

  useEffect(() => {
    setFinalPrompt(promptTemplate.replace(/{SUBJECT}/g, subject || "[SUBJECT]"));
  }, [subject, promptTemplate]);

  useEffect(() => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      count: cat.id === 'all' ? images.length : images.filter(img => img.categoryId === cat.id || (!img.categoryId && cat.id === 'uncategorized')).length,
    })));
  }, [images]);

  useEffect(() => { // load from server
    (async () => {
      try {
        const r = await fetch("/api/data"); const d = await r.json();
        if (d.images) {
          const loaded = d.images.map((img: any) => {
            // Auto-fail pending images older than 10 minutes
            if (img.status === 'pending' && img.timestamp && Date.now() - img.timestamp > 600000) {
              return { ...img, status: 'failed', postContent: undefined, isGeneratingPost: false };
            }
            return { ...img, postContent: undefined, isGeneratingPost: false };
          });
          setImages(loaded);
          for (const img of loaded) {
            if (img.status === 'completed' && img.url && !img.localUrl) {
              try {
                const sr = await fetch("/api/save-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: img.id, url: img.url, subject: img.subject }) });
                const sd = await sr.json();
                if (sd.localUrl) setImages(prev => prev.map(i => i.id === img.id ? { ...i, localUrl: sd.localUrl, isSaved: true } : i));
              } catch {}
            }
          }
        }
        if (d.categories) {
          let cats = [...d.categories];
          if (!cats.some(c => c.id === 'all')) cats.unshift({ id: 'all', name: 'All Work', count: 0 });
          if (!cats.some(c => c.id === 'uncategorized')) cats.splice(1, 0, { id: 'uncategorized', name: 'Uncategorized', count: 0 });
          setCategories(cats.map(c => c.id === 'uncategorized' && c.name === '未归类' ? { ...c, name: 'Uncategorized' } : c));
        }
        if (d.templates) { setTemplates(d.templates); if (d.templates.length > 0 && !promptTemplate) setPromptTemplate(d.templates[0].content); }
        if (d.stats) setGenerationStats(d.stats);
      } catch {}
    })();
  }, []);

  useEffect(() => { // sync to server
    const t = setTimeout(async () => {
      const imgs = images.map(({ postContent, isGeneratingPost, ...img }) => img);
      await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: imgs, categories, templates, stats: generationStats }) });
    }, 3000);
    return () => clearTimeout(t);
  }, [images, categories, templates, generationStats]);

  useEffect(() => { // keyboard shortcuts
    const h = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowSearch(p => !p); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (subject && !isGenerating) generateImage(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [subject, isGenerating, finalPrompt, activeModel, aspectRatio, resolution]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddCategory = () => {
    if (!newCategoryName) return;
    setCategories(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), name: newCategoryName, count: 0, icon: newCategoryIcon }]);
    setNewCategoryName(""); setNewCategoryIcon("Layers"); setIsAddingCategory(false);
  };

  const handleGeneratePost = async (id: string, subject: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: true } : img));
    try {
      const r = await fetch("/api/generate-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false, postContent: d } : img));
    } catch { setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false } : img)); showError("Post generation failed."); }
  };

  const handleDeleteImage = async (id: string) => {
    const img = images.find(i => i.id === id);
    setImages(prev => prev.filter(i => i.id !== id));
    if (img?.localUrl) {
      try { await fetch("/api/delete-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ localUrl: img.localUrl }) }); } catch (e) { console.error('Delete file failed:', e); }
    }
  };

  const handleBatchMove = (id: string, categoryId: string, localUrl: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, categoryId, localUrl } : i));
  };

  const handleToggleFlag = (id: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, flagged: !i.flagged } : i));
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
    if (!localUrl) return;
    try {
      const r = await fetch("/api/move-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ localUrl, categoryId }) });
      const d = await r.json();
      if (d.localUrl) setImages(prev => prev.map(img => img.id === id ? { ...img, localUrl: d.localUrl } : img));
    } catch {}
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    if (categories.find(c => c.id === e.active.id)) setDragType('category');
    else if (templates.find(t => t.id === e.active.id)) setDragType('template');
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (dragType === 'category' && over && active.id !== over.id) {
      setCategories(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
    }
    if (dragType === 'template' && over && active.id !== over.id) {
      setTemplates(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
    }
    setActiveId(null); setDragType(null);
  };

  const generateImage = async () => {
    if (!subject) return;
    setIsGenerating(true);
    setGenerationStats(prev => ({ ...prev, totalAttempts: prev.totalAttempts + 1 }));
    try {
      // Create pending card immediately for visual feedback
      const internalId = Math.random().toString(36).slice(2, 11);
      if (activeModel === "APIKEYFUN") {
        setImages(prev => [{ id: internalId, url: "", subject, prompt: finalPrompt, timestamp: Date.now(), status: 'pending', isSaved: false, categoryId: 'uncategorized', metadata: { model: activeModel, ratio: aspectRatio, resolution } } as GeneratedImage, ...prev]);
      }

      const gr = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: finalPrompt, model: activeModel, size: aspectRatio, resolution, image_urls: referenceImages }) });
      const gd = await gr.json();

      // apikey.fun SSE completed — update pending card
      if (gd.provider === "apikeyfun" && gd.localUrl) {
        setImages(prev => prev.map(img => img.id === internalId ? { ...img, status: 'completed', localUrl: gd.localUrl, isSaved: true } : img));
        setIsGenerating(false);
        setGenerationStats(prev => ({ ...prev, successful: prev.successful + 1 }));
        return;
      }

      if (!gr.ok || !gd.data?.[0]?.task_id) throw new Error(gd.error || "Generation failed");
      const taskId = gd.data[0].task_id;
      const imgId = Math.random().toString(36).slice(2, 11);
      setImages(prev => [{ id: imgId, url: "", subject, prompt: finalPrompt, timestamp: Date.now(), status: 'pending', isSaved: false, categoryId: 'uncategorized', metadata: { model: activeModel, ratio: aspectRatio, resolution } } as GeneratedImage, ...prev]);

      const poll = async (): Promise<boolean> => {
        try {
          const qr = await fetch(`/api/query?task_id=${taskId}${activeModel === 'APIKEYFUN' ? '&model=APIKEYFUN' : ''}`);
          const qd = await qr.json(); const td = qd.data;
          if (!td) return false;
          if (td.status === "completed") {
            const url = td.result?.images?.[0]?.url?.[0];
            if (url) {
              let localUrl = "";
              try { const sr = await fetch("/api/save-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: imgId, url, subject }) }); const sd = await sr.json(); localUrl = sd.localUrl || ""; } catch {}
              setImages(prev => prev.map(img => img.id === imgId ? { ...img, status: 'completed', url, localUrl, isSaved: true } : img));
              setIsGenerating(false);
              setGenerationStats(prev => ({ ...prev, successful: prev.successful + 1 }));
              return true;
            }
          } else if (td.status === "failed") {
            setImages(prev => prev.map(img => img.id === imgId ? { ...img, status: 'failed' } : img));
            setIsGenerating(false);
            setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
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
        setImages(prev => prev.map(img => img.id === imgId ? { ...img, status: 'failed' } : img));
        setIsGenerating(false);
        setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      }
    } catch (e: any) { showError(e.message); setIsGenerating(false); setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 })); }
  };

  const handleNativeImageDrop = (imageId: string, categoryId: string) => {
    const img = images.find(i => i.id === imageId);
    if (!img) return;
    setImages(prev => prev.map(i => i.id === imageId ? { ...i, categoryId } : i));
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
              newCategoryIcon={newCategoryIcon} setNewCategoryIcon={setNewCategoryIcon}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              handleAddCategory={handleAddCategory} onNativeImageDrop={handleNativeImageDrop}
            />
          )}

          {(activeTab === 'workspace' || activeTab === 'assets') ? (
            <>
              <ImageGrid
                images={images} categories={categories} selectedCategory={selectedCategory}
                searchQuery={searchQuery} showSearch={showSearch} setShowSearch={setShowSearch} setSearchQuery={setSearchQuery}
                selectMode={selectMode} setSelectMode={setSelectMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                onDelete={handleDeleteImage} onGeneratePost={handleGeneratePost} onBatchMove={handleBatchMove} onToggleFlag={handleToggleFlag}
                groupBySubject={groupBySubject} setGroupBySubject={setGroupBySubject} setLightboxSubject={setLightboxSubject}
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
            <HistoryTab generationStats={generationStats} images={images} />
          ) : (
            <ModelsTab activeModel={activeModel} setActiveTab={setActiveTab} />
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
          <div className="flex gap-8"><span>Active Session: {sessionTime}</span><span>Images: {images.length}</span></div>
          <div className="flex gap-6 items-center">
            <span>WildSalt v1.2</span>
          </div>
        </footer>
      </div>

      {lightboxSubject && (
        <SubjectLightbox
          subject={lightboxSubject}
          images={images.filter(i => i.subject === lightboxSubject)}
          categoryName={(catId) => categories.find(c => c.id === catId)?.name || 'Uncategorized'}
          onDelete={handleDeleteImage}
          onGeneratePost={handleGeneratePost}
          onToggleFlag={handleToggleFlag}
          onClose={() => setLightboxSubject(null)}
        />
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
