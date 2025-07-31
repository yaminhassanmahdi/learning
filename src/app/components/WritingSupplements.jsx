"use client";

import { useState, useEffect, useCallback, useMemo } from "react"; // --- MODIFIED --- Added useMemo
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { releaseSlot, waitForSlot } from '../lib/redisClient'

import { InferenceClient } from "@huggingface/inference";
import { supabase } from "../lib/supabaseClient";
import { useAtomValue } from "jotai";
import { user_id_supabase, writing_chat_id_supabase } from "../../store/uploadAtoms";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import LoadingSpinner from "./LoadingSpinner";
// --- NEW --- Import Recharts components
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Import React Icons ---
import { FaSpellCheck } from 'react-icons/fa';
import { TbArrowsShuffle, TbAnalyze, TbMoodEdit } from 'react-icons/tb';
import { IoSend, IoWarningOutline, IoCloseCircleOutline, IoTimerOutline } from 'react-icons/io5'; // --- MODIFIED --- Added IoTimerOutline

// Initialize HF Client
const HF_TOKEN = process.env.NEXT_PUBLIC_HF_TOKEN || ""; // Use environment variables!
const client = HF_TOKEN ? new InferenceClient(HF_TOKEN) : null;

// Constants for action keys
const ACTIONS = {
  PARAPHRASE: "paraphrase",
  AI_DETECT: "ai-detect",
  HUMANIZE: "humanize",
  GRAMMAR_CHECK: "grammar-check",
};
import { NOVITA_BASE_URL } from './urls'


const OpenAI = require("openai");

// Novita.ai Configuration
const baseURL = NOVITA_BASE_URL;
const apiKey = process.env.NEXT_PUBLIC_NOVITA_API_KEY || "";
const model = "meta-llama/llama-3.1-8b-instruct";

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});

// --- Updated ACTION_LABELS with Icons ---
const ACTION_LABELS = [
  { key: ACTIONS.PARAPHRASE, label: "Paraphrase", icon: TbArrowsShuffle },
  { key: ACTIONS.AI_DETECT, label: "AI Detection", icon: TbAnalyze },
  { key: ACTIONS.HUMANIZE, label: "Humanize", icon: TbMoodEdit },
  { key: ACTIONS.GRAMMAR_CHECK, label: "Grammar Check", icon: FaSpellCheck },
];

// Mapping action keys to database columns (for writing_chats)
const DB_COLUMN_MAP = {
  [ACTIONS.PARAPHRASE]: "paraphraser",
  [ACTIONS.AI_DETECT]: "ai_detect",
  [ACTIONS.HUMANIZE]: "humanizer",
  [ACTIONS.GRAMMAR_CHECK]: "grammar_check",
};

// --- NEW --- Mapping action keys to user_usage count columns
const USAGE_COUNT_COLUMN_MAP = {
  [ACTIONS.PARAPHRASE]: "paraphrase_count",
  [ACTIONS.AI_DETECT]: "ai_check_count",
  [ACTIONS.HUMANIZE]: "humanizer_count",
  [ACTIONS.GRAMMAR_CHECK]: "grammer_check_count",
};

// --- NEW --- Pie Chart Colors
// const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const PIE_COLORS = [
  '#38bdf8', // Sky Blue (Tailwind sky-400)
  '#22d3ee', // Light Cyan (Tailwind cyan-300)
  '#6366f1', // Indigo (Tailwind indigo-500)
  '#ac88ff', // Purple (Tailwind purple-500)
];

// Function to count words


