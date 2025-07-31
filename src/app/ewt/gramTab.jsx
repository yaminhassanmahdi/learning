// components/gramTab.jsx
"use client";

import React, { useState, useEffect } from 'react';
// Assuming createUserContent is correctly imported and used in your main file.
// If GoogleGenAI SDK structure is different, adjust this import accordingly.
import { createUserContent } from "@google/genai"; // Or your specific import if different

// Replicating languageOptions here for constructing the prompt.
// Ideally, this would come from a shared constants file.
const languageOptions = [
    { value: 'en-US', label: 'US English' },
    { value: 'en-GB', label: 'British English' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    // Add other languages as needed, consistent with your main EWTPage.jsx
];

const GrammarCorrectorTab = ({ genAI, currentLanguage }) => {
    const [textToCorrect, setTextToCorrect] = useState('');
    const [correctedTextOutput, setCorrectedTextOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // Clear output when language changes
    useEffect(() => {
        setCorrectedTextOutput('');
        setError('');
    }, [currentLanguage]);

    const handleInputChange = (e) => {
        setTextToCorrect(e.target.value);
    };

    const handleGrammarCheck = async () => {
        if (!textToCorrect.trim()) {
            setError("Please enter some text to correct.");
            setCorrectedTextOutput('');
            return;
        }

        setIsLoading(true);
        setCorrectedTextOutput('');
        setError('');

        const selectedLanguageOption = languageOptions.find(option => option.value === currentLanguage);
        const languageLabel = selectedLanguageOption ? selectedLanguageOption.label : 'English'; // Default to English

        const prompt = `Correct the grammar and spelling of the following text according to ${languageLabel} conventions. Return only the corrected text, without any introductory phrases, option numbering, explanations, or conversational filler. If no corrections are needed, return the original text.

Original Text:
${textToCorrect}`;

        try {
            // Using the genAI instance and createUserContent passed from the parent
            const result = await genAI.models.generateContent({
                model: "gemini-2.5-flash", // Ensure this model supports grammar correction well
                contents: createUserContent(prompt),
                // generationConfig: { // Optional: if you need to configure temperature, etc.
                //   temperature: 0.7,
                // },
            });

            let output = "";
            // Consistent response parsing with your main callAiModel function
            if (result.response && typeof result.response.text === 'function') {
                output = await result.response.text();
            } else if (result.response && result.response.candidates && result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts[0].text) {
                output = result.response.candidates[0].content.parts[0].text;
            } else {
                console.warn("Unexpected AI response structure in GrammarCorrectorTab:", result);
                throw new Error("Could not extract text from AI response.");
            }

            setCorrectedTextOutput(output.trim());

        } catch (err) {
            console.error("Error calling Gemini API for grammar correction:", err);
            let errorMessage = "An error occurred while correcting grammar.";
            if (err.message) {
                if (err.message.includes("API key not valid")) {
                    errorMessage = "Error: The API key is not valid. Please check your API key configuration.";
                } else if (err.message.includes("quota")) {
                    errorMessage = "Error: API quota exceeded. Please try again later.";
                } else if (err.message.toUpperCase().includes("SAFETY")) {
                    errorMessage = "Error: Request blocked due to safety concerns. Please revise your input.";
                } else if (err.message.includes("Could not extract text")) {
                    errorMessage = "Error: Received an unexpected response from the AI. Please try again."
                } else {
                    errorMessage = `An error occurred: ${err.message}. Please try again.`;
                }
            }
            setError(errorMessage);
            setCorrectedTextOutput('');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (correctedTextOutput) {
            navigator.clipboard.writeText(correctedTextOutput).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.error('Failed to copy corrected text: ', err);
                setError("Failed to copy text. Clipboard permissions might be needed or an error occurred.");
            });
        }
    };

    const newButtonTheme = `bg-zinc-800 text-white dark:bg-zinc-700 dark:text-green-300 dark:hover:bg-zinc-200 dark:hover:text-zinc-800 duration-300`;

    return (
        <div className="space-y-6 mt-4">
            <div>
                <label htmlFor="textToCorrect" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Enter text to check:
                </label>
                <textarea
                    id="textToCorrect"
                    className="w-full h-40 p-3 text-sm text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-600 resize-none placeholder-zinc-400 dark:placeholder-zinc-500"
                    placeholder="Type or paste your text here..."
                    value={textToCorrect}
                    onChange={handleInputChange}
                    disabled={isLoading}
                />
            </div>

            <button
                onClick={handleGrammarCheck}
                disabled={isLoading || !textToCorrect.trim()}
                className={`w-full px-4 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center transition-colors ${newButtonTheme}`}
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Checking Grammar...
                    </>
                ) : (
                    "Correct Grammar"
                )}
            </button>

            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-700 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-200 text-sm">
                    <p>{error}</p>
                </div>
            )}

            {correctedTextOutput && !error && (
                <div className="p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[150px] flex flex-col">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Corrected Text:</h3>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 flex-grow">{correctedTextOutput}</p>
                    <button
                        onClick={copyToClipboard}
                        className={`mt-4 px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors self-start ${newButtonTheme}`}
                    >
                        {copied ? "Copied!" : "Copy Corrected Text"}
                    </button>
                </div>
            )}

            {!isLoading && !correctedTextOutput && !error && (
                <div className="flex items-center justify-center p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[150px]">
                    <p className="text-zinc-500 dark:text-zinc-400">The corrected text will appear here.</p>
                </div>
            )}
            {isLoading && !correctedTextOutput && !error && (
                <div className="flex items-center justify-center p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[150px]">
                    <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-zinc-500 dark:text-zinc-400 ml-3">Loading corrected text...</p>
                </div>
            )}
        </div>
    );
};

export default GrammarCorrectorTab;