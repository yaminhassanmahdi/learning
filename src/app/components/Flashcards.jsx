"use client";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { LibraryBig, ArrowLeft, ArrowRight, Layers } from "lucide-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { InferenceClient } from "@huggingface/inference";
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import { NOVITA_BASE_URL } from './urls'

import {
  flashCardsState,
  file_contents_supabase,
  file_id_supabase,
  activeChat
} from "../../store/uploadAtoms";
import { supabase } from "../lib/supabaseClient";
import LoadingSpinner from "./LoadingSpinner";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // Replace with your actual key or env var
import { useRouter } from 'next/navigation';        // Or 'next/router'
import { toast } from "sonner";                       // Or your preferred toast library
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';
// Initialize HF Client
const OpenAI = require("openai");

// Novita.ai Configuration
const baseURL = NOVITA_BASE_URL;
const apiKey = "sk_TJGzb-mYV9KUKeLJiuIn7wJcYLwR6ZL0KaZCLnCztYo";
const model = "meta-llama/llama-3.1-8b-instruct";

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});
// Constants for chunking
const MAX_CHUNK_SIZE = 300000; // Characters per chunk, leaving room for prompt
const MIN_CARDS_PER_CHUNK = 8; // Minimum flashcards expected per chunk
let genAI; // Initialize outside component to avoid recreation on re-renders

genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

