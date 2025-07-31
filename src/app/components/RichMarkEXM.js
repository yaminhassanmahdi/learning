import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Image from 'next/image';

export default function RichMarkdownEXM({ mark }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={{
                a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="markdown-link" />
                ),
                h1: (props) => <h1 className="text-2xl font-bold mb-4" {...props} />,
                h2: (props) => <h2 className="text-xl font-bold mb-3" {...props} />,
                h3: (props) => <h3 className="text-lg font-bold mb-2" {...props} />,
                p: (props) => <p className="my-2" {...props} />,
                ul: (props) => <ul className="list-disc pl-6 my-2" {...props} />,
                ol: (props) => <ol className="list-decimal pl-6 my-2" {...props} />,
                li: (props) => <li className="my-1" {...props} />,
                strong: (props) => <strong className="font-bold" {...props} />,
                em: (props) => <em className="italic" {...props} />,
                blockquote: (props) => <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic" {...props} />,
                hr: (props) => <hr className="my-4 border-t border-gray-300" {...props} />,
                input: ({ type, ...props }) => {
                    if (type === 'checkbox') {
                        return (
                            <input
                                type="checkbox"
                                className="mr-2 align-middle"
                                style={{ width: '16px', height: '16px' }}
                                {...props}
                            />
                        );
                    }
                    return <input type={type} {...props} />;
                },
                table: (props) => (
                    <div className="overflow-x-auto my-4">
                        <table className="min-w-full border-collapse border border-gray-300" {...props} />
                    </div>
                ),
                thead: (props) => <thead className="bg-gray-100" {...props} />,
                th: (props) => <th className="border border-gray-300 p-2 font-bold" {...props} />,
                td: (props) => <td className="border border-gray-300 p-2" {...props} />,
                img: (props) => (
                    <Image
                        {...props}
                        width={400}
                        height={400}
                        className="my-4 rounded-lg"
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
