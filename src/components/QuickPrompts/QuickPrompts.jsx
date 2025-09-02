import React from 'react';
import { useTranslation } from 'react-i18next';
const QuickPrompts = ({ onSelect }) => {
  const { t } = useTranslation();
  const prompts = [
    {
      id: 1,
      text: t('QuickPrompts.prompt_math'),
      type: "math"
    },
    {
      id: 3,
      text: t('QuickPrompts.prompt_language'),
      type: "language"
    },
    {
      id: 4,
      text: t('QuickPrompts.prompt_biology'),
      type: "biology"
    },
    {
      id: 5,
      text: t('QuickPrompts.prompt_physics'),
      type: "physics"
    },

    {
      id: 7,
      text: t('QuickPrompts.prompt_economics'),
      type: "economics"
    },
    {
      id: 8,
      text: t('QuickPrompts.prompt_computer'),
      type: "computer"
    }
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelect(prompt.text)}
            className="text-sm px-4 py-2 rounded-xl transition-all duration-300 
              bg-white/80 border-2 border-slate-200 text-slate-800 
              hover:border-cyan-500 hover:bg-white/90 max-w-full"
          >
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickPrompts; 