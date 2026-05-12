import type { GeneratedImage } from '../types';

interface HistoryTabProps {
  generationStats: { totalAttempts: number; successful: number; failed: number };
  images: GeneratedImage[];
}

export function HistoryTab({ generationStats, images }: HistoryTabProps) {
  return (
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
            { label: "Archived", value: images.filter(i => i.isSaved).length },
          ].map((stat, idx) => (
            <div key={idx} className="glass p-6 rounded-2xl flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{stat.label}</span>
              <span className="text-2xl font-mono text-white group-hover:text-accent transition-colors">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
