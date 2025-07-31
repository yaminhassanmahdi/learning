// src/components/MermaidDiagram.js
import React, { useEffect, useRef, useState } from 'react';

const MermaidDiagram = ({ code }) => {
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const uniqueId = useRef(`mermaid-diagram-${Math.floor(Math.random() * 10000)}-${Date.now()}`);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        let isMounted = true;

        const renderDiagram = async () => {
            if (!containerRef.current || !isMounted) return;

            if (typeof window !== 'undefined' && window.mermaid?.render) {
                try {
                    const { svg } = await window.mermaid.render(uniqueId.current, code);
                    if (isMounted && containerRef.current) {
                        containerRef.current.innerHTML = svg;
                        setIsLoading(false);
                    }
                } catch (err) {
                    console.error(`Mermaid rendering error for ID ${uniqueId.current}:`, err);
                    if (isMounted) {
                        setError(`Diagram Error: ${err.str || err.message || 'Unknown issue'}`);
                        setIsLoading(false);
                        if (containerRef.current) {
                            containerRef.current.innerHTML = `<span class="text-red-500 text-xs">Error rendering diagram.</span>`;
                        }
                    }
                }
            } else {
                console.warn(`Mermaid not ready for ID ${uniqueId.current}. Waiting...`);
                if (isMounted) {
                    setTimeout(renderDiagram, 500); // Retry after a delay
                }
            }
        };

        // Small delay to ensure mermaid is initialized
        const timerId = setTimeout(renderDiagram, 100);

        return () => {
            isMounted = false;
            clearTimeout(timerId);
        };
    }, [code]);

    return (
        <div ref={containerRef} className="mermaid-diagram-output my-4 p-2 text-center min-h-[50px]">
            {isLoading && <p className="text-sm text-gray-500">Rendering Diagram...</p>}
            {error && !isLoading && <span className="text-red-500 text-sm font-mono block p-2 bg-red-100 dark:bg-red-900/30 rounded">{error}</span>}
        </div>
    );
};

export default MermaidDiagram;