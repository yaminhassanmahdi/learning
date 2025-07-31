
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Image from 'next/image';
export default function RichMarkdown({ mark }) {


    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={{
                // --- Markdown Components (unchanged) ---
                a: ({ node, ...props }) => (
                    <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                    />
                ),
                code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

                    return !inline && match ? (
                        <SyntaxHighlighter
                            style={isDarkMode ? vscDarkPlus : vs}
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
                            className={`${className || ''} ${inline ? 'bg-gray-200 dark:bg-gray-700 rounded px-1 text-sm' : ''}`}
                            {...props}
                        >
                            {children}
                        </code>
                    );
                },
                h1: ({ node, ...props }) => <h1 className="text-3xl md:text-4xl font-bold mt-6 mb-3 pb-2 border-b dark:border-zinc-700 dark:text-zinc-200" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-[1.8rem] font-semibold mt-5 mb-3 pb-1 border-b dark:border-zinc-700 dark:text-zinc-200" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-2xl font-semibold mt-4 mb-2" {...props} />,
                h4: ({ node, ...props }) => <h4 className="text-2xl font-semibold mt-3 mb-2" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-6 my-3 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />,
                li: ({ node, ...props }) => <li className="my-1" {...props} />,
                table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 border dark:border-zinc-700 rounded-md">
                        <table className="min-w-full border-collapse" {...props} />
                    </div>
                ),
                thead: ({ node, ...props }) => <thead className="bg-gray-100 dark:bg-zinc-700" {...props} />,
                th: ({ node, ...props }) => <th className="border dark:border-zinc-600 p-2 text-left font-semibold" {...props} />,
                td: ({ node, ...props }) => <td className="border dark:border-zinc-600 p-2" {...props} />,
                p: ({ node, ...props }) => <p className="my-3 leading-relaxed text-[20px]" {...props} />,
                blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-gray-300 dark:border-zinc-600 pl-4 py-1 my-4 italic bg-gray-50 dark:bg-zinc-700/30 text-xl" {...props} />
                ),
                hr: ({ node, ...props }) => <hr className="my-6 border-gray-300 dark:border-zinc-700" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold text-green-400 dark:text-green-300/90" {...props} />,
                em: ({ node, ...props }) => <em className="italic" {...props} />,
                del: ({ node, ...props }) => <del className="line-through" {...props} />,
                img: ({ node, ...props }) => (
                    <Image
                        {...props}

                        width={400}
                        height={400}
                        className="max-w-full h-auto my-4 rounded-lg shadow-md"
                        // loading="lazy"
                        unoptimized
                        alt={props.alt || 'Image'}
                    />
                ),
            }}
        >
            {mark}
        </ReactMarkdown>)
}