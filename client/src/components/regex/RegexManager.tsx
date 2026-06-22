import { useEffect, useState } from 'react';
import { useRegexStore } from '../../stores/regexStore';
import { useTranslation } from '../../i18n';
import { regexApi } from '../../services/api';
import type { RegexScript, RegexPreset, RegexTestResult, RegexExportData } from '../../types';
import {
  ArrowLeft, Plus, Trash2, Edit3, Save, Play, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Download, Upload, Wand2, List, Package,
} from 'lucide-react';

interface RegexManagerProps {
  onClose: () => void;
}

type TabView = 'scripts' | 'presets' | 'test';

export function RegexManager({ onClose }: RegexManagerProps) {
  const { t } = useTranslation();
  const {
    scripts, presets, loading, error,
    fetchScripts, createScript, updateScript, deleteScript, reorderScripts,
    fetchPresets, createPreset, updatePreset, deletePreset, setPresetScripts,
    exportPreset, importPreset,
  } = useRegexStore();

  const [tab, setTab] = useState<TabView>('scripts');
  const [editingScript, setEditingScript] = useState<Partial<RegexScript> | null>(null);
  const [editingPreset, setEditingPreset] = useState<RegexPreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [presetScriptIds, setPresetScriptIds] = useState<string[]>([]);
  const [showNewScript, setShowNewScript] = useState(false);
  const [showNewPreset, setShowNewPreset] = useState(false);

  // Test panel state
  const [testPattern, setTestPattern] = useState('');
  const [testFlags, setTestFlags] = useState('g');
  const [testReplacement, setTestReplacement] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<RegexTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Import state
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetchScripts();
    fetchPresets();
  }, [fetchScripts, fetchPresets]);

  // --- Script handlers ---
  const handleCreateScript = async () => {
    if (!editingScript?.name || !editingScript?.findPattern) return;
    await createScript(editingScript);
    setEditingScript(null);
    setShowNewScript(false);
  };

  const handleUpdateScript = async () => {
    if (!editingScript?.id) return;
    await updateScript(editingScript.id, editingScript);
    setEditingScript(null);
  };

  const handleToggleScript = async (script: RegexScript) => {
    await updateScript(script.id, { enabled: !script.enabled });
  };

  const handleMoveScript = async (index: number, direction: 'up' | 'down') => {
    const newIds = scripts.map(s => s.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    await reorderScripts(newIds);
  };

  // --- Preset handlers ---
  const handleCreatePreset = async () => {
    if (!presetName.trim()) return;
    await createPreset({ name: presetName, description: presetDesc || undefined, scriptIds: presetScriptIds });
    setPresetName('');
    setPresetDesc('');
    setPresetScriptIds([]);
    setShowNewPreset(false);
  };

  const handleUpdatePreset = async () => {
    if (!editingPreset) return;
    await updatePreset(editingPreset.id, {
      name: editingPreset.name,
      description: editingPreset.description || undefined,
      isDefault: editingPreset.isDefault,
    });
    if (presetScriptIds.length > 0) {
      await setPresetScripts(editingPreset.id, presetScriptIds);
    }
    setEditingPreset(null);
    setPresetScriptIds([]);
  };

  const handleEditPreset = (preset: RegexPreset) => {
    setEditingPreset(preset);
    setPresetScriptIds(preset.scripts?.map(s => s.id) || []);
  };

  const handleExportPreset = async (presetId: string) => {
    const data = await exportPreset(presetId);
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson) as RegexExportData;
      await importPreset(data);
      setImportJson('');
      setShowImport(false);
    } catch {
      alert('Invalid JSON format');
    }
  };

  // --- Test handler ---
  const handleTest = async () => {
    if (!testPattern || !testInput) return;
    setTestLoading(true);
    try {
      const res = await regexApi.testRegex(testPattern, testFlags, testReplacement, testInput);
      if (res.success && res.data) {
        setTestResult(res.data);
      }
    } catch {
      // ignore
    }
    setTestLoading(false);
  };

  const getPlacementLabel = (p: string) => {
    switch (p) {
      case 'input': return t('regex.placementInput');
      case 'output': return t('regex.placementOutput');
      default: return t('regex.placementBoth');
    }
  };

  const getPlacementColor = (p: string) => {
    switch (p) {
      case 'input': return 'text-blue-400 bg-blue-400/10';
      case 'output': return 'text-green-400 bg-green-400/10';
      default: return 'text-purple-400 bg-purple-400/10';
    }
  };

  // --- Script Edit Form ---
  const ScriptForm = ({ script, onSave, onCancel }: {
    script: Partial<RegexScript>;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.scriptName')}</label>
        <input
          type="text"
          value={script.name || ''}
          onChange={e => setEditingScript(prev => ({ ...prev!, name: e.target.value }))}
          className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          placeholder={t('regex.scriptNamePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.findPattern')}</label>
          <input
            type="text"
            value={script.findPattern || ''}
            onChange={e => setEditingScript(prev => ({ ...prev!, findPattern: e.target.value }))}
            className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="regex pattern"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.replacement')}</label>
          <input
            type="text"
            value={script.replacement || ''}
            onChange={e => setEditingScript(prev => ({ ...prev!, replacement: e.target.value }))}
            className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="replacement"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.flags')}</label>
          <input
            type="text"
            value={script.flags || 'g'}
            onChange={e => setEditingScript(prev => ({ ...prev!, flags: e.target.value }))}
            className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="g"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.placement')}</label>
          <select
            value={script.placement || 'both'}
            onChange={e => setEditingScript(prev => ({ ...prev!, placement: e.target.value as any }))}
            className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="input">{t('regex.placementInput')}</option>
            <option value="output">{t('regex.placementOutput')}</option>
            <option value="both">{t('regex.placementBoth')}</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={script.enabled !== false}
              onChange={e => setEditingScript(prev => ({ ...prev!, enabled: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-[var(--color-text-primary)]">{t('regex.enabled')}</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors">
          {t('common.cancel')}
        </button>
        <button onClick={onSave} className="px-4 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
          <Save size={14} />
          {t('common.save')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Wand2 size={20} className="text-[var(--color-accent)]" />
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('regex.title')}</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--color-border-light)]">
        {[
          { key: 'scripts' as TabView, icon: List, label: t('regex.scriptsTab') },
          { key: 'presets' as TabView, icon: Package, label: t('regex.presetsTab') },
          { key: 'test' as TabView, icon: Play, label: t('regex.testTab') },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === item.key
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ===== SCRIPTS TAB ===== */}
        {tab === 'scripts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t('regex.scriptsCount', { count: scripts.length })}
              </h2>
              <button
                onClick={() => { setShowNewScript(true); setEditingScript({ name: '', findPattern: '', replacement: '', flags: 'g', placement: 'both', enabled: true }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                {t('regex.addScript')}
              </button>
            </div>

            {showNewScript && editingScript && !editingScript.id && (
              <ScriptForm
                script={editingScript}
                onSave={handleCreateScript}
                onCancel={() => { setShowNewScript(false); setEditingScript(null); }}
              />
            )}

            {loading ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">{t('common.loading')}</div>
            ) : scripts.length === 0 && !showNewScript ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">
                <Wand2 size={40} className="mx-auto mb-3 opacity-30" />
                <p>{t('regex.noScripts')}</p>
              </div>
            ) : (
              scripts.map((script, index) => (
                <div key={script.id}>
                  {editingScript?.id === script.id ? (
                    <ScriptForm
                      script={editingScript}
                      onSave={handleUpdateScript}
                      onCancel={() => setEditingScript(null)}
                    />
                  ) : (
                    <div className={`bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-xl p-3 transition-opacity ${!script.enabled ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => handleMoveScript(index, 'up')} disabled={index === 0} className="p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-20">
                              <ChevronUp size={12} />
                            </button>
                            <button onClick={() => handleMoveScript(index, 'down')} disabled={index === scripts.length - 1} className="p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-20">
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <button onClick={() => handleToggleScript(script)} className="flex-shrink-0">
                            {script.enabled ? (
                              <ToggleRight size={22} className="text-[var(--color-accent)]" />
                            ) : (
                              <ToggleLeft size={22} className="text-[var(--color-text-secondary)]" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{script.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getPlacementColor(script.placement)}`}>
                                {getPlacementLabel(script.placement)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="text-xs text-[var(--color-text-secondary)] font-mono truncate max-w-[200px]">{script.findPattern}</code>
                              <span className="text-[var(--color-text-secondary)]">→</span>
                              <code className="text-xs text-[var(--color-text-secondary)] font-mono truncate max-w-[200px]">{script.replacement || '(empty)'}</code>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditingScript({ ...script })} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => deleteScript(script.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== PRESETS TAB ===== */}
        {tab === 'presets' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t('regex.presetsCount', { count: presets.length })}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <Upload size={14} />
                  {t('regex.import')}
                </button>
                <button
                  onClick={() => { setShowNewPreset(true); setPresetName(''); setPresetDesc(''); setPresetScriptIds([]); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus size={14} />
                  {t('regex.addPreset')}
                </button>
              </div>
            </div>

            {/* Import panel */}
            {showImport && (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                <label className="text-xs text-[var(--color-text-secondary)] block">{t('regex.importJson')}</label>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] h-24 resize-none"
                  placeholder='{ "version": 1, "preset": {...}, "scripts": [...] }'
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowImport(false); setImportJson(''); }} className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] rounded-lg hover:bg-[rgba(255,255,255,0.05)]">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleImport} className="px-4 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">
                    {t('regex.importBtn')}
                  </button>
                </div>
              </div>
            )}

            {/* New preset form */}
            {showNewPreset && (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.presetName')}</label>
                  <input
                    type="text"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    placeholder={t('regex.presetNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.presetDesc')}</label>
                  <input
                    type="text"
                    value={presetDesc}
                    onChange={e => setPresetDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    placeholder={t('regex.presetDescPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.selectScripts')}</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {scripts.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[rgba(255,255,255,0.03)] rounded">
                        <input
                          type="checkbox"
                          checked={presetScriptIds.includes(s.id)}
                          onChange={e => {
                            if (e.target.checked) setPresetScriptIds(prev => [...prev, s.id]);
                            else setPresetScriptIds(prev => prev.filter(id => id !== s.id));
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-[var(--color-text-primary)]">{s.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getPlacementColor(s.placement)}`}>
                          {getPlacementLabel(s.placement)}
                        </span>
                      </label>
                    ))}
                    {scripts.length === 0 && (
                      <p className="text-xs text-[var(--color-text-secondary)]">{t('regex.noScriptsAvailable')}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => { setShowNewPreset(false); setPresetName(''); setPresetDesc(''); setPresetScriptIds([]); }} className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] rounded-lg hover:bg-[rgba(255,255,255,0.05)]">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleCreatePreset} className="px-4 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 flex items-center gap-1.5">
                    <Save size={14} />
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {/* Preset list */}
            {presets.length === 0 && !showNewPreset && !showImport ? (
              <div className="text-center py-12 text-[var(--color-text-secondary)]">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p>{t('regex.noPresets')}</p>
              </div>
            ) : (
              presets.map(preset => (
                <div key={preset.id} className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-xl p-3">
                  {editingPreset?.id === preset.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editingPreset.name}
                          onChange={e => setEditingPreset(prev => ({ ...prev!, name: e.target.value }))}
                          className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={editingPreset.description || ''}
                          onChange={e => setEditingPreset(prev => ({ ...prev!, description: e.target.value }))}
                          className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                          placeholder={t('regex.presetDesc')}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.selectScripts')}</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {scripts.map(s => (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[rgba(255,255,255,0.03)] rounded">
                              <input
                                type="checkbox"
                                checked={presetScriptIds.includes(s.id)}
                                onChange={e => {
                                  if (e.target.checked) setPresetScriptIds(prev => [...prev, s.id]);
                                  else setPresetScriptIds(prev => prev.filter(id => id !== s.id));
                                }}
                                className="rounded"
                              />
                              <span className="text-sm text-[var(--color-text-primary)]">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingPreset.isDefault}
                            onChange={e => setEditingPreset(prev => ({ ...prev!, isDefault: e.target.checked }))}
                            className="rounded"
                          />
                          <span className="text-sm text-[var(--color-text-primary)]">{t('regex.setDefault')}</span>
                        </label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditingPreset(null); setPresetScriptIds([]); }} className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] rounded-lg hover:bg-[rgba(255,255,255,0.05)]">
                          {t('common.cancel')}
                        </button>
                        <button onClick={handleUpdatePreset} className="px-4 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 flex items-center gap-1.5">
                          <Save size={14} />
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-[var(--color-accent)]" />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{preset.name}</span>
                          {preset.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">
                              {t('regex.defaultBadge')}
                            </span>
                          )}
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {preset.scripts?.length || 0} {t('regex.scripts')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleExportPreset(preset.id)} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors" title={t('regex.export')}>
                            <Download size={14} />
                          </button>
                          <button onClick={() => handleEditPreset(preset)} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => deletePreset(preset.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {preset.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 ml-6">{preset.description}</p>
                      )}
                      {preset.scripts && preset.scripts.length > 0 && (
                        <div className="mt-2 ml-6 flex flex-wrap gap-1">
                          {preset.scripts.map(s => (
                            <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)]">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== TEST TAB ===== */}
        {tab === 'test' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.findPattern')}</label>
                <input
                  type="text"
                  value={testPattern}
                  onChange={e => setTestPattern(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="regex pattern"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.replacement')}</label>
                <input
                  type="text"
                  value={testReplacement}
                  onChange={e => setTestReplacement(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="replacement"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.flags')}</label>
                <input
                  type="text"
                  value={testFlags}
                  onChange={e => setTestFlags(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="g"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <button
                  onClick={handleTest}
                  disabled={testLoading || !testPattern || !testInput}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Play size={14} />
                  {testLoading ? t('common.loading') : t('regex.runTest')}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">{t('regex.testInput')}</label>
              <textarea
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] h-28 resize-none"
                placeholder={t('regex.testInputPlaceholder')}
              />
            </div>
            {testResult && (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-secondary)]">{t('regex.testResult')}</span>
                  <span className="text-xs text-[var(--color-accent)]">
                    {testResult.matches} {t('regex.matches')}
                  </span>
                </div>
                {testResult.error ? (
                  <div className="text-sm text-red-400">{testResult.error}</div>
                ) : (
                  <pre className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap bg-[var(--color-input-bg)] rounded-lg p-3 max-h-48 overflow-y-auto">
                    {testResult.result}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
