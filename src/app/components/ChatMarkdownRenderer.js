import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Image from 'next/image';

// Import remark-math and rehype-katex
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Import KaTeX CSS - Crucial for styling the rendered LaTeX
import 'katex/dist/katex.min.css';

export default function ChatMarkdownRenderer({ mark, isSyntaxHighlighterDarkMode = false }) {
    // isSyntaxHighlighterDarkMode is set to false as a default for demonstration.
    // In a real application, you would pass this prop from your parent component,
    // likely based on a theme context or user preference.

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]} // Add remarkMath to parse math syntax
            rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]} // Add rehypeKatex to render the parsed math
            components={{
                a: ({ node, ...props }) => (
                    <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                    />
                ),
                // Re-enabled code block component
                code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter
                            style={isSyntaxHighlighterDarkMode ? vscDarkPlus : vs}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md my-4 text-sm"
                            showLineNumbers={true}
                            wrapLines={true}
                            wrapLongLines={true}
                            {...props}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code
                            className={`${className || ''} ${inline
                                ? 'bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-sm text-zinc-900 dark:text-zinc-200'
                                : ''
                            }`}
                            {...props}
                        >
                            {children}
                        </code>
                    );
                },
                h1: ({ node, ...props }) => (
                    <h1
                        className="text-xl md:text-2xl my-2 font-bold border-b dark:border-zinc-700 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                h2: ({ node, ...props }) => (
                    <h2
                        className="text-lg md:text-2xl font-semibold my-1 border-b dark:border-zinc-700 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                h3: ({ node, ...props }) => (
                    <h3
                        className="text-lg md:text-xl font-semibold my-1 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                h4: ({ node, ...props }) => (
                    <h4
                        className="text- font-semibold mb-2 my-1 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                ul: ({ node, ...props }) => (
                    <ul
                        className="list-disc pl-6 my-3 space-y-1  text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                ol: ({ node, ...props }) => (
                    <ol
                        className="list-decimal pl-6 my-3 space-y-1  text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                li: ({ node, ...props }) => (
                    <li
                        className="my-1 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 border dark:border-zinc-700 rounded-md">
                        <table
                            className="min-w-full border-collapse text-zinc-900 dark:text-zinc-200"
                            {...props}
                        />
                    </div>
                ),
                thead: ({ node, ...props }) => (
                    <thead
                        className="bg-gray-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                th: ({ node, ...props }) => (
                    <th
                        className="border dark:border-zinc-600 p-2 text-left font-semibold text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                td: ({ node, ...props }) => (
                    <td
                        className="border dark:border-zinc-600 p-2 text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                p: ({ node, ...props }) => (
                    <p
                        className="my-7 leading-relaxed text-  text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                blockquote: ({ node, ...props }) => (
                    <blockquote
                        className="border-l-4 border-gray-300 dark:border-zinc-600 pl-4 py-1 my-4 italic bg-gray-50 dark:bg-zinc-700/30 text-xl text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                hr: ({ node, ...props }) => (
                    <hr
                        className="my-6 border-gray-300 dark:border-zinc-700/50"
                        {...props}
                    />
                ),
                strong: ({ node, ...props }) => (
                    <strong
                        className="font-semibold "
                        {...props}
                    />
                ),
                em: ({ node, ...props }) => (
                    <em
                        className="italic text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                del: ({ node, ...props }) => (
                    <del
                        className="line-through text-zinc-900 dark:text-zinc-200"
                        {...props}
                    />
                ),
                img: ({ node, ...props }) => (
                    <Image
                        {...props}
                        width={400}
                        height={400}
                        className="max-w-full h-auto my-4 rounded-lg shadow-md"
                        unoptimized
                        alt={props.alt || 'Image'}
                    />
                ),
            }}
        >
            {mark}
        </ReactMarkdown>
    );
}