// --- NEW --- Helper function to parse grammar results
const parseGrammarResult = (markdownText) => {
  if (!markdownText || typeof markdownText !== 'string') {
    console.error("Invalid input to parseGrammarResult");
    return { scores: [], errors: "Could not parse analysis.", improvements: "" };
  }
  const sections = { scores: [], errors: "", improvements: "" };
  try {
    // Extract Scores
    const qualityRegex = /Quality Ratings(?:.*?\n)((?:-\s*\*\*(?:Formality|Clarity|Engagement|Delivery):\*\*\s*(\d{1,2}(?:\.\d+)?)\s*(?:\(.*\))?\s*\n?)+)/is;
    const qualityMatch = markdownText.match(qualityRegex);

    if (qualityMatch && qualityMatch[1]) {
      const scoreRegex = /-\s*\*\*(Formality|Clarity|Engagement|Delivery):\*\*\s*(\d{1,2}(?:\.\d+)?)/g;
      let scoreMatch;
      while ((scoreMatch = scoreRegex.exec(qualityMatch[1])) !== null) {
        sections.scores.push({
          name: scoreMatch[1],
          score: parseFloat(scoreMatch[2])
        });
      }
    } else {
      console.warn("Could not find Quality Ratings section or parse scores.");
    }

    // Extract Errors
    const errorsRegex = /Errors Identified:\s*\n([\s\S]*?)(?=\n\nQuality Ratings|\n\nSuggested Improvements|$)/is;
    const errorsMatch = markdownText.match(errorsRegex);
    sections.errors = errorsMatch && errorsMatch[1] ? errorsMatch[1].trim() : "No specific errors section found.";

    // Extract Improvements
    const improvementsRegex = /Suggested Improvements:\s*\n([\s\S]*?)(?=$)/is;
    const improvementsMatch = markdownText.match(improvementsRegex);
    sections.improvements = improvementsMatch && improvementsMatch[1] ? improvementsMatch[1].trim() : "No specific improvements section found.";

    // Basic validation
    if (sections.scores.length !== 4) {
      console.warn("Did not parse exactly 4 scores. Found:", sections.scores.length);
      // Keep potentially partial scores if found
    }

  } catch (e) {
    console.error("Error parsing grammar markdown:", e);
    return { scores: [], errors: "Error parsing analysis.", improvements: markdownText }; // Fallback
  }

  return sections;
};

// --- NEW --- Helper function to format countdown
const formatTimeDifference = (diff) => {
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};


