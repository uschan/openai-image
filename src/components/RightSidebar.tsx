import React, { useRef } from 'react';
import { Sparkles, Loader2, Zap, GripVertical, ImagePlus, X } from 'lucide-react';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Template } from '../types';

interface RightSidebarProps {
  subject: string;
  setSubject: (v: string) => void;
  promptTemplate: string;
  setPromptTemplate: (v: string) => void;
  templates: Template[];
  activeModel: string;
  setActiveModel: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  resolution: string;
  setResolution: (v: string) => void;
  generateImage: () => void;
  isGenerating: boolean;
  enhanceLoading: boolean;
  handleEnhancePrompt: () => void;
  setShowTemplateLibrary: (v: boolean) => void;
  referenceImages: string[];
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>;
}

export function RightSidebar({
  subject, setSubject, promptTemplate, setPromptTemplate,
  templates, activeModel, setActiveModel, aspectRatio, setAspectRatio,
  resolution, setResolution, generateImage, isGenerating, enhanceLoading,
  handleEnhancePrompt, setShowTemplateLibrary, referenceImages, setReferenceImages,
}: RightSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of files) {
      if (referenceImages.length >= 16) break;
      const reader = new FileReader();
      reader.onload = () => setReferenceImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of e.dataTransfer.files) {
      if (referenceImages.length >= 16) break;
      const reader = new FileReader();
      reader.onload = () => setReferenceImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    }
  };

  return (
    <aside className="hidden lg:flex w-80 border-l border-white/10 bg-editorial-850 flex-col overflow-y-auto custom-scrollbar select-none shrink-0">
      <div className="p-8 space-y-10">
        {/* Subject */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <label className="label-caps !text-accent">Subject</label>
            <button
              onClick={handleEnhancePrompt}
              disabled={!subject || enhanceLoading}
              className="text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-accent flex items-center gap-1.5 transition-colors disabled:opacity-10"
            >
              {enhanceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Refine
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

        {/* Reference Images */}
        <section>
          <label className="label-caps mb-4 block">Reference Images</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-dashed border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-accent/30 transition-colors"
          >
            <ImagePlus className="w-5 h-5 text-white/20 mx-auto mb-1" />
            <span className="text-[10px] text-white/20">Drop or click to upload ({referenceImages.length}/16)</span>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addImage} />
          </div>
          {referenceImages.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {referenceImages.map((img, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 group">
                  <img src={img} alt={`ref-${i}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Template */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <label className="label-caps">Prompt Template</label>
            <button onClick={() => setShowTemplateLibrary(true)} className="text-[9px] font-black text-accent/60 hover:text-accent transition-colors uppercase tracking-widest">Manage</button>
          </div>
          <textarea
            rows={4}
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Use {SUBJECT} variable..."
            className="template-textarea w-full bg-editorial-900/50 border border-white/5 rounded-xl p-3 text-xs font-mono text-white/60 focus:border-accent/20 focus:ring-0 resize-y min-h-[4rem] max-h-64 transition-shadow custom-scrollbar"
          />
        </section>

        {/* Quick Templates */}
        <section>
          <label className="label-caps mb-4 block">Quick Templates</label>
          <div className="flex flex-col gap-2">
            {templates.filter(t => t.isPinned !== false).length === 0 ? (
              <div className="text-[10px] text-white/30 text-center py-4 bg-white/[0.02] rounded-lg border border-white/5">
                No pinned templates. Manage templates to add quick blueprints.
              </div>
            ) : (
              <SortableContext items={templates.filter(t => t.isPinned !== false).map(t => t.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-2">
                  {templates.filter(t => t.isPinned !== false).map(tpl => (
                    <div key={tpl.id}>
                      <SortableTemplateBtn tpl={tpl} onClick={() => setPromptTemplate(tpl.content)} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </section>

        {/* Generate */}
        <button
          onClick={generateImage}
          disabled={!subject}
          className="w-full py-4 bg-accent text-editorial-950 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] hover:scale-[0.98] active:scale-95 transition-all shadow-[0_0_40px_rgba(0,240,255,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-center gap-3">Synthesize Output <Zap className="w-4 h-4 fill-editorial-950" /></div>
        </button>

        {/* Model */}
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

        {/* Format & Resolution */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <label className="label-caps mb-4 block">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {['1:1', '4:3', '3:4', '16:9', '9:16', '4:5', '2:3', '3:2'].map(ratio => (
                <button key={ratio} onClick={() => setAspectRatio(ratio)}
                  className={`h-10 rounded-lg border flex items-center justify-center transition-all ${aspectRatio === ratio ? 'border-accent bg-accent/5 text-accent font-black' : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white'}`}>
                  <span className="text-[8px] uppercase">{ratio}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <label className="label-caps mb-4 block">Resolution</label>
            <div className="grid grid-cols-2 gap-2">
              {['1k', '2k', '4k'].map(res => (
                <button key={res} onClick={() => setResolution(res)}
                  className={`h-10 rounded-lg border flex items-center justify-center transition-all ${resolution === res ? 'border-white bg-white text-editorial-950 font-black' : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white'}`}>
                  <span className="text-[8px] uppercase">{res}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}

function SortableTemplateBtn({ tpl, onClick }: { tpl: Template; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: tpl.id });
  const style = { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };
  return (
    <div ref={setNodeRef} style={style} {...attributes} onClick={onClick} className="px-2 py-2 bg-white/[0.03] rounded-lg text-left border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all group cursor-pointer flex items-center gap-1.5 overflow-hidden">
      <button {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab active:cursor-grabbing text-white/20 group-hover:text-white/40 flex-shrink-0">
        <GripVertical className="w-2.5 h-2.5" />
      </button>
      <div className="min-w-0">
        <div className="text-[9px] font-bold text-white/70 group-hover:text-accent truncate">{tpl.name}</div>
        <div className="text-[8px] text-white/30 truncate">{tpl.content.slice(0, 30)}</div>
      </div>
    </div>
  );
}
