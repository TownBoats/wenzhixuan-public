import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { Icon, LevelIcon, cn } from '@/components/ui';

/**
 * AnswerMessageCard — 选档后嵌在对话流里的"已答"卡片（P3e Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - 6 套 default 配色（gray/blue/green/orange/yellow/purple）
 *     → 5 档统一走 level-* token（自然色调阶），custom 走 sun-700
 *   - 6 张内联 SVG 图标 + 双 theme（default/tech）共 12 套样式
 *     → ui/LevelIcon 统一调度，custom 用 lucide Pencil
 *   - 旧 tech 分支因引用未定义 token (tech-warning/tech-success) 删除
 *   - rounded-xl + 复杂 gradient header → rounded-md + paper-50/100 简洁层级
 *
 * 行为完全保留：点击折叠 / 展开。
 */

const LEVEL_LABEL_KEY = {
  none: 'none',
  heard: 'heard',
  basic: 'basic',
  familiar: 'familiar',
  expert: 'expert',
  custom: 'custom',
};

// 旧档名 → tailwind level-* 完整类名（dynamic 字符串 Tailwind 提取不到）
const LEVEL_ACCENT = {
  none:     'text-level-seed',
  heard:    'text-level-sprout',
  basic:    'text-level-sapling',
  familiar: 'text-level-tree',
  expert:   'text-level-forest',
  custom:   'text-sun-700',
};

const AnswerMessageCard = ({
  question,
  level,
  answer,
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useTranslation();

  const validLevel = LEVEL_LABEL_KEY[level] ? level : 'custom';
  const isCustom = validLevel === 'custom';

  const description = t(`AnswerMessageCard.${validLevel}`);

  const renderLevelIcon = (size) =>
    isCustom ? (
      <Icon name="Pencil" size={size} className="text-sun-700" />
    ) : (
      <LevelIcon level={validLevel} size={size} />
    );

  const accentClass = LEVEL_ACCENT[validLevel] || 'text-sun-700';

  return (
    <div
      onClick={() => setIsCollapsed(!isCollapsed)}
      className={cn(
        'w-full cursor-pointer overflow-hidden rounded-md border bg-paper-50',
        'transition-all duration-base ease-soft hover:shadow-soft',
        isCustom ? 'border-sun-500/40' : `border-paper-200`,
      )}
    >
      {isCollapsed ? (
        // 折叠态：72×72 方块徽章
        <div className="flex h-[72px] w-[72px] items-center justify-center">
          <div className={cn('flex flex-col items-center gap-1', accentClass)}>
            {renderLevelIcon(28)}
            <span className="whitespace-nowrap text-caption font-serif">{description}</span>
          </div>
        </div>
      ) : (
        // 展开态：左问右标签
        <div className="grid grid-cols-[1fr,auto] gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-col">
            <div>
              <div className={cn('mb-1.5 flex items-center gap-2', accentClass)}>
                <span className="text-caption font-medium uppercase tracking-wide font-mono">
                  {t('AnswerMessageCard.questionAnswer')}
                </span>
                <span className="h-px flex-1 bg-current opacity-15" />
              </div>
              <div className="font-serif text-body text-ink-900">
                <MarkdownRenderer content={question} />
              </div>
            </div>

            <div className="mt-3">
              <div className="font-serif text-small leading-relaxed text-ink-700">
                <MarkdownRenderer content={answer} />
              </div>
            </div>
          </div>

          <div className="flex items-start">
            <div className={cn('flex flex-col items-center gap-1 rounded-sm border bg-paper-100 px-2.5 py-2', accentClass, isCustom ? 'border-sun-500/30' : 'border-paper-200')}>
              {renderLevelIcon(20)}
              <span className="whitespace-nowrap text-caption font-medium font-serif">
                {description}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

AnswerMessageCard.propTypes = {
  question: PropTypes.string,
  level: PropTypes.string,
  answer: PropTypes.string,
  theme: PropTypes.string,
};

export default AnswerMessageCard;
