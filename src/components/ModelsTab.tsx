import { Zap } from 'lucide-react';

interface ModelsTabProps {
  activeModel: string;
  setActiveTab: (tab: 'workspace' | 'assets' | 'models' | 'history') => void;
}

export function ModelsTab({ activeModel, setActiveTab }: ModelsTabProps) {
  return (
    <main className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar bg-editorial-800 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-10">
        <div className="text-center">
          <Zap className="w-10 h-10 text-accent/50 mx-auto mb-6" />
          <h2 className="text-3xl font-light serif-italic italic mb-2">Architectures</h2>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Neural engines are managed directly in your Workspace panel.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {['GPT-IMAGE', 'GPT-IMAGE-OFFICIAL', 'APIKEYFUN', 'GEMINI'].map(m => (
            <div key={m} className={`p-6 rounded-2xl border flex items-center justify-between ${activeModel === m ? 'border-accent bg-accent/5' : 'border-white/10 bg-white/5'}`}>
              <span className="font-bold tracking-widest text-sm">{m}</span>
              {activeModel === m && <span className="text-[9px] px-2 py-1 bg-accent text-black rounded uppercase font-black">Active</span>}
            </div>
          ))}
          <button onClick={() => setActiveTab('workspace')} className="mt-8 text-[11px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors underline underline-offset-8">Return to Workspace</button>
        </div>
      </div>
    </main>
  );
}
