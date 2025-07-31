"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAtom, useAtomValue } from "jotai";
// Removed: import { InferenceClient } from "@huggingface/inference"; // No longer needed
const OpenAI = require("openai"); // Use OpenAI library for Novita API
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import { NOVITA_BASE_URL } from './urls'
import { useRouter } from 'next/navigation'; // Or 'next/router' for older Next.js
import { toast } from "sonner"; // Or your preferred toast library
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';
import { FileTextIcon, Save, FileEdit, RefreshCwIcon } from 'lucide-react';

import {
  file_contents_supabase,
  file_id_supabase,
  activeChat, // Assuming this might be used elsewhere, kept for context
  user_id_supabase, // Needed for usage tracking
} from "../../store/uploadAtoms";
import LoadingSpinner from "./LoadingSpinner";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk";

const baseURL = NOVITA_BASE_URL;
const apiKey = 'sk_TJGzb-mYV9KUKeLJiuIn7wJcYLwR6ZL0KaZCLnCztYo';
const model = "meta-llama/llama-3.3-70b-instruct";
const stream = true; // Set streaming behavior
import RichMarkdown from './RichMarkdown'

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});
import RichMermaidMarkdown from './MermaidRender'; // Adjust path as needed


const MAX_TOKENS_PER_CHUNK_REQUEST = 200000; // Max tokens for Novita request per chunk
const CHARS_PER_TOKEN_ESTIMATE = 4; // Rough estimate of characters per token
// Adjust MAX_CHARS_PER_CHUNK based on a reasonable input size for the request token limit
const MAX_CHARS_PER_CHUNK = (MAX_TOKENS_PER_CHUNK_REQUEST * CHARS_PER_TOKEN_ESTIMATE) * 1; // Target 70% input chars of max request tokens
let genAI; // Initialize outside component to avoid recreation on re-renders

genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

