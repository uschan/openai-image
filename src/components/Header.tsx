import { Sun, Moon, Cloud, Download, Zap } from 'lucide-react';

interface HeaderProps {
  apiHealth: { gemini: boolean; apimart: boolean; deepseek: boolean };
  activeTab: string;
  setActiveTab: (tab: 'workspace' | 'assets' | 'models' | 'history') => void;
  theme: string;
  setTheme: (t: 'dark' | 'light') => void;
  onExport: () => void;
}

export function Header({ apiHealth, activeTab, setActiveTab, theme, setTheme, onExport }: HeaderProps) {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-editorial-900 z-30">
      <div className="flex items-center gap-10">
        <div className="text-xl font-black tracking-tighter flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 10 30 L 30 80 L 50 40 L 70 80 L 90 30" />
            <circle cx="50" cy="15" r="8" fill="currentColor" stroke="none" />
          </svg>
          野盐の物语
        </div>
        <nav className="hidden md:flex gap-8 text-xs font-bold uppercase tracking-wider text-white/30">
          {(['workspace', 'assets', 'models', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-14 translate-y-[2px] transition-colors ${activeTab === tab ? 'text-white border-b-2 border-accent' : 'hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-3 mr-4 text-[9px] font-mono uppercase bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
          <Indicator label="Gemini" ok={apiHealth.gemini} />
          <Indicator label="Apimart" ok={apiHealth.apimart} />
          <Indicator label="DeepSeek" ok={apiHealth.deepseek} />
        </div>

        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/5" title="Toggle theme">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="p-2 text-white/40 opacity-50 cursor-not-allowed rounded-full" title="Cloud Sync (Coming soon)">
          <Cloud className="w-4 h-4" />
        </button>
        <button onClick={onExport} className="px-5 py-1.5 bg-white text-black text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-neutral-200 transition-colors flex items-center gap-2">
          <Download className="w-3 h-3" /> Export
        </button>
      </div>
    </header>
  );
}

function Indicator({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-500' : 'text-red-500 opacity-80'}`} title={`${label} API`}>
      <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} /> {label}
    </span>
  );
}
