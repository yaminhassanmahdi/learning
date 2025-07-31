'use client';
import { atom, useAtom, useAtomValue } from "jotai";

import { useState } from 'react';
import { fileAtom, textAtom, fileNameAtom } from '../../store/uploadAtoms'
const cmd_for_llm = 'You are a professional summarizer. Given an essay, generate a 4-5 sentence summary in HTML format with proper formatting.\n\nAfter the summary, add ---- as a separator.\n\nThen, generate a 5-question quiz in JSON format, where each question has:\n- \"question\": The quiz question\n- \"options\": A list of 4 answer choices\n- \"correctAnswer\": The correct option\n- \"difficulty\": \"Easy\", \"Medium\", or \"Hard\"\n\nExample format:\n[\n  { \"question\": \"What is the capital of France?\", \"options\": [\"Paris\", \"London\", \"Berlin\", \"Madrid\"], \"correctAnswer\": \"Paris\", \"difficulty\": \"Easy\" }\n]\n\nAfter the quiz, add ---- as a separator.\n\nFinally, generate 5 flashcards with clear and concise information.'
export default function StoryGenerator() {
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const textContent = useAtomValue(textAtom);


    async function run(input) {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch('/api/generate', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(input),
            });

            if (!res.ok) {
                console.log(res.status)
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const result = await res.json();
            console.log("API response:", result);
            return result;
        } catch (err) {
            setError(`An error occurred: ${err.message}`);
            console.error("Error fetching API:", err);
            return null;
        } finally {
            setLoading(false);
        }
    }

    const handleGenerateStory = async () => {
        const result = await run({
            messages: [
                {
                    role: "system",
                    content: cmd_for_llm,
                },
                {
                    role: "user",
                    content: textContent,
                },
            ],
        });

        if (result && result.length > 0 && result[0].response.response) {
            setResponse(result[0].response.response);
        } else {
            console.log(result)
            setError("No valid response received.");
        }
    };

    return (
        <div className="flex flex-col items-center w-full min-h-screen bg-slate-200 text-slate-900 p-6">
            <h1 className="text-2xl font-bold mb-6">Story Summary Generator</h1>
            <button
                onClick={handleGenerateStory}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
            >
                {loading ? 'Generating...' : 'Generate Story Summary'}
            </button>

            {error && <p className="text-red-500 mt-4">{error}</p>}
            {response && (
                <div className="mt-4 p-4 bg-white rounded-lg shadow-md w-full max-w-xl">
                    <h3 className="font-semibold mb-2">Generated Story Summary:</h3>
                    <p className="italic">{response}</p>
                </div>
            )}
        </div>
    );
}