// --- Main Flashcards Component ---
export default function Flashcards() {
  // --- State ---
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0); // Track progress %
  const [error, setError] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [generatedChunks, setGeneratedChunks] = useState([]); // Store partial results
  const router = useRouter(); // For navigation in toast
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  // --- Jotai Atoms ---
  const chatId = useAtomValue(activeChat);
  const fid = useAtomValue(file_id_supabase);
  const [flashcards, setFlashCards] = useAtom(flashCardsState);
  const [fileContent, setFileContent] = useAtom(file_contents_supabase);

  // --- Derived Data ---
  const rawText = fileContent?.[0]?.raw_text || "";
  const dbFlashcards = fileContent?.[0]?.flashcards || null;

  // --- Fetch Flashcards Data ---
  const fetchFileData = useCallback(async () => {
    if (!fid) {
      setFlashCards(null);
      setFileContent(null);
      setError(null);
      setCurrentCardIndex(0);
      return;
    }

    console.log(`Flashcards: Fetching data for file ID: ${fid}`);
    setIsFetchingData(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from("file_data")
        .select("raw_text, flashcards")
        .eq("file_id", fid)
        .maybeSingle();

      if (dbError) throw dbError;

      if (data) {
        // Check if data differs before setting state
        const currentDataString = JSON.stringify({ raw_text: data.raw_text, flashcards: data.flashcards });
        // console.log("Flashcards ---> ", data.flashcards)
        if (data.flashcards === '[]') {
          generateFlashcards()
          return;
        }
        const previousDataString = JSON.stringify(fileContent?.[0]);

        if (currentDataString !== previousDataString) {
          setFileContent([data]);

          // Attempt to parse flashcards if they exist
          let parsedFlashcards = null;
          if (data.flashcards) {
            if (typeof data.flashcards === 'string') {
              try { parsedFlashcards = JSON.parse(data.flashcards); } catch (e) { console.error("Failed to parse flashcards string:", e); }
            } else if (Array.isArray(data.flashcards)) {
              parsedFlashcards = data.flashcards;
            }
          }

          // Ensure flashcards state matches parsed data
          if (JSON.stringify(flashcards) !== JSON.stringify(parsedFlashcards)) {
            setFlashCards(parsedFlashcards);
          }

          console.log("Flashcards: File data updated.");
          setCurrentCardIndex(0);
        } else {
          // If content is same, still ensure flashcards state matches DB
          let parsedDbFlashcards = null;
          if (data.flashcards) {
            if (typeof data.flashcards === 'string') {
              try { parsedDbFlashcards = JSON.parse(data.flashcards); } catch (e) { /* ignore parse error */ }
            } else if (Array.isArray(data.flashcards)) {
              parsedDbFlashcards = data.flashcards;
            }
          }
          if (JSON.stringify(flashcards) !== JSON.stringify(parsedDbFlashcards)) {
            setFlashCards(parsedDbFlashcards);
          }
        }

      } else {
        console.log("Flashcards: No file data found for fid:", fid);
        setFileContent(null);
        setFlashCards(null);
        setCurrentCardIndex(0);
      }
    } catch (error) {
      console.error("Flashcards: Error fetching file data:", error);
      setError(`Failed to load flashcards data: ${error.message}`);
      setFileContent(null);
      setFlashCards(null);
      setCurrentCardIndex(0);
    } finally {
      setIsFetchingData(false);
    }
  }, [fid, setFileContent, setFlashCards, fileContent, flashcards]);

  // --- Effect to Fetch Data ---
  useEffect(() => {
    if (showGenerateButton && canInteract) {
      generateFlashcards();
    }
    fetchFileData();
  }, [fetchFileData]);

  // --- Update Flashcards in DB ---
  const updateFlashcardsInDb = async (newFlashcardsData) => {
    if (!fid) {
      console.error("Flashcards: Cannot update, File ID is missing.");
      throw new Error("File ID not available.");
    }

    console.log(`Flashcards: Updating flashcards in DB for fid: ${fid}`);
    const dataToStore = typeof newFlashcardsData === 'string' ? newFlashcardsData : JSON.stringify(newFlashcardsData);

    const { error: updateError } = await supabase
      .from("file_data")
      .update({ flashcards: dataToStore })
      .eq("file_id", fid);

    if (updateError) {
      console.error("Flashcards: Error updating DB:", updateError);
      throw updateError;
    }
    console.log("Flashcards: Flashcards successfully updated in DB.");
  };

  // --- New Helper: Split text into chunks ---
  const splitTextIntoChunks = (text, maxChunkSize = MAX_CHUNK_SIZE) => {
    // Split on paragraph or sentence boundaries to keep chunks contextually coherent
    const chunks = [];

    // First try to split by paragraphs
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = "";
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // If chunks are still too large, further split by sentences
    const result = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        result.push(chunk);
      } else {
        // Split by sentences and rebuild chunks
        const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
        let subChunk = "";

        for (const sentence of sentences) {
          if (subChunk.length + sentence.length > maxChunkSize && subChunk.length > 0) {
            result.push(subChunk);
            subChunk = sentence;
          } else {
            subChunk += sentence;
          }
        }

        if (subChunk) {
          result.push(subChunk);
        }
      }
    }

    console.log(`Flashcards: Split text into ${result.length} chunks`);
    return result;
  };

  // --- New Helper: Parse AI Response ---
  const parseAIResponse = (responseContent) => {
    if (!responseContent) return null;

    // Try to extract JSON array string
    const jsonMatch = responseContent.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch && jsonMatch[0]) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Basic validation
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0].q || !parsed[0].ans) {
          throw new Error("Parsed JSON is not a valid flashcard array");
        }

        return parsed;
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        return null;
      }
    }

    return null;
  };

  // --- Generate Flashcards using AI with chunking ---
  const generateFlashcards = async () => {
    if (!rawText) {
      setError("Cannot generate flashcards: Document text is missing.");
      return;
    }
    if (!openai) {
      setError("AI client not initialized. Check API Key.");
      return;
    }

    console.log("Flashcards: Generating flashcards via AI with chunking...");
    setLoading(true);
    setError(null);
    setCurrentCardIndex(0);
    setGeneratedChunks([]);
    setGenerationProgress(0);
    const remainingCredits = await getUserActivityUsage('flashcard');
    if (remainingCredits <= 0) {
      toast("Free limit finished, Buy premium!", {
        description: "For $4.99 get higher usage limits",
        action: {
          label: "Buy",
          onClick: () => triggerProButtonDialog(),
        },
      });
      setError("Insufficient flashcard credits remaining.");
      setLoading(false);
      return; // Stop execution
    }
    try {
      // Split text into manageable chunks
      const textChunks = splitTextIntoChunks(rawText);
      const totalChunks = textChunks.length;

      // Calculate max chunks to process for a reasonable number of flashcards
      // For example, aim for 15-20 total flashcards
      const maxChunksToProcess = Math.min(
        totalChunks,
        Math.ceil(20 / MIN_CARDS_PER_CHUNK)
      );

      // Select chunks - prioritize beginning, middle, and end sections for better coverage
      const chunksToProcess = selectRepresentativeChunks(textChunks, maxChunksToProcess);

      console.log(`Flashcards: Processing ${chunksToProcess.length} of ${totalChunks} chunks`);

      // Process chunks and collect results
      const allFlashcards = [];

      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunk = chunksToProcess[i];

        // Update progress
        setGenerationProgress(Math.floor((i / chunksToProcess.length) * 100));

        // Generate flashcards for this chunk
        const cardsPerChunk = Math.ceil(15 / chunksToProcess.length); // Distribute cards across chunks
        const chunkCards = await generateFlashcardsForChunk(chunk, cardsPerChunk);

        if (chunkCards && chunkCards.length > 0) {
          // Add to running total
          allFlashcards.push(...chunkCards);

          // Update chunk state for UI feedback
          setGeneratedChunks(prev => [...prev, chunkCards]);

          // If we have enough cards already, stop processing
          if (allFlashcards.length >= 15) {
            console.log(`Flashcards: Reached target card count (${allFlashcards.length}), stopping generation`);
            break;
          }
        }
      }

      // Deduplicate flashcards by question
      const uniqueFlashcards = removeDuplicateFlashcards(allFlashcards);
      console.log(`Flashcards: Generated ${uniqueFlashcards.length} unique flashcards`);

      // Update progress to 100%
      setGenerationProgress(100);

      // Store final results
      await updateFlashcardsInDb(uniqueFlashcards);
      setFlashCards(uniqueFlashcards);
      setFileContent((prev) => prev ? [{ ...prev[0], flashcards: uniqueFlashcards }] : null);

    } catch (error) {
      console.error("Flashcards: Error generating or updating flashcards:", error);
      setError(`Failed to generate flashcards: ${error.message}`);
      setFlashCards(null);
    } finally {
      setLoading(false);
      setGenerationProgress(0);
      setGeneratedChunks([]);
    }
  };

  // --- Helper: Select representative chunks ---
  const selectRepresentativeChunks = (chunks, maxChunks) => {
    if (chunks.length <= maxChunks) return chunks;

    const selected = [];

    // Always include first chunk
    selected.push(chunks[0]);

    // If we need more than 2 chunks, select some from the middle
    if (maxChunks > 2) {
      const middleChunksCount = maxChunks - 2; // Minus first and last
      const step = Math.floor(chunks.length / (middleChunksCount + 1));

      for (let i = 1; i <= middleChunksCount; i++) {
        const index = Math.min(i * step, chunks.length - 2);
        selected.push(chunks[index]);
      }
    }

    // Always include last chunk if we have more than 1 chunk to select
    if (maxChunks > 1) {
      selected.push(chunks[chunks.length - 1]);
    }

    return selected;
  };

  // --- Helper: Generate flashcards for a single chunk ---
  const generateFlashcardsForChunk = async (chunk, targetCardCount) => {
    const prompt = `
      Based on the following text, generate 20-25 high-quality flashcards. Each flashcard must be a JSON object with a 'q' (question) and an 'ans' (answer).

        **Instructions:**
        1.  **Question Focus:** Generate questions targeting the *core concepts, arguments, definitions, or significance* presented in the text. Ask "why" or "what is the importance of" rather than just "what is".
        2.  **Avoid Triviality:** Do NOT create questions about basic facts merely mentioned incidentally (e.g., if a city is named, don't ask for its country unless the text *discusses* that relationship). Focus on what the text *explains* or *argues*.
        3.  **Answer Conciseness:** Answers should be brief and directly extracted or synthesized from the text (a few words to a short phrase).
        4.  **Output Format:** Return ONLY a valid JSON array of objects. Do not include any introductory text or explanations.

        **Example Format (Content style is illustrative):**
        [{"q": "What is the primary *purpose* of the process described?", "ans": "To achieve X outcome"}, {"q": "According to the text, what is the main *implication* of finding Y?", "ans": "Challenges theory Z"}]

        **Text:**
        ---
        ${chunk}
        ---
        **JSON Array:**
    `;
    await waitForSlot()
    try {

      let fullResponse = "";

      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash", // Ensure this model ID is correct and available
        contents: createUserContent(prompt), // Pass the dynamically created array
      });

      fullResponse = result.text;

      const responseContent = fullResponse.trim();
      const parsedFlashcards = parseAIResponse(responseContent);

      return parsedFlashcards || [];
    } catch (error) {
      console.error("Error generating flashcards for chunk:", error);
      return []; // Return empty array on error to continue processing
    } finally {
      await releaseSlot()
    }
  };

  // --- Helper: Remove duplicate flashcards ---
  const removeDuplicateFlashcards = (flashcards) => {
    const seen = new Set();
    return flashcards.filter(card => {
      // Normalize question text for comparison
      const normalizedQ = card.q.toLowerCase().trim();
      if (seen.has(normalizedQ)) return false;
      seen.add(normalizedQ);
      return true;
    });
  };

  // --- Navigation ---
  const nextCard = () => {
    if (flashcards && currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // --- Render Logic ---
  const showGenerateButton = !flashcards && !loading && !isFetchingData && rawText;
  const showLoadingIndicator = loading || isFetchingData;
  const showFlashcardDeck = flashcards && Array.isArray(flashcards) && flashcards.length > 0 && !loading && !isFetchingData;
  const canInteract = fid && !isFetchingData;

  return (
    <div className="flex flex-col dark:bg-zinc-900 bg-gray-100 min-h-full h-full w-full items-center justify-center p-4 overflow-hidden">

      {/* Enhanced Loading Indicator with Progress */}
      {showLoadingIndicator && (
        <div className="flex flex-col items-center justify-center">
          <LoadingSpinner message={loading ? `Generating flashcards... ${generationProgress > 0 ? `(${generationProgress}%)` : ''}` : "Loading flashcards..."} />

          {/* Progress bar for generation */}
          {loading && generationProgress > 0 && (
            <div className="w-full max-w-md mt-3 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
          )}

          {/* Show count of generated cards so far */}
          {loading && generatedChunks.length > 0 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Generated {generatedChunks.flat().length} flashcards so far...
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && !loading && (
        <div className="text-red-500 dark:text-red-400 my-3 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-300 dark:border-red-700 rounded-md w-full max-w-lg text-center">
          <p>{error}</p>
          {error.includes("generate") && rawText && (
            <button
              onClick={generateFlashcards}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={loading}
            >
              Retry Generation
            </button>
          )}
        </div>
      )}

      {/* Generate Button */}
      {showGenerateButton && canInteract && (
        <button
          onClick={generateFlashcards}
          className="text-white px-8 py-4 rounded-lg hover:bg-indigo-500 bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed mx-auto mb-5 text-2xl dark:bg-zinc-200 hover:dark:bg-zinc-800 dark:text-zinc-900 hover:dark:text-zinc-100 duration-300 transform flex flex-col items-center"
          disabled={!rawText || loading || isFetchingData}
        >
          <Layers size={100} className="mx-auto my-3" />
          Generate Flashcards
        </button>
      )}

      {/* Placeholder when no text */}
      {!rawText && !isFetchingData && !error && (
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Layers size={100} className="mx-auto my-3 opacity-50" />
          <p>No document text found to generate flashcards from.</p>
        </div>
      )}

      {/* Placeholder when no flashcards generated yet but text exists */}
      {rawText && !flashcards && !loading && !isFetchingData && !error && !showGenerateButton && (
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Layers size={100} className="mx-auto my-3 opacity-50" />
          <p>Generate flashcards from the document text.</p>
          <button
            onClick={generateFlashcards}
            className="mt-3 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            disabled={loading}
          >
            Generate Now
          </button>
        </div>
      )}

      {/* Flashcard Deck */}
      {showFlashcardDeck && canInteract && (
        <>
          <FlashcardIndividual
            question={flashcards[currentCardIndex]?.q || "Error: Question missing"}
            answer={flashcards[currentCardIndex]?.ans || "Error: Answer missing"}
            key={currentCardIndex}
          />

          {/* Navigation Controls */}
          <div className="flex w-full max-w-sm justify-between items-center mt-5">
            <button
              onClick={prevCard}
              disabled={currentCardIndex === 0}
              className="px-4 py-2 text-lg text-gray-700 hover:text-gray-900 dark:text-zinc-300 hover:dark:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
            >
              <ArrowLeft size={20} className="mr-1" /> Previous
            </button>

            <div className="text-lg mx-auto text-gray-800 dark:text-zinc-200 font-medium">
              {currentCardIndex + 1} / {flashcards.length}
            </div>

            <button
              onClick={nextCard}
              disabled={currentCardIndex >= flashcards.length - 1}
              className="px-4 py-2 text-lg text-gray-700 hover:text-gray-900 dark:text-zinc-300 hover:dark:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
            >
              Next <ArrowRight size={20} className="ml-1" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Individual Flashcard Component (No logic changes needed) ---
function FlashcardIndividual({ question, answer }) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip state when question/answer changes
  useEffect(() => {
    setFlipped(false);
  }, [question, answer]);

  return (
    <div
      className="relative flex flex-col w-[95%] sm:w-[90%] md:w-[80%] lg:w-[80%] aspect-[4/4] md:aspect-[16/9] mx-auto mb-5 cursor-pointer group perspective"
      onClick={() => setFlipped(!flipped)}
    >
      <motion.div
        className="relative w-full h-full transition-transform duration-500 text-center preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Front Side (Question) */}
        <div
          className="absolute w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 dark:text-zinc-200 font-semibold text-lg rounded-xl shadow-lg text-slate-900 p-5 backface-hidden"
        >
          <p className="max-h-full overflow-y-auto p-2">{question}</p>
        </div>

        {/* Back Side (Answer) */}
        <div
          className="absolute w-full h-full flex items-center justify-center bg-emerald-400 dark:bg-emerald-400 text-white font-bold text-xl rounded-xl shadow-lg p-5 backface-hidden rotate-y-180"
        >
          <p className="max-h-full overflow-y-auto p-2">{answer}</p>
        </div>
      </motion.div>
    </div>
  );
}

// Add these CSS utility classes to your global CSS if they don't exist:
/*
.perspective { perspective: 1000px; }
.preserve-3d { transform-style: preserve-3d; }
.backface-hidden { backface-visibility: hidden; }
.rotate-y-180 { transform: rotateY(180deg); }
*/