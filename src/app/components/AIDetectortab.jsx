"use client";

import React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const AIDetectorTab = ({
    inputText,
    outputText,
    isLoading,
    handleInputChange,
    processText,
    copyToClipboard,
    copied
}) => {

    const parseAIOutput = (rawOutput, originalInputText) => {
        if (!rawOutput || typeof rawOutput !== 'string') {
            return { score: null, generalAnalysis: 'No analysis provided or error in output.', lineFeedback: [] };
        }

        const scoreMatch = rawOutput.match(/AI Likeness Score: (\d+)%/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

        let generalAnalysis = "No general analysis provided.";
        const generalAnalysisMatch = rawOutput.match(/General Analysis:\s*([\s\S]*?)(?=Line-specific Feedback:|$)/i);
        if (generalAnalysisMatch && generalAnalysisMatch[1]) {
            generalAnalysis = generalAnalysisMatch[1].trim();
        }

        const lineFeedback = [];
        const lineSpecificFeedbackMatch = rawOutput.match(/Line-specific Feedback:\s*([\s\S]*)/i);

        if (lineSpecificFeedbackMatch && lineSpecificFeedbackMatch[1]) {
            const feedbackBlock = lineSpecificFeedbackMatch[1].trim();
            if (feedbackBlock.toLowerCase() !== "n/a" && feedbackBlock.toLowerCase() !== "no specific lines identified as ai-prone.") {
                const feedbackLines = feedbackBlock.split('\n');
                const inputLines = originalInputText.split('\n'); // Crucial: this is based on actual newlines in input

                feedbackLines.forEach(line => {
                    const match = line.match(/Line (\d+):\s*"([^"]+)"\s*-\s*(.*)/i);
                    if (match) {
                        const lineNumber = parseInt(match[1], 10);
                        const quotedPhrase = match[2];
                        const explanation = match[3];
                        const originalLineText = inputLines[lineNumber - 1] || "Line not found in original input.";
                        lineFeedback.push({ lineNumber, quotedPhrase, explanation, originalLineText });
                    }
                });
            }
        }
        return { score, generalAnalysis, lineFeedback };
    };

    const { score, generalAnalysis, lineFeedback } = parseAIOutput(outputText, inputText);

    const getCircularProgressBarColor = (s) => {
        if (s === null) return 'text-gray-500';
        if (s < 30) return 'text-green-500 dark:text-green-400';
        if (s < 70) return 'text-yellow-500 dark:text-yellow-400';
        return 'text-red-500 dark:text-red-400';
    };

    const colorClass = getCircularProgressBarColor(score);
    const circumference = 2 * Math.PI * 40; // Radius is 40
    const strokeDashoffset = score !== null ? circumference - (score / 100) * circumference : circumference;

    const newButtonTheme = `bg-zinc-800 text-white dark:bg-zinc-700 dark:text-green-300 dark:hover:bg-zinc-200 dark:hover:text-zinc-800 duration-300`;

    return (
        <div className="p-5 bg-zinc-100 dark:bg-zinc-900 rounded-lg rounded-tl-none rounded-tr-none  shadow-md">
            <ResizablePanelGroup
                direction="horizontal"
                className="mt-0 rounded-lg min-h-[400px] md:min-h-[550px]"
            >
                <ResizablePanel defaultSize={70} minSize={40}>
                    <div className="flex flex-col h-full">
                        <textarea
                            className="w-full flex-grow p-3 text-sm text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-600 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 scrollbar-thin"
                            placeholder="Enter your text here to analyze its AI likeness..."
                            value={inputText}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            style={{ height: 'calc(100% - 60px)' }}
                        />
                        <button
                            onClick={() => processText()}
                            disabled={isLoading || !inputText.trim()}
                            className={`w-full mt-2 px-4 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center transition-colors ${newButtonTheme}`}
                        >
                            {isLoading ? ( /* ... loading SVG ... */  <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Analyzing Text...</>) : ("Analyze AI Likeness")}
                        </button>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-zinc-300 dark:bg-zinc-600 w-1 mx-2 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />

                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="flex flex-col h-full">
                        {isLoading && !outputText ? ( /* ... loading placeholder ... */ <div className="flex items-center justify-center h-full p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600"><svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="text-zinc-500 dark:text-zinc-400 ml-3">Analyzing your text...</p></div>
                        ) : outputText ? (
                            <div className="p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 flex flex-col h-full overflow-y-auto scrollbar-thin">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 mb-4">AI Detection Result:</h3>

                                <div className="flex items-center justify-center mb-5"> {/* Circular Progress Bar */}
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10" className="text-zinc-200 dark:text-zinc-600" />
                                            {score !== null && (<circle cx="50" cy="50" r="40" fill="none" strokeWidth="10" stroke="currentColor" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={`transition-all duration-500 ease-in-out ${colorClass}`} />)}
                                        </svg>
                                        <div className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${colorClass}`}>
                                            {score !== null ? `${score}%` : <span className="text-sm text-zinc-500 dark:text-zinc-400">N/A</span>}
                                        </div>
                                    </div>
                                </div>
                                {score !== null && (<p className={`text-center mb-4 text-md font-semibold ${colorClass}`}>AI Likeness Score: {score}%</p>)}

                                <div className="mb-4"> {/* General Analysis */}
                                    <h4 className="text-md font-semibold text-zinc-900 dark:text-zinc-200 mb-1">General Analysis:</h4>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{generalAnalysis}</p>
                                </div>

                                {/* MODIFIED Line-specific Feedback Rendering */}
                                <div>
                                    <h4 className="text-md font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Line-specific Feedback:</h4>
                                    {lineFeedback.length > 0 ? (
                                        <div className="space-y-3 text-sm">
                                            {lineFeedback.map((item, index) => (
                                                <div key={index} className="p-2.5 border border-zinc-200 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-700/50">
                                                    {(() => {
                                                        const isSingleLineInput = inputText.split('\n').length === 1;
                                                        if (item.originalLineText === "Line not found in original input.") {
                                                            return (
                                                                <p className="text-xs text-orange-600 dark:text-orange-400 italic">
                                                                    AI's reported Line {item.lineNumber}: (Context not matched to a distinct line in your input. See AI's specific quote below.)
                                                                </p>
                                                            );
                                                        } else if (isSingleLineInput && item.lineNumber === 1) {
                                                            // For single-line input, item.originalLineText is the entire input.
                                                            // We avoid repeating the whole input here, as the user sees it in the textarea
                                                            // and the AI's specific quote is in the "Insight" part.
                                                            return (
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                                                                    From your single-line input (AI referred to as Line {item.lineNumber}):
                                                                </p>
                                                            );
                                                        } else {
                                                            // Default case: multi-line input and line found & successfully matched
                                                            return (
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                    Line {item.lineNumber}: <em className="text-blue-600 dark:text-blue-400 font-medium break-words">"{item.originalLineText}"</em>
                                                                </p>
                                                            );
                                                        }
                                                    })()}
                                                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                                                        <span className="font-semibold">Insight:</span> "{item.quotedPhrase}" - {item.explanation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {(generalAnalysis && (generalAnalysis.toLowerCase().includes("error") || generalAnalysis.toLowerCase().includes("could not extract text"))) ? "" : "No specific lines identified as particularly AI-prone, or the AI did not provide line-specific feedback in the expected format."}
                                        </p>
                                    )}
                                </div>
                                {/* END OF MODIFIED Line-specific Feedback Rendering */}

                                <button onClick={copyToClipboard} className={`mt-auto sticky bottom-0 bg-white dark:bg-zinc-700 pt-3 px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors self-start ${newButtonTheme}`}>
                                    {copied ? "Copied Full Analysis!" : "Copy Full Analysis"}
                                </button>
                            </div>
                        ) : ( /* ... "Output will appear here" placeholder ... */ <div className="flex items-center justify-center h-full p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600"><p className="text-zinc-500 dark:text-zinc-400">AI analysis output will appear here.</p></div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};

export default AIDetectorTab;