import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import SettingsSection from './SettingsSection';
import { readAnswerPreferences } from '../../utils/answerPreferences';

export default function AnswerWaitSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState(() => readAnswerPreferences());

  return (
    <SettingsSection
      icon={<Icon name="Hourglass" size={16} className="text-sage-700" />}
      title={t('AnswerCard.waitSettingsTitle')}
    >
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-body text-ink-900">
        {t('SettingsPanel.enableWaitingTime')}
        <input
          type="checkbox"
          checked={preferences.enabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            localStorage.setItem('enableWaitTime', String(enabled));
            setPreferences((prev) => ({ ...prev, enabled }));
          }}
          className="h-5 w-5 accent-sage-500"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="answer-wait-seconds" className="text-small text-ink-700">
          {t('SettingsPanel.answerCardWaitingTime')}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="answer-wait-seconds"
            type="number"
            min={0}
            max={30}
            step={1}
            value={preferences.seconds}
            disabled={!preferences.enabled}
            onChange={(event) => {
              if (event.target.value === '') {
                setPreferences((prev) => ({ ...prev, seconds: '' }));
                return;
              }
              const seconds = event.target.valueAsNumber;
              if (!Number.isInteger(seconds) || seconds < 0 || seconds > 30) return;
              localStorage.setItem('waitTime', String(seconds));
              setPreferences((prev) => ({ ...prev, seconds }));
            }}
            onBlur={() => setPreferences(readAnswerPreferences())}
            aria-describedby="answer-wait-description"
            className="h-11 w-20 rounded-sm border border-paper-200 bg-paper-50 px-3 text-body text-ink-900 outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 disabled:opacity-50"
          />
          <span className="text-small text-ink-500">{t('SettingsPanel.seconds')}</span>
        </div>
      </div>
      <p id="answer-wait-description" className="mt-3 text-small leading-relaxed text-ink-500">
        {t('AnswerCard.waitSettingsDescription')}
      </p>
    </SettingsSection>
  );
}
