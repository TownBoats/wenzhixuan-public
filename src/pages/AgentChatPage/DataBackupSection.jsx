import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@/components/ui';
import SettingsSection from '../../components/SettingsPanel/SettingsSection';
import { createDataBackup, planDataImport, importDataBackup, MAX_BACKUP_BYTES } from '../../utils/dataBackup.js';

function DataBackupSection({ disabled, beforeTransfer, onImported }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState(null);
  const active = useRef(false);
  const blocked = disabled || busy;
  const message = (key, values) => t(`AgentChat.backup.${key}`, values);
  const error = (reason) => setNotice({ error: true, text: message(`errors.${reason}`) });

  const exportBackup = () => {
    if (blocked || active.current) return;
    setNotice(null);
    try {
      const saved = beforeTransfer();
      if (!saved.ok) { error(saved.reason); return; }
      const result = createDataBackup(window.localStorage, { includeCredentials });
      if (!result.ok) { error(result.reason); return; }
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wenzhixuan-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice({ text: message('exported') });
    } catch { error('unavailable'); }
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || blocked || active.current) return;
    active.current = true;
    setBusy(true);
    setNotice(null);
    setPreview(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) { error('too_large'); return; }
      const text = await file.text();
      const result = planDataImport(window.localStorage, text);
      if (!result.ok) { error(result.reason); return; }
      setPreview({ text, name: file.name, summary: result.summary });
    } catch { error('unavailable'); }
    finally { active.current = false; setBusy(false); }
  };

  const applyImport = () => {
    if (!preview || blocked || active.current) return;
    setNotice(null);
    try {
      const saved = beforeTransfer();
      if (!saved.ok) { error(saved.reason); return; }
      const result = importDataBackup(window.localStorage, preview.text);
      if (!result.ok) { error(result.reason); return; }
      setPreview(null);
      onImported();
      setNotice({ text: message('imported') });
    } catch { error('unavailable'); }
  };

  return (
    <SettingsSection title={message('title')} icon={<Icon name="Archive" size={16} className="text-sage-700" />}>
      <div className="space-y-3">
        <p className="text-small leading-relaxed text-ink-500">{message('description')}</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-ink-900">
          <input type="checkbox" checked={includeCredentials} disabled={blocked}
            onChange={(event) => setIncludeCredentials(event.target.checked)} className="h-5 w-5 accent-sage-500" />
          {message('includeCredentials')}
        </label>
        <p className="text-caption leading-relaxed text-ink-500">{message(includeCredentials ? 'sensitiveHint' : 'redactedHint')}</p>
        {disabled && <p className="text-small text-ink-700">{message('running')}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button intent="primary" onClick={exportBackup} disabled={blocked}>
            <Icon name="Download" size={16} />{message('export')}
          </Button>
          <Button intent="secondary" onClick={() => fileRef.current?.click()} disabled={blocked}>
            <Icon name="Upload" size={16} />{message(busy ? 'reading' : 'import')}
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            aria-label={message('import')} disabled={blocked} onChange={readFile} />
        </div>
        {preview && (
          <div className="space-y-3 rounded-sm border border-paper-200 bg-paper-100 p-3" aria-label={message('preview')}>
            <p className="break-all text-small font-medium text-ink-900">{preview.name}</p>
            <p className="text-small text-ink-700">{message('summary', preview.summary)}</p>
            <p className="text-caption leading-relaxed text-ink-500">{message('mergeHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button intent="primary" disabled={blocked} onClick={applyImport}>{message('confirm')}</Button>
              <Button intent="secondary" disabled={busy} onClick={() => setPreview(null)}>{message('cancel')}</Button>
            </div>
          </div>
        )}
        {notice && <p role={notice.error ? 'alert' : 'status'}
          className={`text-small leading-relaxed ${notice.error ? 'text-state-alert' : 'text-sage-700'}`}>{notice.text}</p>}
      </div>
    </SettingsSection>
  );
}

DataBackupSection.propTypes = {
  disabled: PropTypes.bool.isRequired,
  beforeTransfer: PropTypes.func.isRequired,
  onImported: PropTypes.func.isRequired,
};

export default DataBackupSection;
