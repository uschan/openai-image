import { motion } from 'motion/react';
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
  showTemplateLibrary, setShowTemplateLibrary, templates,
  isAddingTemplate, setIsAddingTemplate, editingTemplate, setEditingTemplate,
  handleSaveTemplate, handleDeleteTemplate, setPromptTemplate
}: TemplateLibraryProps) {
  if (!showTemplateLibrary) return null;

  const active = editingTemplate || (isAddingTemplate ? { id: '', name: '', content: '', isPinned: true } as Template : null);

  const saveActive = () => {
    const name = (document.getElementById('tpl_name') as HTMLInputElement).value;
    const content = (document.getElementById('tpl_content') as HTMLTextAreaElement).value;
    handleSaveTemplate({ id: editingTemplate?.id, name, content });
  };

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
        className="glass-dark w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-light serif-italic italic mb-1">Prompt 模板管理</h2>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Select, Create or Edit creative blueprints</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setIsAddingTemplate(true)}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-editorial-950 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" /> 新建模板
            </button>
            <button onClick={() => setShowTemplateLibrary(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Template List */}
          <div className="w-3/5 overflow-y-auto p-6 custom-scrollbar bg-editorial-900/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(tpl => (
                <div key={tpl.id}
                  className={`p-4 bg-white/[0.02] border rounded-2xl group transition-all cursor-pointer flex flex-col gap-3 ${editingTemplate?.id === tpl.id ? 'border-accent/40' : 'border-white/5 hover:border-accent/20'}`}
                  onClick={() => setEditingTemplate(tpl)}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold uppercase tracking-wider truncate flex-1">{tpl.name}</h4>
                    {tpl.isPinned !== false && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-black uppercase">Pin</span>}
                  </div>
                  <div className="bg-editorial-950/50 p-3 rounded-xl text-[10px] font-mono text-white/40 leading-relaxed border border-white/5 whitespace-pre-wrap line-clamp-4">
                    {tpl.content}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={(e) => { e.stopPropagation(); setPromptTemplate(tpl.content); setShowTemplateLibrary(false); }}
                      className="flex-1 py-2 bg-accent text-editorial-950 text-[9px] font-black rounded-lg uppercase tracking-widest hover:scale-[0.98] transition-all">Load</button>
                    <button onClick={(e) => { e.stopPropagation(); handleSaveTemplate({ ...tpl, isPinned: tpl.isPinned === false ? true : false }); }}
                      className={`flex-1 py-2 text-[9px] font-black rounded-lg uppercase tracking-widest transition-all ${tpl.isPinned !== false ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60'}`}>
                      {tpl.isPinned !== false ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                      className="px-3 text-white/20 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="w-2/5 border-l border-white/5 p-6 flex flex-col overflow-y-auto custom-scrollbar">
            {active ? (
              <div className="flex-1 flex flex-col space-y-5">
                <section>
                  <label className="label-caps mb-2 block">Template Name</label>
                  <input
                    type="text" id="tpl_name" defaultValue={active.name}
                    placeholder="Template name..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-accent/40 focus:ring-0"
                  />
                </section>
                <section className="flex-1 flex flex-col">
                  <label className="label-caps mb-2 block">Prompt Content</label>
                  <textarea
                    id="tpl_content" defaultValue={active.content}
                    placeholder="Include {SUBJECT} variable..."
                    className="flex-1 w-full bg-black/30 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/60 focus:border-accent/40 focus:ring-0 resize-none custom-scrollbar min-h-[300px]"
                  />
                </section>
                <div className="flex gap-3">
                  <button onClick={saveActive}
                    className="flex-1 py-3 bg-white text-editorial-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-colors">
                    Save
                  </button>
                  <button onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold text-white/40 hover:text-white/70">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/20 text-xs">
                Select a template to edit, or create a new one
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
