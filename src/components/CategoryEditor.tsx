import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Category } from '../types';
import { CATEGORY_ICON_OPTIONS } from '../category-icons';

interface CategoryEditorProps {
  category: Category;
  onClose: () => void;
  onSave: (category: Category, changes: { name: string; storageKey: string; icon: string }) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
}

export function CategoryEditor({ category, onClose, onSave, onDelete }: CategoryEditorProps) {
  const [name, setName] = useState(category.name);
  const [storageKey, setStorageKey] = useState(category.storageKey || '');
  const [icon, setIcon] = useState(category.icon || 'Layers');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(category.name);
    setStorageKey(category.storageKey || '');
    setIcon(category.icon || 'Layers');
    setError('');
  }, [category]);

  const submit = async () => {
    if (!name.trim() || !storageKey.trim()) return setError('Name and storage key are required.');
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(storageKey)) return setError('Storage key must use lowercase ASCII letters, numbers, - or _.');
    setSaving(true);
    setError('');
    try {
      await onSave(category, { name: name.trim(), storageKey, icon });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      await onDelete(category);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-editorial-850 border border-white/15 rounded-lg shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <div className="h-14 px-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-bold">Edit category</h2>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          <label className="block space-y-2">
            <span className="label-caps">Display name</span>
            <input value={name} onChange={event => setName(event.target.value)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent/50 outline-none" />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">ASCII storage key</span>
            <input value={storageKey} onChange={event => setStorageKey(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:border-accent/50 outline-none" />
          </label>
          <div className="space-y-2">
            <span className="label-caps">Icon</span>
            <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {CATEGORY_ICON_OPTIONS.map(({ name: key, Icon }) => (
                <button key={key} onClick={() => setIcon(key)} title={key} className={`w-9 h-9 rounded border flex items-center justify-center ${icon === key ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/35 hover:text-white'}`}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="h-16 px-5 border-t border-white/10 flex items-center justify-between">
          {category.id !== 'uncategorized' && category.count === 0 ? (
            <button disabled={saving} onClick={remove} className="p-2 text-red-400/70 hover:text-red-400 disabled:opacity-40" title="Delete category"><Trash2 className="w-4 h-4" /></button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[10px] font-bold uppercase text-white/45 hover:text-white">Cancel</button>
            <button disabled={saving} onClick={submit} className="px-4 py-2 rounded bg-accent text-black text-[10px] font-black uppercase disabled:opacity-40">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
