import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import type { Template } from '../types';

interface TemplateLibraryProps {
  showTemplateLibrary: boolean;
  setShowTemplateLibrary: (show: boolean) => void;
  templates: Template[];
  isAddingTemplate: boolean;
  setIsAddingTemplate: (isAdding: boolean) => void;
  editingTemplate: Template | null;
  setEditingTemplate: (template: Template | null) => void;
  handleSaveTemplate: (tpl: Partial<Template>) => void;
  handleDeleteTemplate: (id: string) => void;
  setPromptTemplate: (content: string) => void;
}

export function TemplateLibrary({
  showTemplateLibrary,
  setShowTemplateLibrary,
  templates,
  isAddingTemplate,
  setIsAddingTemplate,
  editingTemplate,
  setEditingTemplate,
  handleSaveTemplate,
  handleDeleteTemplate,
  setPromptTemplate
}: TemplateLibraryProps) {
  if (!showTemplateLibrary) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={() => setShowTemplateLibrary(false)}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass-dark w-full max-w-4xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-light serif-italic italic mb-1">Prompt 模板管理</h2>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Select, Create or Edit creative blueprints</p>
          </div>
          <div className="flex gap-4">
            <button 
                 onClick={() => setIsAddingTemplate(true)}
                 className="flex items-center gap-2 px-5 py-2 bg-accent text-editorial-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-95 transition-all"
            >
                <Plus className="w-3 h-3" />
                新建模板
            </button>
            <button onClick={() => setShowTemplateLibrary(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
                <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6 bg-editorial-900/30">
          <AnimatePresence>
            {(isAddingTemplate || editingTemplate) && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="p-8 bg-editorial-950/50 border border-accent/20 rounded-2xl space-y-6 shadow-2xl"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section>
                            <label className="label-caps mb-3 block">Template Name</label>
                            <input 
                                type="text"
                                placeholder="Naming your style..."
                                defaultValue={editingTemplate?.name || ""}
                                id="tpl_name"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent/40 focus:ring-0"
                            />
                        </section>
                        <section>
                            <label className="label-caps mb-3 block">Editor Actions</label>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        const name = (document.getElementById('tpl_name') as HTMLInputElement).value;
                                        const content = (document.getElementById('tpl_content') as HTMLTextAreaElement).value;
                                        handleSaveTemplate({ id: editingTemplate?.id, name, content });
                                    }}
                                    className="flex-1 py-3 bg-white text-editorial-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-colors"
                                >
                                    Save Blueprint
                                </button>
                                <button 
                                    onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }}
                                    className="px-6 py-3 border border-white/10 rounded-xl text-[10px] font-bold text-white/40"
                                >
                                    Cancel
                                </button>
                            </div>
                        </section>
                    </div>
                    <section>
                        <label className="label-caps mb-3 block">Prompt Workflow</label>
                        <textarea
                            id="tpl_content"
                            rows={4}
                            defaultValue={editingTemplate?.content || ""}
                            placeholder="Include {SUBJECT} to map context..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono focus:border-accent/40 focus:ring-0 resize-none custom-scrollbar"
                        />
                    </section>
                </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-accent/40 transition-all flex flex-col gap-6">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                   <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-mono text-white/30">#{tpl.id}</span>
                   <h4 className="text-sm font-bold uppercase tracking-widest truncate">{tpl.name}</h4>
                   {tpl.isPinned !== false && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-auto">Pinned</span>}
                </div>
                <div className="bg-editorial-950/50 p-4 rounded-xl text-xs font-mono text-white/40 leading-relaxed border border-white/5 flex-1 whitespace-pre-wrap overflow-y-auto max-h-32 custom-scrollbar">
                  {tpl.content}
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-auto">
                <button 
                  onClick={() => {
                    setPromptTemplate(tpl.content);
                    setShowTemplateLibrary(false);
                  }}
                  className="flex-1 py-2 bg-accent text-editorial-950 text-[9px] font-black rounded-lg uppercase tracking-widest transition-all hover:scale-[0.98]"
                >
                  Load
                </button>
                <button 
                  onClick={() => handleSaveTemplate({ ...tpl, isPinned: tpl.isPinned === false ? true : false })}
                  className={`flex-1 py-2 text-[9px] font-black rounded-lg uppercase tracking-widest transition-all ${tpl.isPinned !== false ? "bg-white/20 text-white" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                >
                  {tpl.isPinned !== false ? "Unpin" : "Pin"}
                </button>
                <button 
                  onClick={() => setEditingTemplate(tpl)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black rounded-lg uppercase tracking-widest transition-all"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="px-3 text-white/20 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