export default function UserNotes() {
  // --- State (mostly unchanged) ---
  const [localNote, setLocalNote] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [error, setError] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const router = useRouter();
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  // Progress tracking for chunked processing
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [partialResults, setPartialResults] = useState([]);

  const isInitialLoadDone = useRef(false);
  const isGeneratingAiNotes = useRef(false);

  // --- Jotai Atoms ---
  const chatId = useAtomValue(activeChat); // Keep if used elsewhere
  const fid = useAtomValue(file_id_supabase);
  const userUuid = useAtomValue(user_id_supabase); // Get user ID
  const [fileContent, setFileContent] = useAtom(file_contents_supabase);

  // --- Derived Data (unchanged) ---
  const rawText = fileContent?.[0]?.raw_text || "";
  const dbAiNotes = fileContent?.[0]?.ai_notes || null;
  const dbUserNotes = fileContent?.[0]?.notes || ""; // Get db user notes for comparison

  // --- Text Chunking Helper Functions (unchanged logic) ---
  const splitTextIntoChunks = useCallback((text, maxChunkSize = MAX_CHARS_PER_CHUNK) => {
    if (!text) return [];

    // If text is small enough, return as single chunk
    // Check against character limit as intended
    if (text.length <= maxChunkSize) {
      console.log(`UserNotes: Text length (${text.length}) is within single chunk limit (${maxChunkSize}).`);
      return [text];
    }


    console.log(`UserNotes: Splitting text (length ${text.length}) into chunks <= ${maxChunkSize} chars.`);
    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      let endPosition = Math.min(currentPosition + maxChunkSize, text.length);

      // Try to find sentence boundary (improved regex for broader cases)
      if (endPosition < text.length) {
        // Look backwards from endPosition for sentence-ending punctuation followed by whitespace
        const sub = text.substring(currentPosition, endPosition);
        let lastSentenceEnd = -1;
        // More robust regex: finds last [.!?] followed by whitespace OR end of substring
        const matches = [...sub.matchAll(/[.!?](\s+|$)/g)];
        if (matches.length > 0) {
          lastSentenceEnd = matches[matches.length - 1].index;
        }


        // Use sentence boundary only if it's reasonably within the latter half of the chunk
        // to avoid tiny chunks if a sentence ends very early.
        if (lastSentenceEnd > maxChunkSize * 0.5) {
          // +1 to include the punctuation itself
          endPosition = currentPosition + lastSentenceEnd + 1;
        }
        // If no suitable sentence end found, just split at maxChunkSize
      }

      chunks.push(text.substring(currentPosition, endPosition).trim()); // Trim whitespace
      currentPosition = endPosition;
      while (currentPosition < text.length && /\s/.test(text[currentPosition])) {
        currentPosition++; // Skip leading whitespace for the next chunk
      }
    }
    console.log(`UserNotes: Split into ${chunks.length} chunks.`);
    return chunks.filter(chunk => chunk.length > 0); // Ensure no empty chunks
  }, []);

  const createPromptForChunk = useCallback((textChunk, isFirstChunk, isLastChunk, previousResults = "", totalChunksForPrompt) => {
    const currentChunkNumber = currentChunk;

    const coreInstructions = `
      **3-Minute Read Format (400-500 words max):**
      - Focus ONLY on essential concepts - eliminate all fluff
      - Create a visual hierarchy for instant comprehension
      - Use visual elements for quick scanning

      **Required Visual Elements:**
      2. **Comparison Table:** At least one concise table with 3-5 rows maximum
      3. **Visual Markers:** ⭐ = critical, 📌 = exam focus, 💡 = insight
      
      **Format Requirements:**
      - Use headings (##, ###) for major sections
      - **Bold** key terms, *italicize* examples
      - Convert complex ideas into simple bullet lists
      - Include real-world analogies in [brackets]

       dont add unncessary text like her e you go or other backticks, the respoe  u r giving me will be direclty vsible to user through a markdown renderer. dont use the word 'chunk' anywhere, make it super user frienfly output and Dont use backtick at anything but only for code showing. Others remain same. Use headline at first with # tag always others ##, ###, dont use bold in heading only in words use that. Make sure to make the markdown format correct!!
      `;

    let prompt = "";

    if (isFirstChunk) {
      prompt = `
      Convert this into a highly visual, scannable 3-minute read (400-500 words):

      ${coreInstructions}

    
      ${textChunk}

    
      dont add unncessary text like her e you go or other backticks, the respoe  u r giving me will be direclty vsible to user through a markdown renderer. dont use the word 'chunk' anywhere, make it super user frienfly output and Dont use backtick at anything but only for code showing. Others remain same
      Then continue with the concise summary:
      `;
    } else {
      prompt = `
      Continue the visual 3-minute summary in the same format. Remember: 400-500 words TOTAL.

      ${coreInstructions}

      Context (previous notes summary):
  
      Chunk ${currentChunkNumber}/${totalChunksForPrompt}:
      ${textChunk}

      Continue the summary with visual elements (maintain brevity - we need to fit everything in 400-500 words total):
      `;

      if (isLastChunk) {
        prompt += `
      Final Elements (keep extremely concise):
      - Update/complete the knowledge tree for all concepts
      - ⭐ 3-5 Critical Exam Points only (one line each)
      - 📌 Quick-reference table (3-4 rows maximum)
      - 💡 1-2 Memorable mnemonics (keep very short)
      - Ensure TOTAL summary is 400-500 words maximum for a 3-minute read
      - Make sure to make the markdown format correct!!
      
      `;
      }
    }

    return prompt;
  }, [currentChunk]);






  // --- Usage Tracking Functions ---
  const getAINotesUsage = useCallback(async () => {
    if (!userUuid) {
      console.error("UserNotes: Cannot check usage, User ID is missing.");
      setError("User information not available. Cannot generate AI notes.");
      return 0; // Block generation if no user ID
    }
    try {
      const { data, error: fetchError } = await supabase
        .from('user_usage')
        .select('ai_notes_count') // Check the correct count
        .eq('user_id', userUuid)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        // Handle case where user might not have a usage record yet
        console.warn("UserNotes: No usage record found for user:", userUuid);
        // Decide default behavior: Allow 1 free note? Or require a record?
        // Let's assume a record is required or default is 0 credits.
        setError("Usage record not found. Cannot generate AI notes.");
        return 0;
      }
      console.log("UserNotes: Fetched AI notes count:", data.ai_notes_count);
      return data.ai_notes_count || 0;
    } catch (err) {
      console.error("UserNotes: Error fetching AI notes usage:", err);
      setError(`Failed to fetch usage data: ${err.message || 'Unknown error'}`);
      return 0; // Block generation on error
    }
  }, [userUuid]); // Depend on userUuid

  const updateAINotesUsage = useCallback(async () => {
    if (!userUuid) {
      console.error("UserNotes: Cannot update usage, User ID is missing.");
      return; // Don't proceed if no user ID
    }
    console.log("UserNotes: Attempting to decrement AI notes count for user:", userUuid);
    try {
      // Fetch current count first to ensure safe decrement
      const { data: currentData, error: fetchError } = await supabase
        .from('user_usage')
        .select('ai_notes_count')
        .eq('user_id', userUuid)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentData) {
        console.error("UserNotes: Cannot decrement usage, user record not found during update attempt.");
        return; // Cannot decrement if record doesn't exist
      }

      const currentCount = currentData.ai_notes_count || 0;
      if (currentCount <= 0) {
        console.warn("UserNotes: Attempted to decrement AI notes usage, but count is already zero or negative.");
        // Optionally clamp to 0 if needed, but don't decrement further.
        return;
      }


      // Proceed with decrement
      // const { data: updatedData, error: updateError } = await supabase
      //   .rpc('decrement_ai_notes_count', { p_user_id: userUuid }); // Using a function is safer

      // Alternative direct update (less safe concurrency-wise):
      const { data: updatedData, error: updateError } = await supabase
        .from('user_usage')
        .update({ ai_notes_count: currentCount - 1 })
        .eq('user_id', userUuid)
        .select('ai_notes_count') // Select the updated count to confirm
        .maybeSingle();


      if (updateError) throw updateError;

      // If using direct update, log the result:
      // console.log(`UserNotes: AI notes count successfully updated for user ${userUuid}. New count: ${updatedData?.ai_notes_count}`);
      // If using RPC function, success is implied if no error is thrown.
      console.log(`UserNotes: AI notes count successfully decremented for user ${userUuid}.`);


    } catch (err) {
      console.error("UserNotes: Error updating AI notes usage in DB:", err);
      // Log the error, but don't necessarily block the user if the notes were generated.
      // Maybe show a subtle warning later if usage count update fails consistently.
      setError(`AI Notes generated, but failed to update usage count: ${err.message}. Please report this if it persists.`);
    }
  }, [userUuid]); // Depend on userUuid


  // --- Fetch file data (unchanged logic, added dependencies) ---
  const fetchFileData = useCallback(async (currentFid) => {
    if (!currentFid) {
      if (fileContent !== null) setFileContent(null); // Clear content if fid becomes null
      setError(null);
      setLocalNote(""); // Clear local note too
      isInitialLoadDone.current = false; // Reset load flag
      return null;
    }

    // Avoid fetching if already fetching or generating notes (could cause state conflicts)
    if (isFetchingData || isGeneratingAiNotes.current) {
      console.log("UserNotes: Skipping fetch because data is already being fetched or AI notes are generating.");
      return fileContent?.[0] ?? null; // Return current state if available
    }


    console.log(`UserNotes: Fetching data for file ID: ${currentFid}`);
    setIsFetchingData(true);
    setError(null); // Clear previous errors on new fetch

    try {
      const { data, error: dbError } = await supabase
        .from("file_data")
        .select("raw_text, notes, ai_notes")
        .eq("file_id", currentFid)
        .maybeSingle();

      if (dbError) throw dbError;

      if (data) {
        // Only update state if fetched data is different from current state
        // Compare relevant fields individually for clarity
        const currentData = fileContent?.[0];
        if (data.raw_text !== currentData?.raw_text || data.notes !== currentData?.notes || data.ai_notes !== currentData?.ai_notes) {
          console.log("UserNotes: File data atom updated.");
          setFileContent([data]);
          // Set localNote only AFTER fetch completes and it's different from current localNote
          // to avoid overwriting user edits during fetch/re-render cycles.
          if (data.notes !== localNote) {
            setLocalNote(data.notes || "");
          }
        } else {
          console.log("UserNotes: Fetched data is the same as current state, no update needed.");
          // Ensure localNote is synced if it somehow diverged but DB didn't
          if (data.notes !== localNote) {
            setLocalNote(data.notes || "");
          }
        }

        return data; // Return fetched data
      } else {
        console.log("UserNotes: No file data found for fid:", currentFid);
        if (fileContent !== null) {
          setFileContent(null);
        }
        setLocalNote(""); // Clear local note if no data found
        return null;
      }
    } catch (error) {
      console.error("UserNotes: Error fetching file data:", error);
      setError(`Failed to load notes data: ${error.message}`);
      if (fileContent !== null) {
        setFileContent(null);
      }
      setLocalNote(""); // Clear local note on error
      return null;
    } finally {
      setIsFetchingData(false);
      // Mark initial load as done *after* the first fetch attempt completes (success or fail)
      if (!isInitialLoadDone.current) {
        isInitialLoadDone.current = true;
      }
    }
  }, [fileContent, setFileContent, localNote, isFetchingData]); // Added localNote, isFetchingData


  // --- Process a single chunk with Novita LLM (Updated) ---
  const processChunkWithLLM = async (chunk, isFirstChunk, isLastChunk, previousResults, totalChunksForPrompt) => {
    // Check Novita client and API Key
    if (!openai) throw new Error("Novita AI client not initialized.");
    if (!apiKey || apiKey === "YOUR_NOVITA_API_KEY") {
      throw new Error("Novita API key is not configured. Please set NEXT_PUBLIC_NOVITA_API_KEY environment variable.")
    }

    const prompt = createPromptForChunk(chunk, isFirstChunk, isLastChunk, previousResults, totalChunksForPrompt);

    console.log(`UserNotes: Requesting AI notes for chunk ${currentChunk} via Novita.ai...`);
    await waitForSlot();

    try {

      const remainingCredits = await getUserActivityUsage('ai_notes');
      if (remainingCredits <= 0) {
        toast("Free limit finished, Buy premium!", {
          description: "For 5.99$ get higher usage limits",
          action: {
            label: "Buy",
            onClick: () => triggerProButtonDialog(),
          },
        })
        // Make sure to stop further execution, e.g., turn off loading state and return
        setLoadingAI(false);
        return;
      }
      setProcessingProgress(50)
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash-lite-preview-06-17", // Ensure this model ID is correct and available
        contents: prompt, // Pass the dynamically created array
      });

      let fullResponse = "";

      if (stream == "dasj1") {
        // Handle streaming response
        console.log(`UserNotes: Receiving stream for chunk ${currentChunk}...`);
        for await (const chunkPiece of completion) {
          const content = chunkPiece.choices[0]?.delta?.content || "";
          fullResponse += content;
          // Optional: Could update a very granular progress indicator here
          if (chunkPiece.choices[0]?.finish_reason) {
            console.log(`UserNotes: Stream finished for chunk ${currentChunk}. Reason: ${chunkPiece.choices[0].finish_reason}`);
          }
        }
      } else {
        // Handle non-streaming response (if stream were false)
        // fullResponse = completion.choices[0]?.message?.content?.trim() || ""; for llama
        fullResponse = result.text;

      }

      if (fullResponse.trim() === "") {
        console.warn(`UserNotes: Novita AI returned an empty response for chunk ${currentChunk}.`);
        // Return empty string, the calling function will handle combining potentially empty results
      }

      console.log(`UserNotes: Received notes for part ${currentChunk} from Novita.ai.`);
      return fullResponse.trim(); // Return the complete content for this chunk

    } catch (error) {
      console.error(`UserNotes: Error processing part ${currentChunk} with Novita AI:`, error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown AI error';
      throw new Error(`Novita LLM processing failed for chunk ${currentChunk}: ${errorMessage}`);
    } finally {
      await releaseSlot()
    }
  }; // Removed dependencies as it uses constants/globals now, or state via createPromptForChunk


  // --- Generate AI Notes with Chunking & Usage Check (Updated) ---
  const generateAiNotes = useCallback(async () => {
    if (isGeneratingAiNotes.current) {
      console.log("UserNotes: AI note generation already in progress");
      return;
    }
    if (!rawText) {
      setError("Cannot generate AI notes: Document text is missing.");
      return;
    }
    // Check Novita client and API Key before checking credits
    if (!openai) {
      setError("AI client not initialized.");
      return;
    }
    if (!apiKey || apiKey === "YOUR_NOVITA_API_KEY") {
      setError("Novita API key is not configured. Cannot generate AI notes.");
      return;
    }
    if (!userUuid) {
      setError("User information not available. Cannot generate AI notes.");
      return;
    }


    setLoadingAI(true);
    setError(null);
    isGeneratingAiNotes.current = true;
    setPartialResults([]); // Clear previous partials
    setProcessingProgress(0);
    setCurrentChunk(0); // Reset chunk counters
    setTotalChunks(0);

    // --- Check Credits FIRST ---
    console.log("UserNotes: Checking AI Notes credits...");
    const availableCredits = await getAINotesUsage();
    if (availableCredits <= 0) {
      setError("Insufficient AI Notes credits remaining.");
      setLoadingAI(false);
      isGeneratingAiNotes.current = false;
      return; // Stop execution
    }
    console.log(`UserNotes: User has ${availableCredits} AI Notes credits. Proceeding.`);
    // --- End Credit Check ---


    console.log("UserNotes: Generating AI notes with chunking via Novita.ai...");
    try {
      const textChunks = splitTextIntoChunks(rawText);
      if (textChunks.length === 0) {
        throw new Error("Failed to split document into processable chunks.");
      }
      setTotalChunks(textChunks.length); // Set total for progress display
      console.log(`UserNotes: Split document into ${textChunks.length} chunks`);

      let combinedResults = "";
      const currentPartialResults = []; // Local accumulation for this run

      for (let i = 0; i < textChunks.length; i++) {
        setCurrentChunk(i + 1); // Update state for prompt generation and UI
        console.log(`UserNotes: Processing chunk ${i + 1} of ${textChunks.length}`);

        const isFirstChunk = i === 0;
        const isLastChunk = i === textChunks.length - 1;

        // Pass the actual total number of chunks to the processing function for prompt context
        const chunkResult = await processChunkWithLLM(
          textChunks[i],
          isFirstChunk,
          isLastChunk,
          combinedResults, // Pass accumulated results so far for context
          textChunks.length // Pass total chunks for prompt
        );


        // Append result if not empty
        if (chunkResult && chunkResult.trim() !== "") {
          combinedResults += (combinedResults ? "\n\n" : "") + chunkResult; // Add separator if needed
          currentPartialResults.push(chunkResult); // Add to temporary array for UI update
          setPartialResults([...currentPartialResults]); // Update state for progressive display
        } else {
          console.warn(`UserNotes: Chunk ${i + 1} resulted in empty notes, skipping append.`);
        }


        // Update progress percentage
        setProcessingProgress(Math.round(((i + 1) / textChunks.length) * 100));


      }

      // Final clean-up (optional, but can help)
      const finalNotes = combinedResults
        .replace(/\n{3,}/g, "\n\n") // Remove excess newlines
        .trim();


      if (finalNotes === "") {
        throw new Error("AI processing resulted in empty notes after combining all chunks.");
      }

      console.log("UserNotes: All chunks processed, saving combined notes.");

      // --- Save the combined notes to the database ---
      await updateFieldInDb('ai_notes', finalNotes);

      // --- Decrement Usage Count ONLY after successful save ---
      // await updateAINotesUsage();
      await decrementUserActivityUsage('ai_notes');

      // Update fileContent atom state
      setFileContent((prev) => prev ? [{ ...prev[0], ai_notes: finalNotes }] : null);

      console.log("UserNotes: AI notes generation complete.");

    } catch (error) {
      console.error("UserNotes: Error in chunked AI notes generation:", error);
      // Display partial results if the error occurred mid-way through chunks
      setError(`Failed to generate AI notes: ${error.message}. ${partialResults.length > 0 ? 'Partial results might be shown.' : ''}`);
    } finally {
      setLoadingAI(false);
      isGeneratingAiNotes.current = false;
      // Keep progress at 100 if successful, otherwise reset? Or just clear.
      // Let's clear them on finally regardless of success/error for next run.
      setProcessingProgress(0);
      setCurrentChunk(0);
      setTotalChunks(0);
      // Keep partialResults displayed if there was an error mid-way?
      // Let's clear it here, error message indicates if partials were generated.
      // setPartialResults([]); // Clear partials on completion/error
    }
  }, [
    rawText,
    userUuid, // Added
    apiKey, // Added
    setFileContent,
    splitTextIntoChunks,
    // Removed createPromptForChunk (uses state now)
    // Removed processChunkWithLLM (uses globals/state now)
    getAINotesUsage, // Added
    updateAINotesUsage, // Added
    // updateFieldInDb, // Added (assuming it's stable or wrapped in useCallback if needed)
    partialResults // Need partialResults if we display them on error
  ]);

  // --- Update Specific Field in DB (wrapped in useCallback for dependency stability) ---
  const updateFieldInDb = useCallback(async (fieldName, newData) => {
    if (!fid) {
      console.error(`UserNotes: Cannot update ${fieldName}, File ID is missing.`);
      // Don't throw here, maybe set an error state
      setError(`Cannot save ${fieldName}: File ID is missing.`);
      return false; // Indicate failure
    }

    console.log(`UserNotes: Updating ${fieldName} in DB for fid: ${fid}`);
    try {
      const { error: updateError } = await supabase
        .from("file_data")
        .update({ [fieldName]: newData })
        .eq("file_id", fid);

      if (updateError) {
        console.error(`UserNotes: Error updating ${fieldName} in DB:`, updateError);
        throw updateError; // Throw to be caught by calling function
      }
      console.log(`UserNotes: ${fieldName} successfully updated in DB.`);
      return true; // Indicate success
    } catch (error) {
      setError(`Failed to save ${fieldName}: ${error.message}`);
      return false; // Indicate failure
    }
  }, [fid]); // Depend only on fid


  // --- Effect to fetch data and potentially auto-generate AI notes ---
  useEffect(() => {
    // Reset state related to generation when fid changes
    setError(null);
    isGeneratingAiNotes.current = false;
    setLoadingAI(false);
    setPartialResults([]);
    setProcessingProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);


    if (fid) {
      // Basic check for API key configuration on mount/fid change
      if ((!apiKey || apiKey === "YOUR_NOVITA_API_KEY")) {
        console.error("UserNotes Effect: Novita API key is missing or placeholder.");
        setError("Novita AI Service is not configured (API Key missing). Cannot generate AI notes.");
        isInitialLoadDone.current = true; // Mark load as done even with config error
        return; // Prevent fetching/generation if key is missing
      }


      fetchFileData(fid).then(fetchedData => {
        // Check if component is still mounted and fid hasn't changed again
        // (this check might be complex, rely on useCallback dependencies for now)

        // Check if initial load marker needs setting (should be handled in fetchFileData finally block now)
        // if (!isInitialLoadDone.current) {
        //    isInitialLoadDone.current = true;
        // }

        // Auto-generate check
        if (fetchedData && !fetchedData.ai_notes && fetchedData.raw_text && !isGeneratingAiNotes.current && !loadingAI) {
          // Ensure API key is okay before auto-triggering
          if (apiKey && apiKey !== "YOUR_NOVITA_API_KEY") {
            console.log("UserNotes Effect: Auto-generating AI notes as none exist and config seems ok.");
            generateAiNotes(); // This now includes the credit check
          } else {
            console.log("UserNotes Effect: Skipping auto-generation due to missing API key.");
            setError("Cannot auto-generate AI notes: Novita API key not configured.");
          }
        } else {
          console.log("UserNotes Effect: Conditions not met for auto-generation.", {
            hasData: !!fetchedData,
            hasAiNotes: !!fetchedData?.ai_notes,
            hasRawText: !!fetchedData?.raw_text,
            isGenerating: isGeneratingAiNotes.current,
            isLoading: loadingAI
          });
        }
      });
    } else {
      // Clear states if fid becomes null
      setLocalNote("");
      setFileContent(null);
      setError(null);
      isInitialLoadDone.current = false; // Reset load flag
    }

    // Cleanup function if needed (e.g., cancel ongoing fetches/generation)
    // return () => { /* cleanup logic */ };

  }, [fid]); // Added apiKey, generateAiNotes, loadingAI


  // --- Save User Notes (Updated) ---
  const saveUserNote = async () => {
    // Prevent saving if initial data hasn't loaded or fid is missing
    if (!isInitialLoadDone.current || !fid) {
      console.warn("UserNotes: Attempted to save before initial load finished or without File ID.");
      setError("Notes are still loading or file not selected, please wait before saving.");
      return;
    }
    // Prevent saving if notes haven't changed from DB version
    if (localNote === dbUserNotes) {
      console.log("UserNotes: No changes detected in user notes. Skipping save.");
      setNoteSaved(true); // Show feedback even if no actual save occurred
      setTimeout(() => setNoteSaved(false), 2000);
      return;
    }


    console.log("UserNotes: Saving user note...");
    setLoadingSave(true);
    setError(null); // Clear previous save errors
    setNoteSaved(false);
    try {
      const success = await updateFieldInDb('notes', localNote); // Use the wrapped function
      if (success) {
        // Update atom state only on successful save
        setFileContent((prev) => prev ? [{ ...prev[0], notes: localNote }] : null);
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 3000);
      } // Error state is handled within updateFieldInDb
    } catch (error) {
      // This catch might be redundant if updateFieldInDb handles setting the error state
      console.error("UserNotes: Unexpected error during saveUserNote:", error);
      setError(`Failed to save note: ${error.message}`);
    } finally {
      setLoadingSave(false);
    }
  };

  // --- Handle Textarea Input (Unchanged) ---
  const handleInputChange = (e) => {
    setLocalNote(e.target.value);
    if (noteSaved) setNoteSaved(false); // Hide "saved" message on new input
  };

  // --- Render Logic (minor adjustments) ---
  // Generate button shown if no AI notes, not loading, text exists, and *user has credits implicitly checked by generateAiNotes*
  const showGenerateButton = !dbAiNotes && !loadingAI && !isFetchingData && rawText && !isGeneratingAiNotes.current && !error?.includes("credits") && !error?.includes("API key");
  const showLoadingIndicator = loadingAI || isFetchingData;
  const showAiNotesContent = (dbAiNotes || partialResults.length > 0) && !isFetchingData; // Show container if we have db notes OR partial results
  const canInteract = fid && !isFetchingData && isInitialLoadDone.current; // Ensure initial load is done for interaction

  // Determine which notes content to display (final DB notes or partial results)
  const displayAiNotes = loadingAI && partialResults.length > 0 ? partialResults.join("\n\n") : dbAiNotes;
  const aiNotesTitle = loadingAI && partialResults.length > 0 ? "AI Generated Notes (In Progress...)" : "AI Generated Notes";

  return (
    <div className="flex flex-col w-full max-h-full bg-gray-100 dark:bg-zinc-900 h-full p-0 overflow-y-scroll scrollbar-hide items-center">

      {/* Loading Indicator with Progress */}
      {showLoadingIndicator && (
        <div className="pt-6 w-full">
          {/* Conditional rendering based on loading type */}
          {loadingAI && ( // Show AI progress only when loading AI
            <div className="flex flex-col items-center">
              <LoadingSpinner message={`Generating AI notes... ${processingProgress > 0 ? `(${processingProgress}%)` : ''}`} />
              {processingProgress > 0 && (
                <div className="w-full max-w-md mt-2 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full dark:bg-indigo-500"
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
              )}
              {currentChunk > 0 && totalChunks > 0 && (
                <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                  Processing part {currentChunk} of {totalChunks}
                </p>
              )}
            </div>
          )}
          {isFetchingData && !loadingAI && ( // Show fetching data only if not already showing AI progress
            <LoadingSpinner message="Loading notes data..." />
          )}
        </div>
      )}

      {/* Error Display */}
      {error && !(loadingAI || loadingSave) && ( // Show error only when not actively loading AI or saving
        <div className="text-red-500 dark:text-red-400 my-3 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-300 dark:border-red-700 rounded-md w-full text-center">
          <p>{error}</p>
          {/* Retry AI Generation Button */}
          {(error.includes("generate AI notes") || error.includes("LLM processing failed")) && rawText && !error.toLowerCase().includes("credits") && !error.toLowerCase().includes("api key") && (
            <button
              onClick={generateAiNotes}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={loadingAI || isGeneratingAiNotes.current}
            >
              Retry AI Generation
            </button>
          )}
          {/* Retry Save Button */}
          {(error.includes("save note") || error.includes("Failed to save")) && (
            <button
              onClick={saveUserNote}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={loadingSave}
            >
              Retry Save
            </button>
          )}
          {/* API Key Configuration Message */}
          {error.toLowerCase().includes("api key") && (
            <p className="mt-2 text-sm">Please configure the Novita API key correctly.</p>
          )}
          {/* Insufficient Credits Message */}
          {error.toLowerCase().includes("credits") && (
            <p className="mt-2 text-sm">Please check your AI Notes credit balance.</p>
          )}
        </div>
      )}


      {/* AI Notes Section or Generate Button */}
      <div className={`flex-col flex w-full md:min-h-11/12 min-h-11/12 relative mb-4 ${!canInteract && !showLoadingIndicator ? 'opacity-50' : ''}`}>
        {/* Placeholder/Generate Button Area */}
        {!showAiNotesContent && !loadingAI && ( // Only show this area if no AI notes content is ready and not loading AI
          <div className="absolute inset-0 flex items-center justify-center">
            {showGenerateButton && canInteract && (
              <button
                onClick={generateAiNotes}
                className="text-white px-6 py-3 text-xl rounded-lg hover:bg-indigo-500 bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-200 hover:dark:bg-zinc-800 dark:text-zinc-900 hover:dark:text-zinc-100 duration-300 transform flex flex-col items-center"
                disabled={!rawText || loadingAI || isFetchingData || isGeneratingAiNotes.current}
              >
                <FileEdit size={80} className="mx-auto my-3" />
                Generate AI Notes
              </button>
            )}
            {!rawText && !isFetchingData && !error && !fid && (
              <div className="text-center text-gray-500 dark:text-gray-400">
                <FileEdit size={80} className="mx-auto my-3 opacity-50" />
                <p>Upload or select a document to take notes.</p>
              </div>
            )}
            {/* Add a placeholder if text exists but notes don't and button isn't shown (e.g., due to error) */}
            {!showGenerateButton && rawText && !dbAiNotes && !loadingAI && error && (
              <div className="text-center text-gray-500 dark:text-gray-400">
                <FileEdit size={80} className="mx-auto my-3 opacity-50" />
                <p>AI Notes could not be generated.</p>
                <p className="text-sm">({error})</p>
              </div>
            )}
          </div>
        )}
        {showAiNotesContent && <button onClick={() => generateAiNotes()} className="px-4 py-2  flex flex-row items-center justify-center gap-2 absolute transform right-5 rounded-lg -top-0 pt-2 z-40 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white bg-blue-400 dark:text-zinc-200">
          <RefreshCwIcon size={15} />REGENERATE</button>}
        {/* Display AI Generated Notes Container */}
        {showAiNotesContent && (
          <div className=" p-4 border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-zinc-200 shadow-md overflow-y-auto  w-full h-full scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-200 dark:scrollbar-track-zinc-800 break-words markdown-summar fade-in-summary">
            {/* <h3 className="text-lg font-semibold mb-2 border-b dark:border-zinc-600 pb-1 sticky top-0 bg-white dark:bg-zinc-800 z-10">
              {aiNotesTitle}
            </h3> */}

            <RichMarkdown mark={displayAiNotes} />
          </div>
        )}
      </div>


      {/* User Notes Section */}
      <div className={`flex flex-col flex-grow-[1] w-full min-h-[220px] ${!canInteract && !showLoadingIndicator ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-lg font-semibold mb-2 dark:text-zinc-200 text-black">My Notes</h3>
        <textarea
          className="w-full flex-grow p-3 border-2 dark:border-zinc-600 text-black dark:text-zinc-200 bg-white dark:bg-zinc-800 rounded-md outline-indigo-500 resize-none mb-2 disabled:opacity-70"
          placeholder={!fid ? "Select a document first" : !isInitialLoadDone.current ? "Loading notes..." : "Add your personal notes here..."}
          value={localNote}
          onChange={handleInputChange}
          style={{ direction: "ltr", textAlign: "left" }}
          disabled={!canInteract || loadingSave} // Disable if cannot interact or currently saving
        />
        <div className="flex justify-end items-center">
          {noteSaved && (
            <p className="text-green-600 dark:text-green-400 mr-4 text-sm transition-opacity duration-300">Note saved!</p>
          )}
          <button
            onClick={saveUserNote}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-semibold dark:bg-zinc-200 hover:dark:bg-zinc-900 dark:text-zinc-900 hover:dark:text-zinc-100 duration-300 transform flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            // Disable if cannot interact, loading save, or notes haven't changed
            disabled={!canInteract || loadingSave}
          >
            {loadingSave ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Save Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}