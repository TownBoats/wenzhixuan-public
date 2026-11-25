import { memo, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import { isRefHref } from '../../agent/references.js';
import { ReferenceLink } from '../References/References';
import { MATH_REHYPE_PLUGINS, MATH_REMARK_PLUGINS, escapeCurrency } from '../../utils/markdownMath';

/**
 * MarkdownContent：教学正文与题目的 Markdown 渲染。
 *
 * 与 `MarkdownRenderer` 分开：后者用于答题卡，带代码高亮等依赖；这里只启用 GFM 与公式。
 * 不启用 `rehype-raw`，模型输出的 HTML 不会被执行。
 */

function CodeBlock({ language, code }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板不可用（非 https / 无权限）时静默失败，不打断阅读
    }
  };

  return (
    <div className="group my-3 overflow-hidden rounded-md border border-ink-900/10 bg-ink-900 shadow-soft">
      <div className="flex items-center justify-between border-b border-paper-50/10 px-3 py-1.5">
        <span className="font-mono text-caption uppercase tracking-[0.08em] text-paper-50/50">
          {language || t('AgentChat.messageContent.plainText')}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? t('AgentChat.messageContent.copied') : t('AgentChat.messageContent.copy')}
          aria-label={
            copied ? t('AgentChat.messageContent.copied') : t('AgentChat.messageContent.copy')
          }
          className={cn(
            'rounded-xs p-1 text-paper-50/50 transition-colors duration-fast',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            'hover:bg-paper-50/10 hover:text-paper-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-300/40',
          )}
        >
          <Icon name={copied ? 'Check' : 'Copy'} size={14} className="text-current" />
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-small leading-[1.6] text-paper-50/90">{code}</code>
      </pre>
    </div>
  );
}

CodeBlock.propTypes = {
  language: PropTypes.string,
  code: PropTypes.string.isRequired,
};

function MarkdownContent({ content, compact = false }) {
  const components = useMemo(
    () => ({
      p: ({ children }) => (
        <p className={cn('text-ink-900', compact ? 'my-1.5' : 'my-3')}>{children}</p>
      ),
      h1: ({ children }) => (
        <h1 className="mb-2 mt-5 text-h2 font-semibold text-ink-900 first:mt-0">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-2 mt-5 text-h2 font-semibold text-ink-900 first:mt-0">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-1.5 mt-4 text-body font-semibold text-ink-900 first:mt-0">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="mb-1 mt-3 text-small font-semibold text-ink-900 first:mt-0">{children}</h4>
      ),
      strong: ({ children }) => <strong className="font-semibold text-ink-900">{children}</strong>,
      em: ({ children }) => <em className="italic text-ink-700">{children}</em>,
      del: ({ children }) => <del className="text-ink-500 line-through">{children}</del>,
      a: ({ children, href }) => isRefHref(href) ? (
        <ReferenceLink href={href}>{children}</ReferenceLink>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sage-700 underline decoration-sage-300 underline-offset-2 transition-colors duration-fast hover:text-sage-900 hover:decoration-sage-700"
        >
          {children}
        </a>
      ),
      ul: ({ children }) => (
        <ul className="my-2 list-disc space-y-1 pl-5 marker:text-sage-300">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="my-2 list-decimal space-y-1 pl-5 marker:font-medium marker:text-sage-500">
          {children}
        </ol>
      ),
      li: ({ children }) => <li className="pl-0.5">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="my-3 rounded-r-sm border-l-2 border-sage-300 bg-sage-50/60 py-2 pl-3 pr-2 text-ink-700">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-5 border-paper-200" />,
      pre: ({ children }) => <>{children}</>,
      code: ({ className, children, ...props }) => {
        const language = /language-(\w+)/.exec(className || '')?.[1];
        const text = String(children).replace(/\n$/, '');
        // 有语言标记、或内容本身跨行，一律当代码块；否则是行内代码
        if (language || text.includes('\n')) {
          return <CodeBlock language={language} code={text} />;
        }
        return (
          <code
            className="rounded-xs bg-paper-100 px-1.5 py-0.5 font-mono text-[0.9em] text-sage-700"
            {...props}
          >
            {children}
          </code>
        );
      },
      table: ({ children }) => (
        <div className="my-3 overflow-x-auto rounded-md border border-paper-200">
          <table className="w-full border-collapse text-small">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-paper-100">{children}</thead>,
      th: ({ children }) => (
        <th className="whitespace-nowrap px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-ink-700">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border-t border-paper-200 px-3 py-2 align-top text-ink-900">{children}</td>
      ),
      img: ({ src, alt }) => (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          className="my-3 max-w-full rounded-md border border-paper-200"
        />
      ),
      input: ({ type, checked, ...props }) =>
        type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-1.5 accent-sage-500"
            {...props}
          />
        ) : (
          <input type={type} {...props} />
        ),
    }),
    [compact],
  );

  if (typeof content !== 'string' || content.length === 0) return null;

  return (
    <div
      className={cn(
        // 行内长分式无法换行，列表等场景在正文范围内横向滚动
        'min-w-0 overflow-x-auto leading-[1.8] text-ink-900',
        compact ? 'text-small' : 'text-body',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
      )}
    >
      <ReactMarkdown
        remarkPlugins={MATH_REMARK_PLUGINS}
        rehypePlugins={MATH_REHYPE_PLUGINS}
        components={components}
      >
        {escapeCurrency(content)}
      </ReactMarkdown>
    </div>
  );
}

MarkdownContent.propTypes = {
  content: PropTypes.string,
  compact: PropTypes.bool,
};

export default memo(MarkdownContent);