export default function WritingSupplements() {
  const chatID = useAtomValue(writing_chat_id_supabase);
  const uid = useAtomValue(user_id_supabase);

  // --- State ---
  const [text, setText] = useState("");
  const [action, setAction] = useState(ACTIONS.AI_DETECT);
  const [processing, setProcessing] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [isFetchingUsage, setIsFetchingUsage] = useState(true); // --- NEW ---
  const [error, setError] = useState(null);
  const [results, setResults] = useState({
    [ACTIONS.PARAPHRASE]: "",
    [ACTIONS.AI_DETECT]: "",
    [ACTIONS.HUMANIZE]: "",
    [ACTIONS.GRAMMAR_CHECK]: "",
  });
  const [userUsage, setUserUsage] = useState(null); // --- NEW --- { paraphrase_count: 0, ..., last_reset: '...' }
  const [resetCountdown, setResetCountdown] = useState(""); // --- NEW ---
  const [grammarAnalysis, setGrammarAnalysis] = useState(null); // --- NEW --- { scores: [], errors: '', improvements: '' }

  const countWords = (str) => {
    return str.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleChange = (e) => {
    const inputText = e.target.value;
    const wordCount = countWords(inputText);

    if (wordCount <= 4500) {
      setText(inputText);
    }
  };
  // --- Fetch User Usage Data ---
  const fetchUserUsage = useCallback(async () => {
    if (!uid) {
      setIsFetchingUsage(false);
      // setError("User not identified. Cannot load usage data."); // Maybe keep silent
      return;
    }
    console.log("WritingSupplements: Fetching user usage data for:", uid);
    setIsFetchingUsage(true);
    try {
      const { data, error: usageError } = await supabase
        .from('user_usage')
        .select('paraphrase_count, ai_check_count, grammer_check_count, humanizer_count, last_reset')
        .eq('user_id', uid)
        .maybeSingle();

      if (usageError) throw usageError;

      if (data) {
        console.log("WritingSupplements: User usage loaded:", data);
        setUserUsage(data);
      } else {
        console.warn(`WritingSupplements: No usage record found for user ${uid}. Assuming defaults or limited access.`);
        // Optionally, you could create a default record here, or handle it by disabling features.
        // For now, let's set defaults allowing limited/no use if no record exists.
        setUserUsage({
          paraphrase_count: 0,
          ai_check_count: 0,
          grammer_check_count: 0,
          humanizer_count: 0,
          last_reset: null // Or a default past date
        });
        // setError("Could not load usage data. Functionality may be limited.");
      }
    } catch (error) {
      console.error("WritingSupplements: Error fetching user usage:", error);
      setError(`Failed to load usage data: ${error.message}`);
      setUserUsage(null); // Indicate error state
    } finally {
      setIsFetchingUsage(false);
    }
  }, [uid]);


  // --- Fetch Chat History ---
  const fetchChatHistory = useCallback(async () => {
    if (!uid) {
      setIsFetchingInitialData(false);
      return;
    }
    if (!chatID) {
      console.log("WritingSupplements: No active chat ID. Clearing fields.");
      setIsFetchingInitialData(false);
      setText("");
      setResults({ [ACTIONS.PARAPHRASE]: "", [ACTIONS.AI_DETECT]: "", [ACTIONS.HUMANIZE]: "", [ACTIONS.GRAMMAR_CHECK]: "" });
      setGrammarAnalysis(null); // --- NEW --- Clear grammar analysis too
      return;
    }

    console.log(`WritingSupplements: Fetching history for chat ID: ${chatID}`);
    setIsFetchingInitialData(true);
    setError(null);
    setGrammarAnalysis(null); // --- NEW --- Clear previous grammar analysis

    try {
      const { data, error: dbError } = await supabase
        .from("writing_chats")
        .select("input_text, paraphraser, ai_detect, humanizer, grammar_check")
        .eq("user_id", uid)
        .eq("id", chatID)
        .maybeSingle();

      if (dbError) throw dbError;

      if (data) {
        console.log("WritingSupplements: History loaded:", data);
        setText(data.input_text || "");
        const loadedResults = {
          [ACTIONS.PARAPHRASE]: data.paraphraser || "",
          [ACTIONS.AI_DETECT]: data.ai_detect || "",
          [ACTIONS.HUMANIZE]: data.humanizer || "",
          [ACTIONS.GRAMMAR_CHECK]: data.grammar_check || "",
        };
        setResults(loadedResults);

        // --- NEW --- Attempt to parse grammar result if it exists and is the current action
        if (action === ACTIONS.GRAMMAR_CHECK && loadedResults[ACTIONS.GRAMMAR_CHECK]) {
          setGrammarAnalysis(parseGrammarResult(loadedResults[ACTIONS.GRAMMAR_CHECK]));
        }

      } else {
        console.warn(`WritingSupplements: Chat ID ${chatID} not found for user ${uid}. Clearing fields.`);
        // Keep existing error or set a new one? Let's clear text/results but maybe not set a specific error here unless needed
        // setError(`Could not load the specified writing session (ID: ${chatID}).`);
        setText("");
        setResults({ [ACTIONS.PARAPHRASE]: "", [ACTIONS.AI_DETECT]: "", [ACTIONS.HUMANIZE]: "", [ACTIONS.GRAMMAR_CHECK]: "" });
        setGrammarAnalysis(null);
      }
    } catch (error) {
      console.error("WritingSupplements: Error fetching chat history:", error);
      setError(`Failed to load writing history: ${error.message}`);
      setText("");
      setResults({ [ACTIONS.PARAPHRASE]: "", [ACTIONS.AI_DETECT]: "", [ACTIONS.HUMANIZE]: "", [ACTIONS.GRAMMAR_CHECK]: "" });
      setGrammarAnalysis(null);
    } finally {
      setIsFetchingInitialData(false);
    }
  }, [uid, chatID, action]); // --- MODIFIED --- Added action dependency

  // --- Effect for Initial Data Load & Usage ---
  useEffect(() => {
    fetchUserUsage(); // Fetch usage data on mount/uid change
  }, [fetchUserUsage]);

  useEffect(() => {
    fetchChatHistory();
    setAction(ACTIONS.AI_DETECT); // Reset action to default on chat change
  }, [chatID]); // --- MODIFIED --- Only depends on chatID now

  // --- NEW --- Effect for Reset Countdown Timer ---
  useEffect(() => {
    if (!userUsage || !userUsage.last_reset) {
      setResetCountdown(""); // No reset data available
      return;
    }

    const lastResetDate = new Date(userUsage.last_reset);
    const nextResetDate = new Date(lastResetDate);
    nextResetDate.setDate(lastResetDate.getDate() + 7); // Add 7 days

    const calculateAndSetCountdown = () => {
      const now = new Date();
      const diff = nextResetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setResetCountdown("Reset pending or overdue");
        // Optionally trigger a usage refresh here if needed
        // fetchUserUsage();
      } else {
        setResetCountdown(formatTimeDifference(diff));
      }
    };

    calculateAndSetCountdown(); // Initial calculation
    const timerId = setInterval(calculateAndSetCountdown, 1000); // Update every second

    return () => clearInterval(timerId); // Cleanup interval on unmount or dependency change
  }, [userUsage]); // Recalculate if userUsage data changes


  // --- AI Processing Functions ---
  const callHfChatCompletion = async (promptContent, actionLabel) => {
    if (!openai) throw new Error("AI Client not initialized.");
    await waitForSlot()
    try {

      const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: "user", content: promptContent }],
        model,
        stream: false,
        max_tokens: actionLabel === "Grammar Check" ? 4500 : 3048,
        temperature: actionLabel === "Paraphrase" ? 0.7 : 0.5,
      });
      return chatCompletion.choices[0]?.message?.content?.trim() || `Could not perform ${actionLabel}.`;
    } catch (error) {
      console.error(`Error during ${actionLabel}:`, error);
      throw new Error(`Error during ${actionLabel}: ${error.message}`);
    } finally {
      await releaseSlot()
    }
  };

  const paraphraseText = (inputText) => callHfChatCompletion(`Paraphrase the following text: ${inputText}`, "Paraphrase");
  const humanizeText = (inputText) => callHfChatCompletion(`Rewrite this text to sound natural and human-written. Use simple, clear language that anyone can understand.

Rules for humanizing:
- Replace difficult words with common synonyms
- Keep sentences short (10 words or less when possible)
- Write like a basic English speaker
- Use simple, everyday words
- Avoid filler words like "you know", "you see", "like", "well"
- Don't add unnecessary phrases or transitions
- Make it sound natural but not overly casual
- Keep the original meaning intact

Return only the rewritten text. No explanations or extra words.

Text to humanize: ${inputText}`, "Humanize");
  const checkGrammar = (inputText) => callHfChatCompletion(`
    Please analyze this text: "${inputText}" for **grammar, clarity, engagement, and delivery.** Your response must be in pure **Markdown** format and strictly follow this structure:

    Errors Identified:
    *List the grammatical, spelling, or structural mistakes with brief explanations. If none, state "No significant grammatical errors identified."*

    Quality Ratings (0-10)(with one line desc) :
    - **Formality:** [Score 0-10] (Brief description)
    - **Clarity:** [Score 0-10] (Brief description)
    - **Engagement:** [Score 0-10] (Brief description)
    - **Delivery:** [Score 0-10] (Brief description)

    Suggested Improvements:
    *Provide a rewritten version of the text with corrections applied. If significantly different tones are possible (e.g., more formal/casual), offer alternatives.*
    `, "Grammar Check");

  const detectAIText = async (inputText) => {
    if (!client) throw new Error("AI Client not initialized.");
    try {
      const response = await client.textClassification({
        model: "openai-community/roberta-base-openai-detector",
        inputs: inputText,
      });
      const sortedResponse = response.sort((a, b) => b.score - a.score);
      const detectedLabel = sortedResponse[0]?.label || "Unknown";
      const confidenceScore = sortedResponse[0]?.score || 0;
      const confidencePercentage = (confidenceScore * 100).toFixed(1);

      let interpretation = "Analysis complete.";
      if (detectedLabel.toLowerCase().includes('fake') || detectedLabel.includes('1')) {
        interpretation = `Likely AI Generated (Confidence: ${confidencePercentage}%)`;
      } else if (detectedLabel.toLowerCase().includes('real') || detectedLabel.includes('0')) {
        interpretation = `Likely Human Written (Confidence: ${confidencePercentage}%)`;
      } else {
        interpretation = `Detection result: ${detectedLabel} (Confidence: ${confidencePercentage}%)`;
      }
      return interpretation;
    } catch (error) {
      console.error("Error detecting AI text:", error);
      throw new Error(`Error detecting AI text: ${error.message}`);
    }
  };


  // --- Save Results to Supabase ---
  const saveToSupabase = async (inputText, result, actionType) => {
    if (!chatID || !uid) {
      console.error("WritingSupplements: Cannot save. Missing chat ID or user ID.");
      setError("Cannot save result: Active chat session not found.");
      return false;
    }

    const columnToUpdate = DB_COLUMN_MAP[actionType];
    if (!columnToUpdate) {
      console.error("WritingSupplements: Invalid action type for saving:", actionType);
      return false;
    }

    console.log(`WritingSupplements: Saving ${actionType} result for chat ID: ${chatID}`);
    try {
      const { error: updateError } = await supabase
        .from("writing_chats")
        .update({
          [columnToUpdate]: result,
          input_text: inputText, // Also save the input text that generated this result
        })
        .eq("id", chatID)
        .eq("user_id", uid);

      if (updateError) {
        if (updateError.code === 'PGRST116') { // Not found error
          console.error(`WritingSupplements: Chat ID ${chatID} not found for user ${uid} during update.`);
          setError(`Failed to save: Could not find the current writing session (ID: ${chatID}). Please refresh or start a new session.`);
        } else {
          throw updateError; // Rethrow other Supabase errors
        }
        return false;
      }

      console.log("WritingSupplements: Save successful.");
      return true; // Indicate success
    } catch (err) {
      console.error("WritingSupplements: Unexpected error during save:", err);
      setError(`Failed to save result: ${err.message}`);
      return false;
    }
  };

  // --- NEW --- Decrement Usage Count in Supabase ---
  const decrementUsageCount = async (actionType) => {
    if (!uid || !userUsage) {
      console.error("WritingSupplements: Cannot decrement usage. Missing user ID or usage data.");
      return false; // Don't block the user, but log the issue
    }

    const countColumn = USAGE_COUNT_COLUMN_MAP[actionType];
    if (!countColumn) {
      console.error("WritingSupplements: Invalid action type for decrementing usage:", actionType);
      return false;
    }

    // Ensure the count doesn't go below zero (though UI check should prevent this)
    const currentCount = userUsage[countColumn] ?? 0;
    if (currentCount <= 0) {
      console.warn(`WritingSupplements: Attempted to decrement ${countColumn} below zero.`);
      return true; // Technically not an error, but count was already zero
    }

    console.log(`WritingSupplements: Decrementing ${countColumn} for user: ${uid}`);
    try {
      const { error: decrementError } = await supabase
        .from('user_usage')
        .update({ [countColumn]: currentCount - 1 })
        .eq('user_id', uid);

      if (decrementError) throw decrementError;

      console.log("WritingSupplements: Usage count decremented successfully.");
      // Update local state immediately for responsiveness
      setUserUsage(prevUsage => ({
        ...prevUsage,
        [countColumn]: currentCount - 1
      }));
      return true;

    } catch (err) {
      console.error("WritingSupplements: Error decrementing usage count:", err);
      // Don't set the main UI error, as the primary action might have succeeded.
      // Maybe show a subtle warning? For now, just log it.
      // setError(`Failed to update usage count: ${err.message}`);
      return false; // Indicate failure to decrement
    }
  };


  // --- Process Text (Main Action Handler) ---
  const processText = async () => {
    setError(null); // Clear previous errors
    setGrammarAnalysis(null); // Clear previous grammar analysis

    if (!text.trim()) {
      setError("Please enter some text to process.");
      return;
    }
    if (!chatID) {
      setError("Please select or start a writing session before processing.");
      return;
    }
    if (!client) {
      setError("AI Client is not available. Please check configuration.");
      return;
    }
    if (isFetchingUsage || !userUsage) {
      setError("Usage data is still loading. Please wait.");
      return;
    }

    // --- NEW --- Check Usage Limits
    const countColumn = USAGE_COUNT_COLUMN_MAP[action];
    const remainingCount = userUsage[countColumn] ?? 0;
    const actionLabel = ACTION_LABELS.find(l => l.key === action)?.label || 'selected action';

    if (remainingCount <= 0) {
      setError(`You have no remaining credits for ${actionLabel}. Credits reset in ${resetCountdown || 'due time'}.`);
      return;
    }

    setProcessing(true);

    let actionFunction;
    switch (action) {
      case ACTIONS.PARAPHRASE: actionFunction = paraphraseText; break;
      case ACTIONS.AI_DETECT: actionFunction = detectAIText; break;
      case ACTIONS.HUMANIZE: actionFunction = humanizeText; break;
      case ACTIONS.GRAMMAR_CHECK: actionFunction = checkGrammar; break;
      default:
        setError("Invalid action selected.");
        setProcessing(false);
        return;
    }

    try {
      const result = await actionFunction(text);

      // Update results state
      setResults(prevResults => ({
        ...prevResults,
        [action]: result,
      }));

      // --- NEW --- Parse grammar result if applicable
      if (action === ACTIONS.GRAMMAR_CHECK) {
        setGrammarAnalysis(parseGrammarResult(result));
      }

      // Save to DB *before* decrementing count
      const saveSuccess = await saveToSupabase(text, result, action);

      if (saveSuccess) {
        // Decrement count only if save was successful
        await decrementUsageCount(action);
      } else {
        // If saving failed, don't decrement count and inform user
        // Error should already be set by saveToSupabase
        console.warn("WritingSupplements: Save failed, usage count not decremented.");
      }

    } catch (error) {
      console.error("WritingSupplements: Error processing text:", error);
      setError(error.message || "An unexpected error occurred during processing.");
    } finally {
      setProcessing(false);
    }
  };

  // --- Render Logic ---

  // Determine current result to display
  const currentResult = results[action] || "";

  // Get remaining count for the selected action
  const getRemainingCount = useMemo(() => {
    if (!userUsage || isFetchingUsage) return '...'; // Loading state
    const countKey = USAGE_COUNT_COLUMN_MAP[action];
    return userUsage[countKey] ?? 0; // Default to 0 if key doesn't exist
  }, [action, userUsage, isFetchingUsage]);


  // --- Loading State for Initial Data ---
  if (isFetchingInitialData && chatID) { // Only show full screen load if loading a specific chat
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen p-4">
        <LoadingSpinner message="Loading writing session..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[92%] md:w-10/12 h-screen mx-auto p-4 bg-transparent overflow-y-scroll scrollbar-hide">

      {/* --- NEW --- Usage Reset Timer --- */}
      {/* {resetCountdown && !isFetchingUsage && (
        <div className="mb-3 p-2 text-center bg-blue-50 dark:bg-blue-900 dark:bg-opacity-30 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-md text-xs md:text-sm flex items-center justify-center">
          <IoTimerOutline className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Usage credits reset in: {resetCountdown}</span>
        </div>
      )} */}
      {/* --- NEW --- Loading indicator for usage --- */}
      {isFetchingUsage && (
        <div className="mb-3 p-2 text-center text-gray-500 dark:text-gray-400 text-xs md:text-sm">
          Loading usage data...
        </div>
      )}

      {/* --- Warning if no chat ID --- */}
      {!chatID && !isFetchingInitialData && ( // Show only if not loading and no chatID
        <div className="mb-4 p-3 text-center bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-40 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 rounded-md flex items-center justify-center">
          <IoWarningOutline className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>Please select or start a new writing session from the sidebar to begin.</span>
        </div>
      )}

      {/* --- Action Tabs --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 dark:bg-zinc-900 bg-gray-100 p-2 rounded-lg md:text-lg text-sm text-center justify-evenly mt-4">
        {ACTION_LABELS.map(({ key, label, icon: IconComponent }) => (
          <button
            key={key}
            className={`px-2 md:px-4 py-2 rounded-lg transition-colors duration-200 font-light cursor-pointer flex items-center justify-center gap-2 ${action === key
              ? "bg-white shadow-md font-medium dark:text-zinc-950 text-slate-700"
              : "dark:text-zinc-200 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-800"
              }`}
            onClick={() => {
              setAction(key);
              setError(null);
              setGrammarAnalysis(null); // --- NEW --- Clear analysis on tab switch
              // --- NEW --- If result already exists for this action & it's grammar, parse it now
              if (key === ACTIONS.GRAMMAR_CHECK && results[key]) {
                setGrammarAnalysis(parseGrammarResult(results[key]));
              }
            }}
            disabled={!chatID || isFetchingInitialData} // Disable tabs if no chat or loading history
          >
            {IconComponent && <IconComponent className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Input Textarea */}
      {/* <textarea
        className={`w-full border flex flex-col min-h-[80%] md:min-h-[40%] lg:h-[35%] p-2 mt-4 dark:bg-zinc-900 bg-slate-100 dark:text-zinc-100 text-black rounded-md focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-60`}
        rows="6"
        placeholder={chatID ? "Enter your text here..." : "Select a writing session first..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!chatID || processing || isFetchingInitialData || isFetchingUsage}
      /> */}
      <textarea
        className={`w-full border flex flex-col min-h-[80%] md:min-h-[40%] lg:h-[35%] p-2 mt-4 dark:bg-zinc-900 bg-slate-100 dark:text-zinc-100 text-black rounded-md focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-60`}
        rows="6"
        placeholder={chatID ? "Enter your text here..." : "Select a writing session first..."}
        value={text}
        onChange={handleChange}
        disabled={!chatID || processing || isFetchingInitialData || isFetchingUsage}
      />
      <p className="text-sm text-gray-500 mt-1">
        {countWords(text)}/4500 words
      </p>

      {/* --- Process Button --- */}
      <button
        className="bg-indigo-500 hover:bg-indigo-400 dark:bg-zinc-200 dark:text-zinc-900 hover:dark:bg-zinc-950 hover:dark:text-zinc-200 font-semibold text-white p-2 rounded mt-2 w-full transform duration-300 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={processText}
        disabled={!chatID || processing || isFetchingInitialData || isFetchingUsage || !text.trim()}
      >
        {processing ? (
          <>
            <LoadingSpinner size="h-5 w-5" color="border-white dark:border-zinc-900" message="" />
            <span className="ml-2">Processing...</span>
          </>
        ) : (
          <>
            <IoSend className="mr-2 h-5 w-5" />
            {/* --- MODIFIED --- Show remaining count */}
            Process ({getRemainingCount} left)
          </>
        )}
      </button>

      {/* --- Error Display Area --- */}
      {error && (
        <div className="mt-2 p-2 text-center bg-red-100 dark:bg-red-900 dark:bg-opacity-40 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center justify-center">
          <IoCloseCircleOutline className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}


      {/* Results Area */}
      <div className="flex flex-col w-full mt-3 text-slate-900 rounded-lg bg-slate-50 dark:bg-zinc-900 flex-grow min-h-full md:min-h-[40%] overflow-hidden relative scrollbar-hide">
        {/* Loading overlay specifically when processing AND previous result exists */}
        {processing && currentResult && (
          <div className="absolute inset-0 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-center z-10">
            <LoadingSpinner message="Updating result..." />
          </div>
        )}

        {/* --- MODIFIED --- Conditional Rendering for Results */}
        {action === ACTIONS.GRAMMAR_CHECK && grammarAnalysis ? (
          // --- NEW --- Special Layout for Grammar Check ---
          <div className="p-5 h-full overflow-y-auto scrollbar-thn scrollbar-hide scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-200 dark:scrollbar-track-zinc-800 dark:text-zinc-200 ">
            <h2 className="text-lg font-semibold mb-4 capitalize">Grammar Check Analysis:</h2>

            {/* Pie Chart for Scores */}
            {grammarAnalysis.scores && grammarAnalysis.scores.length > 0 && (
              <div className="mb-6 p-4 border dark:border-zinc-700 rounded-lg bg-gray-100 dark:bg-zinc-800">
                <h3 className="text-md font-semibold mb-3 text-center">Quality Ratings</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {grammarAnalysis.scores.map((item, index) => (
                    <div key={index} className="flex flex-col items-center justify-center">
                      <div className="w-32 h-32 dark:text-white text-black">
                        <CircularProgressbar
                          value={item.score}
                          maxValue={10}
                          text={`${item.score}/10`}
                          styles={buildStyles({
                            textSize: '16px',
                            pathColor: PIE_COLORS[index % PIE_COLORS.length],
                            // textColor: '#fff',
                            trailColor: '#e5e7eb',
                          })}
                        />
                      </div>
                      <div className="mt-2 text-center text-sm font-medium">
                        {item.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}



            {/* Errors Identified Section */}
            <div className="mb-6">
              <h3 className="text-md font-semibold mb-2 pb-1 border-b dark:border-zinc-700">Errors Identified:</h3>
              <div className="markdown-summar whitespace-pre-wrap text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={markdownComponentsConfig} // Use shared config
                >
                  {grammarAnalysis.errors || "No errors identified or section not found."}
                </ReactMarkdown>
              </div>
            </div>

            {/* Suggested Improvements Section */}
            <div>
              <h3 className="text-md font-semibold mb-2 pb-1 border-b dark:border-zinc-700">Suggested Improvements:</h3>
              <div className="markdown-summary whitespace-pre-wrap">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={markdownComponentsConfig} // Use shared config
                >
                  {grammarAnalysis.improvements || "No suggested improvements provided or section not found."}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : currentResult ? (
          // --- Standard Markdown Rendering for other actions ---
          <div className="p-5 h-full overflow-y-auto scrollbar-thn scrollbar-hide scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-200 dark:scrollbar-track-zinc-800 dark:text-zinc-200 ">
            <h2 className="text-lg font-semibold mb-2 capitalize">{action.replace('-', ' ')} Result:</h2>
            <div className=" whitespace-pre-wrap">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={markdownComponentsConfig} // Use shared config
              >
                {currentResult}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          // Placeholder when no result is available
          !processing && !error && chatID && (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-zinc-600 text-center p-5">
              <span>
                {text.trim()
                  ? `Click "Process (${getRemainingCount} left)" to generate the ${action.replace('-', ' ')} result.`
                  : 'Enter text and click "Process".'}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}


// --- NEW --- Shared Markdown Component Configuration ---
const markdownComponentsConfig = {
  // Enhanced link handling
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
    />
  ),
  // Code block syntax highlighting
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    // Check dark mode dynamically if possible, otherwise default or use a hook/context
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return !inline && match ? (
      <SyntaxHighlighter
        style={isDarkMode ? vscDarkPlus : vs}
        language={match[1]}
        PreTag="div"
        className="rounded-md my-4 text-sm" // Adjusted text size
        showLineNumbers={true}
        wrapLines={true} // Added line wrapping
        wrapLongLines={true} // Added long line wrapping
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code
        className={`${className || ''} ${inline ? 'bg-gray-200 dark:bg-gray-700 rounded px-1 text-sm' : 'text-sm'}`} // Consistent text size
        {...props}
      >
        {children}
      </code>
    );
  },
  // Enhanced heading styles
  h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b dark:border-zinc-700" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b dark:border-zinc-700" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />, // Slightly less bold
  h4: ({ node, ...props }) => <h4 className="text-base font-semibold mt-3 mb-2" {...props} />, // Slightly less bold
  // Better list styling
  ul: ({ node, ...props }) => <ul className="list-disc pl-6 my-3" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-6 my-3" {...props} />,
  li: ({ node, ...props }) => <li className="my-1.5" {...props} />, // Increased list item spacing
  // Table styling
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-4 border dark:border-zinc-700 rounded-md">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-gray-100 dark:bg-zinc-800" {...props} />,
  th: ({ node, ...props }) => <th className="border-b border-r dark:border-zinc-600 p-2 text-left font-semibold" {...props} />, // Adjusted borders
  td: ({ node, ...props }) => <td className="border-b border-r dark:border-zinc-700 p-2" {...props} />, // Adjusted borders
  // Block elements
  p: ({ node, ...props }) => <p className="my-3 leading-relaxed" {...props} />, // Improved line height
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-gray-300 dark:border-zinc-600 pl-4 py-1 my-4 italic bg-gray-50 dark:bg-zinc-800/50 rounded-r-md" {...props} /> // Added slight background/rounding
  ),
  hr: ({ node, ...props }) => <hr className="my-6 border-gray-300 dark:border-zinc-700" {...props} />,
  // Inline formatting
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />, // Use semibold for slightly less emphasis than bold
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  del: ({ node, ...props }) => <del className="line-through text-gray-500 dark:text-gray-400" {...props} />, // Dimmed strikethrough
  // Images with better styling
  img: ({ node, ...props }) => (
    <img
      {...props}
      className="max-w-full h-auto my-4 rounded-lg shadow-md" // Added shadow
      loading="lazy"
      alt={props.alt || 'Image'}
    />
  ),
};