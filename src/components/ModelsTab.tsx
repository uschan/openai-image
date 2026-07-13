import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, Save, Trash2, X } from 'lucide-react';

interface ModelsTabProps {
  activeModel: string;
  setActiveTab: (tab: 'workspace' | 'assets' | 'models' | 'history') => void;
  onHealthChanged: () => Promise<void>;
}

interface ProviderConfig {
  provider: 'apimart' | 'apikeyfun' | 'gemini' | 'deepseek';
  baseUrl: string;
  keyConfigured: boolean;
}

const PROVIDER_LABELS: Record<ProviderConfig['provider'], string> = {
  apimart: 'APIMart',
  apikeyfun: 'apikey.fun',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
};

export function ModelsTab({ activeModel, setActiveTab, onHealthChanged }: ModelsTabProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>('load');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const response = await fetch('/api/settings/providers');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load providers.');
      setProviders(data.providers || []);
      setUrls(Object.fromEntries((data.providers || []).map((provider: ProviderConfig) => [provider.provider, provider.baseUrl])));
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Failed to load providers.' });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (provider: ProviderConfig) => {
    setBusy(provider.provider);
    setMessage(null);
    try {
      const apiKey = keys[provider.provider]?.trim();
      const response = await fetch(`/api/settings/providers/${provider.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: urls[provider.provider], ...(apiKey ? { apiKey } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Save failed.');
      setProviders(current => current.map(item => item.provider === provider.provider ? { ...item, baseUrl: data.baseUrl, keyConfigured: data.keyConfigured } : item));
      setUrls(current => ({ ...current, [provider.provider]: data.baseUrl }));
      setKeys(current => ({ ...current, [provider.provider]: '' }));
      setMessage({ kind: 'success', text: `${PROVIDER_LABELS[provider.provider]} saved.` });
      await onHealthChanged();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async (provider: ProviderConfig) => {
    setBusy(provider.provider);
    setMessage(null);
    try {
      const response = await fetch(`/api/settings/providers/${provider.provider}/key`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Key removal failed.');
      setProviders(current => current.map(item => item.provider === provider.provider ? { ...item, keyConfigured: false } : item));
      setKeys(current => ({ ...current, [provider.provider]: '' }));
      setMessage({ kind: 'success', text: `${PROVIDER_LABELS[provider.provider]} key removed.` });
      await onHealthChanged();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Key removal failed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-editorial-800">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-end justify-between border-b border-white/10 pb-6 mb-6">
          <div>
            <span className="label-caps">Local configuration</span>
            <h2 className="text-2xl font-semibold mt-2">Providers</h2>
          </div>
          <button onClick={() => setActiveTab('workspace')} className="text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white">Return to workspace</button>
        </div>

        {message && (
          <div className={`mb-5 px-4 py-3 rounded border text-xs flex items-center gap-2 ${message.kind === 'error' ? 'border-red-500/30 text-red-300 bg-red-500/5' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'}`}>
            {message.kind === 'error' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            {message.text}
          </div>
        )}

        {busy === 'load' ? (
          <div className="h-48 flex items-center justify-center text-white/30"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {providers.map(provider => {
              const isBusy = busy === provider.provider;
              const isActive = (provider.provider === 'apimart' && activeModel.startsWith('GPT-IMAGE')) || (provider.provider === 'apikeyfun' && activeModel === 'APIKEYFUN') || (provider.provider === 'gemini' && activeModel === 'GEMINI');
              return (
                <section key={provider.provider} className={`border rounded-lg p-5 ${isActive ? 'border-accent/35 bg-accent/[0.03]' : 'border-white/10 bg-white/[0.025]'}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <KeyRound className={`w-4 h-4 ${provider.keyConfigured ? 'text-emerald-400' : 'text-white/25'}`} />
                      <h3 className="text-sm font-bold">{PROVIDER_LABELS[provider.provider]}</h3>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${provider.keyConfigured ? 'text-emerald-400' : 'text-white/25'}`}>
                      {provider.keyConfigured ? 'Configured' : 'No key'}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <label className="block space-y-2">
                      <span className="label-caps">Base URL</span>
                      <input value={urls[provider.provider] || ''} onChange={event => setUrls(current => ({ ...current, [provider.provider]: event.target.value }))} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-accent/40" />
                    </label>
                    <label className="block space-y-2">
                      <span className="label-caps">Replacement key</span>
                      <input type="password" autoComplete="new-password" value={keys[provider.provider] || ''} onChange={event => setKeys(current => ({ ...current, [provider.provider]: event.target.value }))} placeholder="Leave blank to keep current key" className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-accent/40" />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/10">
                    {provider.keyConfigured && (
                      <button disabled={Boolean(busy)} onClick={() => removeKey(provider)} className="w-9 h-9 rounded border border-white/10 text-white/35 hover:text-red-400 hover:border-red-400/30 disabled:opacity-30 flex items-center justify-center" title="Remove key"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                    <button disabled={Boolean(busy) || !urls[provider.provider]} onClick={() => save(provider)} className="h-9 px-4 rounded bg-accent text-black text-[10px] font-black uppercase flex items-center gap-2 disabled:opacity-30">
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
