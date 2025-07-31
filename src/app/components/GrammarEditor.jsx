'use client';
import React, { useCallback, useMemo, useState, useRef } from "react";
import { createEditor, Range, Transforms, Editor, Text, Node, Path } from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import axios from "axios";

const INITIAL_VALUE = [{ type: "paragraph", children: [{ text: "" }] }];

// Helper to debounce API calls
function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const GrammarEditor = () => {
    const editor = useMemo(() => withReact(createEditor()), []);
    const [value, setValue] = useState(INITIAL_VALUE);
    const [errors, setErrors] = useState([]); // [{offset, length, message, replacements, context}]
    const [selectedError, setSelectedError] = useState(null);
    const [popoverPos, setPopoverPos] = useState(null);

    // Get plain text from editor
    const getText = useCallback(() => {
        return value.map(n => Node.string(n)).join('\n');
    }, [value]);

    // Call LanguageTool API
    const checkGrammar = async (text) => {
        if (!text?.trim()) {
            setErrors([]);
            return;
        }
        try {
            const res = await axios.post(
                "https://api.languagetool.org/v2/check",
                new URLSearchParams({
                    text,
                    language: "en-US"
                })
            );
            setErrors(res.data.matches || []);
        } catch (e) {
            console.error('Grammar check error:', e);
            setErrors([]);
        }
    };

    // Debounced grammar check
    const debouncedCheck = useMemo(() => debounce(checkGrammar, 1200), []);

    // On change, update value and check grammar
    const handleChange = useCallback((newValue) => {
        setValue(newValue);
        const text = newValue.map(n => Node.string(n)).join('\n');
        debouncedCheck(text);
        setSelectedError(null);
        setPopoverPos(null);
    }, [debouncedCheck]);

    // Map LanguageTool error offsets to Slate ranges
    const decorate = useCallback(([node, path]) => {
        const ranges = [];
        if (!Text.isText(node) || !errors.length) return ranges;

        let nodeStart = 0;
        let nodeEnd = 0;

        // Calculate node's start position in the document
        for (const [n, p] of Node.texts(editor)) {
            if (Path.equals(p, path)) {
                nodeEnd = nodeStart + node.text.length;
                break;
            }
            nodeStart += n.text.length;
        }

        // Find errors that overlap with this node
        for (const error of errors) {
            const errorStart = error.offset;
            const errorEnd = error.offset + error.length;

            // Check if error overlaps with this node
            if (errorEnd > nodeStart && errorStart < nodeEnd) {
                const start = Math.max(0, errorStart - nodeStart);
                const end = Math.min(node.text.length, errorEnd - nodeStart);

                if (start !== end) {
                    ranges.push({
                        anchor: { path, offset: start },
                        focus: { path, offset: end },
                        error,
                    });
                }
            }
        }

        return ranges;
    }, [errors, editor]);

    // Render leaf with error decoration
    const renderLeaf = useCallback(({ attributes, children, leaf }) => {
        if (leaf.error) {
            return (
                <span
                    {...attributes}
                    style={{
                        textDecoration: 'underline wavy var(--destructive)',
                        cursor: 'pointer',
                        background: selectedError === leaf.error ? 'var(--accent)' : undefined,
                        position: 'relative'
                    }}
                    data-error={JSON.stringify(leaf.error)}
                    onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setSelectedError(leaf.error);
                        setPopoverPos({
                            top: rect.top - 120,
                            left: rect.left
                        });
                    }}
                >
                    {children}
                </span>
            );
        }
        return <span {...attributes}>{children}</span>;
    }, [selectedError]);

    // Accept suggestion
    const handleAccept = useCallback(() => {
        if (!selectedError?.replacements?.length) return;

        const { offset, length, replacements } = selectedError;
        const replacement = replacements[0].value;

        // Find the leaf containing this error
        let totalOffset = 0;
        let targetPath;

        for (const [node, path] of Node.texts(editor)) {
            const nodeLength = node.text.length;
            if (totalOffset + nodeLength >= offset) {
                targetPath = path;
                break;
            }
            totalOffset += nodeLength;
        }

        if (targetPath) {
            const start = offset - totalOffset;
            const end = start + length;

            Transforms.select(editor, {
                anchor: { path: targetPath, offset: start },
                focus: { path: targetPath, offset: end }
            });
            Transforms.insertText(editor, replacement);
        }

        setSelectedError(null);
        setPopoverPos(null);
    }, [editor, selectedError]);

    // Ignore suggestion
    const handleIgnore = useCallback(() => {
        if (!selectedError) return;
        setErrors(prev => prev.filter(e => e !== selectedError));
        setSelectedError(null);
        setPopoverPos(null);
    }, [selectedError]);

    // Suggestion popover
    const SuggestionPopover = () => {
        if (!selectedError || !popoverPos) return null;
        const { message, replacements } = selectedError;

        return (
            <div
                style={{
                    position: 'fixed',
                    top: popoverPos.top,
                    left: popoverPos.left,
                    zIndex: 9999,
                    background: 'var(--popover)',
                    color: 'var(--popover-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '12px',
                    minWidth: '220px',
                    maxWidth: '320px',
                    pointerEvents: 'auto'
                }}
                onMouseEnter={() => setSelectedError(selectedError)}
                onMouseLeave={(e) => {
                    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
                        setSelectedError(null);
                        setPopoverPos(null);
                    }
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{message}</div>
                {replacements?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>Suggestion: </span>
                        {replacements[0].value}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                    {replacements?.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAccept();
                            }}
                            style={{
                                background: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            Accept
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleIgnore();
                        }}
                        style={{
                            background: 'var(--secondary)',
                            color: 'var(--secondary-foreground)',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Ignore
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'relative',
            minHeight: 300,
            background: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--border)'
        }}>
            <Slate editor={editor} initialValue={INITIAL_VALUE} onChange={handleChange}>
                <Editable
                    decorate={decorate}
                    renderLeaf={renderLeaf}
                    placeholder="Type or paste your text here..."
                    spellCheck={false}
                    style={{
                        minHeight: 180,
                        background: 'var(--card)',
                        color: 'var(--card-foreground)',
                        borderRadius: 6,
                        padding: 12,
                        fontSize: 16,
                        outline: 'none',
                        border: '1px solid var(--border)'
                    }}
                />
            </Slate>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
            }}>
                <SuggestionPopover />
            </div>
            <div style={{
                fontSize: 13,
                color: 'var(--muted-foreground)',
                marginTop: 10
            }}>
                <b>Tip:</b> Errors are underlined. Hover or click to see suggestions. Accept or ignore as you wish.

            </div>
        </div>
    );
};

export default GrammarEditor; 