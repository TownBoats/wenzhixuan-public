import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ language, value, theme }) => {
  const [copied, setCopied] = React.useState(false);

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
    <div className="relative group">
      <button
        onClick={handleCopy}
        className={`absolute right-2 top-2 px-2 py-1 text-xs rounded transition-all duration-200 ${
          theme === 'tech'
            ? 'bg-tech-accent/20 text-tech-highlight hover:bg-tech-accent/30'
            : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
        } opacity-0 group-hover:opacity-100`}
      >
        {copied ? '已复制!' : '复制'}
      </button>
      <div className={`text-xs mb-1 px-4 py-1 rounded-t-lg ${
        theme === 'tech' 
          ? 'bg-tech-secondary/80 text-tech-text' 
          : 'bg-slate-700 text-slate-300'
      }`}>
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
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer = ({ content, theme = 'default' }) => {
  const markdownComponents = useMemo(
    () => ({
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const language = match?.[1];
        const value = String(children).replace(/\n$/, "");
        
        if (!inline && language) {
          return (
            <div className="my-2">
              <CodeBlock
                language={language}
                value={value}
                theme={theme}
              />
            </div>
          );
        }

        return (
          <code 
            className={`px-1.5 py-0.5 rounded text-sm font-mono ${
              theme === 'tech' 
                ? 'bg-tech-secondary/50 text-tech-accent' 
                : 'bg-gray-100 text-gray-800'
            }`} 
            {...props}
          >
            {children}
          </code>
        );
      },
      // 链接样式
      a: ({ node, ...props }) => (
        <a
          className={`hover:underline ${
            theme === 'tech' ? 'text-tech-accent' : 'text-blue-500'
          }`}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        />
      ),
      // 列表样式
      ul: ({ node, ...props }) => (
        <ul className="list-disc pl-6 my-2 space-y-1" {...props} />
      ),
      ol: ({ node, ...props }) => (
        <ol className="list-decimal pl-6 my-2 space-y-1" {...props} />
      ),
      // 添加列表项样式
      li: ({ node, children, ...props }) => (
        <li className="pl-1" {...props}>
          {children}
        </li>
      ),
      // 表格样式
      table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-4">
          <table className={`min-w-full divide-y ${
            theme === 'tech' ? 'divide-tech-text/20' : 'divide-gray-200'
          }`} {...props} />
        </div>
      ),
      th: ({ node, ...props }) => (
        <th
          className={`px-4 py-2 text-left text-sm font-semibold ${
            theme === 'tech' 
              ? 'bg-tech-secondary/50 text-tech-highlight' 
              : 'bg-gray-50 text-gray-900'
          }`}
          {...props}
        />
      ),
      td: ({ node, ...props }) => (
        <td className={`px-4 py-2 text-sm ${
          theme === 'tech' ? 'text-tech-text' : 'text-gray-900'
        }`} {...props} />
      ),
    }),
    [theme]
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

export default MarkdownRenderer; 