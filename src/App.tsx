import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  History, 
  Layers, 
  Settings2, 
  Download, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Maximize2,
  MoreVertical,
  Plus,
  Send,
  Zap,
  Clock,
  CheckCircle2,
  Loader2,
  Tag,
  GripVertical,
  Save,
  FolderOpen,
  Copy,
  ExternalLink,
  Sun,
  Moon,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Template, GeneratedImage, Category } from './types';
import { SortableCategory } from './components/SortableCategory';
import { ImageCard } from './components/ImageCard';
import { TemplateLibrary } from './components/TemplateLibrary';

export default function App() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', name: 'All Work', count: 0 },
    { id: 'uncategorized', name: 'Uncategorized', count: 0 },
  ]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'category' | 'image' | null>(null);

  const [subject, setSubject] = useState("");
  
  // Library State
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
  const [errorMessage, setErrorMessage] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 5000);
  };

  // Fetch API Health
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => setApiHealth(data.keys || { gemini: false, apimart: false, deepseek: false }))
      .catch(console.error);
  }, []);

  // Synchronize Final Prompt when subject or template changes
  useEffect(() => {
    const synchronized = promptTemplate.replace(/{SUBJECT}/g, subject || "[SUBJECT]");
    setFinalPrompt(synchronized);
  }, [subject, promptTemplate]);

  // Synchronize counts
  useEffect(() => {
    setCategories(prev => prev.map(cat => {
      let count = 0;
      if (cat.id === 'all') {
        count = images.length;
      } else {
        count = images.filter(img => img.categoryId === cat.id || (!img.categoryId && cat.id === 'uncategorized')).length;
      }
      return { ...cat, count };
    }));
  }, [images]);

  // Data Persistence initialization
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/data");
        const data = await res.json();
        if (data.images) {
          const loadedImages = data.images.map((img: any) => ({
            ...img,
            postContent: undefined,
            isGeneratingPost: false
          }));
          setImages(loadedImages);
          // Repair: save any completed image that lacks localUrl
          for (const img of loadedImages) {
            if (img.status === 'completed' && img.url && !img.localUrl) {
              try {
                const saveRes = await fetch("/api/save-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: img.id, url: img.url, subject: img.subject }),
                });
                const saveData = await saveRes.json();
                if (saveData.localUrl) {
                  setImages(prev => prev.map(i => i.id === img.id ? { ...i, localUrl: saveData.localUrl } : i));
                }
              } catch {}
            }
          }
        }
        if (data.categories) {
          const loadedCategories = data.categories as Category[];
          let cats = [...loadedCategories];
          if (!cats.some(c => c.id === 'all')) cats.unshift({ id: 'all', name: 'All Work', count: 0 });
          if (!cats.some(c => c.id === 'uncategorized')) cats.splice(1, 0, { id: 'uncategorized', name: 'Uncategorized', count: 0 });
          setCategories(cats.map(c => c.id === 'uncategorized' && c.name === '未归类' ? { ...c, name: 'Uncategorized' } : c));
        }
        if (data.templates) {
            setTemplates(data.templates);
            if (data.templates.length > 0 && !promptTemplate) {
                setPromptTemplate(data.templates[0].content);
            }
        }
        if (data.stats) {
            setGenerationStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load data from server:", err);
      }
    };
    fetchData();
  }, []);

  // Auto-sync to server on change
  useEffect(() => {
    const syncData = async () => {
      try {
        const imagesToSave = images.map(({ postContent, isGeneratingPost, ...img }) => img);
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: imagesToSave, categories, templates, stats: generationStats })
        });
      } catch (err) {
        console.error("Failed to sync data to server:", err);
      }
    };
    
    // Simple debounce/guard to prevent excessive writes on initial load or count updates
    const timeout = setTimeout(syncData, 1000);
    return () => clearTimeout(timeout);
  }, [images, categories, templates, generationStats]);

  const handleAddCategory = () => {
    if (!newCategoryName) return;
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCategoryName,
      count: 0
    };
    setCategories(prev => [...prev, newCat]);
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const handleGeneratePost = async (id: string, subject: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: true } : img));
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject })
      });
      if (!res.ok) throw new Error("Failed to generate post");
      const data = await res.json();
      setImages(prev => prev.map(img => img.id === id ? { 
        ...img, 
        isGeneratingPost: false,
        postContent: data
      } : img));
    } catch (err) {
      console.error(err);
      setImages(prev => prev.map(img => img.id === id ? { ...img, isGeneratingPost: false } : img));
      showError("Failed to generate post. Please check if DEEPSEEK_API_KEY is configured.");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    if (categories.find(c => c.id === active.id)) {
      setDragType('category');
    } else if (images.find(i => i.id === active.id)) {
      setDragType('image');
    } else if (templates.find(t => t.id === active.id)) {
      setDragType('template');
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Only used to provide visual feedback for image -> category drop
  };

  const moveImageToCategory = async (id: string, localUrl: string | undefined, categoryId: string) => {
    if (!localUrl) return;
    try {
      const res = await fetch("/api/move-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localUrl, categoryId })
      });
      const data = await res.json();
      if (data.localUrl) {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, localUrl: data.localUrl } : img
        ));
      }
    } catch (e) {
      console.error("Move image failed", e);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (dragType === 'category' && over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    if (dragType === 'template' && over && active.id !== over.id) {
      setTemplates((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    if (dragType === 'image' && over) {
      let categoryId = over.data.current?.categoryId;
      if (!categoryId) {
        // Fallback: the over.id might be 'drop-(id)' or just the category ID itself (from useSortable)
        const possibleId = over.id.toString().replace('drop-', '');
        if (categories.find(c => c.id === possibleId)) {
          categoryId = possibleId;
        }
      }
      
      if (categoryId) {
        const img = images.find(i => i.id === active.id);
        setImages(prev => prev.map(i => 
          i.id === active.id ? { ...i, categoryId } : i
        ));
        if (img) {
          moveImageToCategory(img.id, img.localUrl, categoryId);
        }
      }
    }

    setActiveId(null);
    setDragType(null);
  };

  const handleSaveTemplate = (tpl: Partial<Template>) => {
    if (tpl.id) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? ({ ...t, ...tpl } as Template) : t))
      );
    } else {
      const newTpl = {
        id: Math.random().toString(36).substr(2, 9),
        name: tpl.name || "Untitled Template",
        content: tpl.content || "",
        isPinned: tpl.isPinned !== undefined ? tpl.isPinned : true,
      };
      setTemplates((prev) => [...prev, newTpl]);
    }
    setIsAddingTemplate(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEnhancePrompt = async () => {
    if (!subject) return;
    setEnhanceLoading(true);
    try {
      const res = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject })
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSubject(data.text || "");
    } catch (e: any) {
      console.error("Enhance failed", e);
      showError(e.message === "Failed" ? "Prompt enhancement failed (Make sure GEMINI_API_KEY is configured)" : e.message);
    } finally {
      setEnhanceLoading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {

  // Keyboard shortcut: Ctrl+Enter to generate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (subject && !isGenerating) generateImage();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [subject, isGenerating, finalPrompt, activeModel, aspectRatio, resolution]);
    const img = images.find(i => i.id === id);
    setImages(prev => prev.filter(i => i.id !== id));
    if (img?.localUrl) {
      try {
        await fetch("/api/delete-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localUrl: img.localUrl })
        });
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
  };

  const saveImageLocally = async (id: string, url: string, subject: string) => {
    try {
      const res = await fetch("/api/save-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, url, subject })
      });
      const data = await res.json();
      if (data.localUrl) {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, localUrl: data.localUrl } : img
        ));
      }
    } catch (e) {
      console.error("Failed to save image locally", e);
    }
  };

  const generateImage = async () => {
    if (!subject) return;
    setIsGenerating(true);
    setGenerationStats(prev => ({ ...prev, totalAttempts: prev.totalAttempts + 1 }));
    
    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: activeModel,
          size: aspectRatio,
          resolution: resolution
        })
      });
      
      const genData = await genRes.json();
      
      if (!genRes.ok || !genData.data || !genData.data[0]?.task_id) {
        throw new Error(genData.error || "Failed to start generation (Make sure APIMART_API_KEY is configured)");
      }

      const taskId = genData.data[0].task_id;
      const internalId = Math.random().toString(36).substr(2, 9);

      const newImage: GeneratedImage = {
          id: internalId,
          url: "", 
          subject: subject,
          prompt: finalPrompt,
          timestamp: Date.now(),
          status: 'pending',
          isSaved: false,
          categoryId: 'uncategorized',
          metadata: { model: activeModel, ratio: aspectRatio, resolution: resolution }
      };

      setImages(prev => [newImage, ...prev]);

      const poll = async () => {
        try {
          const queryRes = await fetch(`/api/query?task_id=${taskId}`);
          const queryData = await queryRes.json();
          const taskData = queryData.data;
          if (!taskData) return false;
          if (taskData.status === "completed") {
            const url = taskData.result?.images?.[0]?.url?.[0];
            if (url) {
              // Download and save locally, then update state once
              let localUrl = "";
              try {
                const saveRes = await fetch("/api/save-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: internalId, url, subject }),
                });
                const saveData = await saveRes.json();
                localUrl = saveData.localUrl || "";
              } catch (e) { console.error("save-image failed", e); }
              setImages(prev => prev.map(img =>
                img.id === internalId ? { ...img, status: 'completed', url, localUrl } : img
              ));
              setIsGenerating(false);
              setGenerationStats(prev => ({ ...prev, successful: prev.successful + 1 }));
              return true;
            }
          } else if (taskData.status === "failed") {
            setImages(prev => prev.map(img => img.id === internalId ? { ...img, status: 'failed' } : img));
            setIsGenerating(false);
            setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            return true;
          }
          return false;
        } catch (err) { console.error("Poll error:", err); return false; }
      };

      let finished = false;
      while (!finished) {
        await new Promise(r => setTimeout(r, 3000));
        finished = await poll();
      }

    } catch (error: any) {
      console.error("Generation failed:", error);
      showError(error.message || "Synthesis generation failed unexpectedly.");
      setIsGenerating(false);
      setGenerationStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      // Fallback or error state
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex flex-col h-screen h-full w-full overflow-hidden bg-editorial-950 transition-all duration-700 ${theme === 'light' ? 'invert hue-rotate-180' : ''}`}>
      
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-50 py-3 px-6 bg-red-500/90 text-white rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-2xl flex items-center gap-2"
          >
            <Zap className="w-3 h-3 fill-white" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Editorial Header --- */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-editorial-900 z-30">
        <div className="flex items-center gap-10">
          <div className="text-xl font-black tracking-tighter flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
               <path d="M 10 30 L 30 80 L 50 40 L 70 80 L 90 30" />
               <circle cx="50" cy="15" r="8" fill="currentColor" stroke="none" />
            </svg>
            WILDSALT
          </div>
          <nav className="hidden md:flex gap-8 text-xs font-bold uppercase tracking-wider text-white/30">
            {['workspace', 'assets', 'models', 'history'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`h-14 translate-y-[2px] transition-colors ${activeTab === tab ? 'text-white border-b-2 border-accent' : 'hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 mr-4 text-[9px] font-mono uppercase bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <span className={`flex items-center gap-1.5 ${apiHealth.gemini ? 'text-emerald-500' : 'text-red-500 opacity-80'}`} title="Gemini API (Prompt Enhancement)">
              <div className={`w-1.5 h-1.5 rounded-full ${apiHealth.gemini ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} /> Gemini
            </span>
            <span className={`flex items-center gap-1.5 ${apiHealth.apimart ? 'text-emerald-500' : 'text-red-500 opacity-80'}`} title="Apimart API (Image Generation)">
              <div className={`w-1.5 h-1.5 rounded-full ${apiHealth.apimart ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} /> Apimart
            </span>
            <span className={`flex items-center gap-1.5 ${apiHealth.deepseek ? 'text-emerald-500' : 'text-red-500 opacity-80'}`} title="DeepSeek API (Social Post Generation)">
              <div className={`w-1.5 h-1.5 rounded-full ${apiHealth.deepseek ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} /> DeepSeek
            </span>
          </div>
          
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button 
            className="p-2 text-white/40 opacity-50 cursor-not-allowed rounded-full"
            title="Cloud Sync (Coming soon)"
          >
            <Cloud className="w-4 h-4" />
          </button>
          
          <button className="px-5 py-1.5 bg-white text-black text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-neutral-200 transition-colors flex items-center gap-2">
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* --- Left Sidebar: Navigation & Assets --- */}
        {(activeTab === 'workspace' || activeTab === 'assets') && (
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
                  <button 
                    onClick={() => setIsAddingCategory(!isAddingCategory)}
                    className="p-1 hover:bg-white/5 rounded transition-colors text-white/30 hover:text-accent"
                  >
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
                <SortableContext 
                  items={categories.map(c => c.id)} 
                  strategy={verticalListSortingStrategy}
                >
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
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '92%' }}
                      className="h-full bg-accent"
                    />
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
        )}

        {/* --- Main Workspace: Canvas & Gallery --- */}
        {(activeTab === 'workspace' || activeTab === 'assets') ? (
        <main className="flex-1 flex flex-col bg-editorial-800 relative">
          
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8 custom-scrollbar">
            <div className="w-full space-y-12">
              
              {/* Discovery Grid */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                <AnimatePresence mode="popLayout">
                  {images
                    .filter(img => selectedCategory === 'all' || img.categoryId === selectedCategory || (!img.categoryId && selectedCategory === 'uncategorized'))
                    .map((image, idx) => (
                    <ImageCard 
                      key={image.id}
                      image={image}
                      categoryName={categories.find(c => c.id === image.categoryId)?.name}
                      onDelete={handleDeleteImage}
                      onGeneratePost={handleGeneratePost}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {images.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <h2 className="text-5xl font-light serif-italic italic tracking-tight text-white/20">The Canvas is Empty.</h2>
                  <p className="mt-4 label-caps tracking-[0.4em]">Awaiting Visionary Input</p>
                </div>
              )}
            </div>
          </div>

          {/* --- Unified Command Console / Constructor --- */}
          {/* Section removed, moved to sidebar */}

        <TemplateLibrary 
          showTemplateLibrary={showTemplateLibrary}
          setShowTemplateLibrary={setShowTemplateLibrary}
          templates={templates}
          isAddingTemplate={isAddingTemplate}
          setIsAddingTemplate={setIsAddingTemplate}
          editingTemplate={editingTemplate}
          setEditingTemplate={setEditingTemplate}
          handleSaveTemplate={handleSaveTemplate}
          handleDeleteTemplate={handleDeleteTemplate}
          setPromptTemplate={setPromptTemplate}
        />
        </main>
        ) : activeTab === 'history' ? (
          <main className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar bg-editorial-800">
            <div className="max-w-4xl mx-auto space-y-10">
              <div>
                <h2 className="text-3xl font-light serif-italic italic mb-2">History & Pulse</h2>
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Daily Synthesis Statistics</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Attempts", value: generationStats.totalAttempts },
                  { label: "Successful (Consumed)", value: generationStats.successful },
                  { label: "Failed", value: generationStats.failed },
                  { label: "Archived", value: images.filter(i => i.isSaved).length }
                ].map((stat, idx) => (
                  <div key={idx} className="glass p-6 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{stat.label}</span>
                    <span className="text-2xl font-mono text-white group-hover:text-accent transition-colors">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar bg-editorial-800 flex items-center justify-center">
            <div className="max-w-xl w-full space-y-10">
               <div className="text-center">
                  <Zap className="w-10 h-10 text-accent/50 mx-auto mb-6" />
                  <h2 className="text-3xl font-light serif-italic italic mb-2">Architectures</h2>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Neural engines are managed directly in your Workspace panel.</p>
               </div>
               <div className="grid grid-cols-1 gap-4">
                 {['GPT-IMAGE', 'GEMINI (Banana)'].map(m => (
                    <div key={m} className={`p-6 rounded-2xl border flex items-center justify-between ${activeModel === m ? 'border-accent bg-accent/5' : 'border-white/10 bg-white/5'}`}>
                       <span className="font-bold tracking-widest text-sm">{m}</span>
                       {activeModel === m && <span className="text-[9px] px-2 py-1 bg-accent text-black rounded uppercase font-black">Active</span>}
                    </div>
                 ))}
                 <button onClick={() => setActiveTab('workspace')} className="mt-8 text-[11px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors underline underline-offset-8">Return to Workspace</button>
               </div>
            </div>
          </main>
        )}

        {/* --- Right Sidebar: Configuration --- */}
        {activeTab === 'workspace' && (
        <aside className="hidden lg:flex w-80 border-l border-white/10 bg-editorial-850 flex-col overflow-y-auto custom-scrollbar select-none shrink-0">
          <div className="p-8 space-y-10">
            {/* Subject Input */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <label className="label-caps !text-accent">Subject</label>
                <button 
                  onClick={handleEnhancePrompt}
                  disabled={!subject || enhanceLoading}
                  className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-accent flex items-center gap-1.5 transition-colors disabled:opacity-10"
                >
                  {enhanceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Refine
                </button>
              </div>
              <input 
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Ghost Mantis..."
                className="w-full bg-editorial-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-accent/40 focus:ring-0 transition-all placeholder:text-white/10"
              />
            </section>

            {/* Template Input */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <label className="label-caps">Prompt Template</label>
                <button 
                  onClick={() => setShowTemplateLibrary(true)}
                  className="text-[9px] font-black text-accent/60 hover:text-accent transition-colors uppercase tracking-widest"
                >
                  Manage
                </button>
              </div>
              <textarea
                rows={4}
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                placeholder="Use {SUBJECT} variable..."
                className="w-full bg-editorial-900/50 border border-white/5 rounded-xl p-3 text-xs font-mono text-white/60 focus:border-accent/20 focus:ring-0 resize-y min-h-[4rem] max-h-64 transition-shadow custom-scrollbar"
              />
            </section>

            {/* Realized Preview */}
            <section>
              <label className="label-caps mb-4 block">Realized Prompt</label>
              <div className="w-full bg-black/20 rounded-xl p-4 text-[11px] font-medium leading-relaxed italic text-white/30 border border-white/5 max-h-24 overflow-y-auto custom-scrollbar">
                {finalPrompt || <span className="opacity-50">Empty...</span>}
              </div>
            </section>

            {/* Quick Prompt Templates (draggable) */}
            <section>
              <label className="label-caps mb-4 block">Quick Templates</label>
              <div className="flex flex-col gap-2">
              {templates.filter(t => t.isPinned !== false).length === 0 ? (
                <div className="text-[10px] text-white/30 text-center py-4 bg-white/[0.02] rounded-lg border border-white/5">
                  No pinned templates. Manage templates to add quick blueprints.
                </div>
              ) : (
                <SortableContext items={templates.filter(t => t.isPinned !== false).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {templates.filter(t => t.isPinned !== false).map(tpl => (
                    <SortableTemplateButton key={tpl.id} tpl={tpl} onClick={() => setPromptTemplate(tpl.content)} />
                  ))}
                </SortableContext>
              )}
              </div>
            </section>

            {/* Configuration Options */}
            <button
                onClick={generateImage}
                disabled={!subject}
                className="w-full py-4 bg-accent text-editorial-950 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] hover:scale-[0.98] active:scale-95 transition-all shadow-[0_0_40px_rgba(0,240,255,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <div className="flex items-center justify-center gap-3">
                    Synthesize Output
                    <Zap className="w-4 h-4 fill-editorial-950" />
                </div>
            </button>

            {/* Model Architecture */}
            <section>
              <label className="label-caps mb-4 block">Engine Architecture</label>
              <select 
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full bg-editorial-900/50 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black text-white/80 uppercase tracking-widest outline-none focus:border-accent/40 cursor-pointer"
              >
                <option value="GPT-IMAGE">GPT-IMAGE</option>
                <option value="GEMINI">GEMINI (Banana)</option>
              </select>
            </section>

            {/* Dimensions & Quality */}
            <div className="grid grid-cols-2 gap-4">
                <section>
                    <label className="label-caps mb-4 block">Format</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['1:1', '4:3', '3:4', '16:9', '9:16', '4:5', '2:3', '3:2'].map(ratio => (
                        <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                            aspectRatio === ratio 
                                ? 'border-accent bg-accent/5 text-accent font-black' 
                                : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white'
                            }`}
                        >
                            <span className="text-[8px] uppercase">{ratio}</span>
                        </button>
                        ))}
                    </div>
                </section>
                <section>
                    <label className="label-caps mb-4 block">Resolution</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['1k', '2k', '4k'].map(res => (
                        <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                            resolution === res 
                                ? 'border-white bg-white text-editorial-950 font-black' 
                                : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white'
                            }`}
                        >
                            <span className="text-[8px] uppercase">{res}</span>
                        </button>
                        ))}
                    </div>
                </section>
            </div>
          </div>
        </aside>
        )}
      </div>

      {/* --- Footer Status Bar --- */}
      <footer className="h-8 bg-black border-t border-white/10 flex items-center px-6 justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
        <div className="flex gap-8">
          <span>Active Session: 01:22:45</span>
          <span>Buffer Health: 100%</span>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse" />
            Synchronized
          </div>
          <span>WildSalt v1.0-beta</span>
        </div>
      </footer>

      <style>{`
        textarea:focus { border: none; box-shadow: none; outline: none; }
      `}</style>
    </div>

      <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
        {activeId && dragType === 'category' ? (
          <div className="w-64 bg-editorial-900 border border-accent/50 p-3 rounded-lg flex items-center gap-3 text-white">
            <Layers className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-bold uppercase">{categories.find(c => c.id === activeId)?.name}</span>
          </div>
        ) : activeId && dragType === 'image' ? (
          <div className="w-48 aspect-[3/4] bg-editorial-900 border border-accent/50 rounded-xl flex items-center justify-center">
             <ImageIcon className="w-8 h-8 text-accent/30" />
          </div>
        ) : activeId && dragType === 'template' ? (
          <div className="w-64 bg-editorial-900 border border-accent/50 p-3 rounded-lg text-white">
            <span className="text-[11px] font-bold">{templates.find(t => t.id === activeId)?.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableTemplateButton({ tpl, onClick }: { tpl: Template; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: tpl.id });
  const style = { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-1.5">
      <button {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/50 flex-shrink-0">
        <GripVertical className="w-3 h-3" />
      </button>
      <button onClick={onClick} className="flex-1 px-3 py-2.5 bg-white/[0.03] rounded-lg text-left border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all group">
        <div className="text-[10px] font-bold text-white/70 group-hover:text-accent mb-1">{tpl.name}</div>
        <div className="text-[9px] text-white/30 truncate">{tpl.content}</div>
      </button>
    </div>
  );
}

