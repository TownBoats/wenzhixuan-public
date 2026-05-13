import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icon, cn } from '@/components/ui';

/**
 * MarkdownRenderer — Markdown 内容渲染（设计 token 重写版）
 *
 * 视觉迁移自旧版：
 *   - 链接 text-blue-500             → text-sage-700 + 下划线 hover
 *   - 内联 code bg-gray-100/text-800 → bg-paper-100 + text-sage-700
 *   - 代码块顶栏 bg-slate-700        → bg-ink-900 + text-paper-50（与 Tooltip 同色）
 *   - 复制按钮 bg-slate-700          → ui Icon(Copy/Check) + ghost hover
 *   - 表格 divide-gray-200           → divide-paper-200
 *   - 表头 bg-gray-50                → bg-paper-100 + ink-900 + serif
 *   - tech 主题分支整体删除（新设计单主题；P5 后用 dark: 接管）
 *
 * 行为完全保留，包括 KaTeX CSS 注入（已在 P2 注释为待 P3 优化）。
 */

const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-sm',
          'bg-paper-100 text-ink-500 transition-all duration-fast',
          'opacity-0 group-hover:opacity-100',
          'hover:bg-paper-200 hover:text-sage-700',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
        )}
        title={copied ? '已复制' : '复制'}
        aria-label={copied ? '已复制' : '复制'}
      >
        <Icon name={copied ? 'Check' : 'Copy'} size={14} className="text-current" />
      </button>
      <div className="rounded-t-sm bg-ink-900 px-4 py-1 font-mono text-caption text-paper-50">
        {language || 'plaintext'}
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'plaintext'}
        showLineNumbers={true}
        wrapLines={true}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

CodeBlock.propTypes = {
  language: PropTypes.string,
  value: PropTypes.string.isRequired,
};

const MarkdownRenderer = ({
  content,
  // theme 兼容旧调用方（ChatWindow / MessageBubble 内部仍透传），新设计无需主题分叉
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const markdownComponents = useMemo(
    () => ({
      code({ inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match?.[1];
        const value = String(children).replace(/\n$/, '');

        if (!inline && language) {
          return (
            <div className="my-2">
              <CodeBlock language={language} value={value} />
            </div>
          );
        }

        return (
          <code
            className="rounded-xs bg-paper-100 px-1.5 py-0.5 font-mono text-small text-sage-700"
            {...props}
          >
            {children}
          </code>
        );
      },
      a: ({ ...props }) => (
        <a
          className="text-sage-700 underline-offset-2 hover:text-sage-900 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        />
      ),
      ul: ({ ...props }) => <ul className="my-2 list-disc space-y-1 pl-6" {...props} />,
      ol: ({ ...props }) => <ol className="my-2 list-decimal space-y-1 pl-6" {...props} />,
      li: ({ children, ...props }) => (
        <li className="pl-1" {...props}>
          {children}
        </li>
      ),
      table: ({ ...props }) => (
        <div className="my-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-paper-200" {...props} />
        </div>
      ),
      th: ({ ...props }) => (
        <th
          className="bg-paper-100 px-4 py-2 text-left font-serif text-small font-semibold text-ink-900"
          {...props}
        />
      ),
      td: ({ ...props }) => (
        <td className="px-4 py-2 text-small text-ink-900" {...props} />
      ),
    }),
    [],
  );

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css"
      />
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
        skipHtml={false}
        unwrapDisallowed={false}
      >
        {content}
      </ReactMarkdown>
    </>
  );
};

MarkdownRenderer.propTypes = {
  content: PropTypes.string,
  theme: PropTypes.string,
};

export default MarkdownRenderer;
