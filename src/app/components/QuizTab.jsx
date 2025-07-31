"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { Star, ListChecks, FileQuestionIcon, AlertTriangle, Sliders } from "lucide-react";
import Link from "next/link";
import { FiUploadCloud, FiFileText, FiX, FiTrash2, FiLoader, FiAlertCircle, FiInfo, FiZap, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { supabase } from "../lib/supabaseClient";
import { useAtom, useAtomValue } from "jotai";
import {
  quizQuestions,
  file_contents_supabase,
  file_id_supabase,
  user_id_supabase,
  quizDifficultyAtom,
} from "../../store/uploadAtoms";
import LoadingSpinner from "./LoadingSpinner";
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import { NOVITA_BASE_URL } from './urls'
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // Replace with your actual key or env var
import { useRouter } from 'next/navigation';        // Or 'next/router' if it's an older Next.js version
import { toast } from "sonner";                       // Or your preferred toast library
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';

// Constants
const CHUNK_SIZE = 110000;
const MIN_TEXT_LENGTH = 150;
const MIN_REQUEST_DELAY = 1000;
const MAX_REQUEST_DELAY = 2000;

// Initialize Hugging Face client
const OpenAI = require("openai");
let genAI; // Initialize outside component to avoid recreation on re-renders

genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

// Novita.ai Configuration
const baseURL = NOVITA_BASE_URL;
const apiKey = "sk_TJGzb-mYV9KUKeLJiuIn7wJcYLwR6ZL0KaZCLnCztYo";
const model = "meta-llama/llama-3.3-70b-instruct";

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});

export default function QuizTab() {

  const [remainingQuizzes, setRemainingQuizzes] = useState(null);
  const userUuid = useAtomValue(user_id_supabase);
  const router = useRouter(); // For navigation in toast
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  // State
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [quizExists, setQuizExists] = useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState(null);
  const [processedChunks, setProcessedChunks] = useState([]);
  const [fullContext, setFullContext] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useAtomValue(quizDifficultyAtom); // Default to show all difficulties

  // Jotai Atoms
  const [quiz, setQuiz] = useAtom(quizQuestions);
  const [content, setContent] = useAtom(file_contents_supabase);
  const [quizDifficulty, setQuizDifficulty] = useAtom(quizDifficultyAtom);
  const fid = useAtomValue(file_id_supabase);

  // Refs
  const isMounted = useRef(true);
  const [rawText, setRawtext] = useState(content?.[0]?.raw_text || "");
  const allQuestions = useAtomValue(quizQuestions);
  const [totalQuizToGenerate, setTotalQuizToGenerate] = useState(30)

  // Filter questions based on selected difficulty
  const filteredQuestions = useMemo(() => {
    if (selectedDifficulty === "all") {
      return allQuestions;
    } else if (selectedDifficulty === "easy") {
      return allQuestions.filter(q => q.lvl === "e");
    } else if (selectedDifficulty === "medium") {
      return allQuestions.filter(q => q.lvl === "e" || q.lvl === "m");
    } else if (selectedDifficulty === "hard") {
      return allQuestions; // All questions for hard mode
    }
    return allQuestions;
  }, [allQuestions, selectedDifficulty]);
  // Effects
  useEffect(() => {
    // isMounted.current = true;
    if (userUuid) {
      checkRemainingQuizzes();
    }
    // return () => { isMounted.current = false; };
  }, [userUuid]);

  useEffect(() => {
    console.log("QUIZ TAB EFFECT")
    if (userUuid) {
      checkRemainingQuizzes();
    }
    if (fid && typeof fid === 'string' && fid.trim() !== '') {
      checkExistingQuiz();
    } else if (isMounted.current) {
      setChecking(false);
      setQuizExists(false);
      setQuiz([]);
      setError(null);
      setLimitReachedMessage(null);
    }
  }, [fid]);

  // Handle difficulty change


  // Check remaining quizzes in user_usage table
  const checkRemainingQuizzes = async () => {
    if (!userUuid) return;
    // console.log("checkRemainingQuizzes running",)

    try {
      const { data, error } = await supabase
        .from("user_usage")
        .select("quiz_count")
        .eq("user_id", userUuid)
        .single();
      // console.log("USER QUIZ QOUTA--->", data)
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching remaining quizzes:", error);
        setRemainingQuizzes(0);
        return;
      }

      const quizCount = data?.quiz_count || 0;
      setRemainingQuizzes(quizCount);

    } catch (err) {
      console.error("Error checking quiz count:", err);
      setRemainingQuizzes(0);
    }
  };

  // Decrement remaining quiz count
  const decrementQuizCount = async () => {
    if (!userUuid || remainingQuizzes <= 0) return false;

    try {
      const newCount = remainingQuizzes - 1;
      const { error } = await supabase
        .from("user_usage")
        .update({ quiz_count: newCount })
        .eq("user_id", userUuid);

      if (error) throw error;
      setRemainingQuizzes(newCount);
      return true;
    } catch (err) {
      console.error("Error updating quiz count:", err);
      return false;
    }
  };

  // Check Supabase for existing quiz
  const checkExistingQuiz = async () => {
    if (!isMounted.current || !fid) {
      if (isMounted.current) setChecking(false);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("file_data")
        .select("quiz, raw_text")
        .eq("file_id", fid)
        .maybeSingle();

      if (!isMounted.current) return;
      if (fetchError) throw new Error(`Database error: ${fetchError.message}`);

      const existingQuizData = data?.quiz;
      const hasValidData = existingQuizData && Array.isArray(existingQuizData) && existingQuizData.length > 0;
      setRawtext(data?.raw_text);
      setQuizExists(hasValidData);
      if (hasValidData && JSON.stringify(existingQuizData) !== JSON.stringify(quiz)) {
        setQuiz(existingQuizData);
      } else if (!hasValidData && quiz.length > 0) {
        setQuiz([]);
      }
    } catch (err) {
      console.error("Error checking for existing quiz:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Could not check for existing quiz.");
        setQuizExists(false);
        setQuiz([]);
      }
    } finally {
      if (isMounted.current) setChecking(false);
    }
  };

  // Update quiz in state and database
  const updateQuiz = async (newQuizData) => {
    if (!isMounted.current || !fid) return false;

    try {
      // Update in database
      const { error: updateError } = await supabase
        .from("file_data")
        .update({ quiz: newQuizData })
        .eq("file_id", fid);

      if (updateError) throw new Error(`Failed to save quiz: ${updateError.message}`);

      // Update in state
      setQuiz(newQuizData);
      setContent((prevContent = []) => {
        const itemExists = prevContent.some(item => item.file_id === fid);
        if (itemExists) {
          return prevContent.map((item) =>
            item.file_id === fid ? { ...item, quiz: newQuizData } : item
          );
        } else {
          return [...prevContent, {
            file_id: fid,
            quiz: newQuizData,
            raw_text: prevContent.find(item => item.file_id === fid)?.raw_text ?? rawText
          }];
        }
      });

      setQuizExists(true);
      return true;
    } catch (err) {
      console.error("Error updating quiz:", err);
      if (isMounted.current) setError("Failed to save quiz.");
      return false;
    }
  };

  // Process text chunks and generate quiz
  const streamAndGenerateQuiz = async () => {
    if (!isMounted.current) return;
    if (!rawText || rawText.trim().length < MIN_TEXT_LENGTH) {
      setError(`Document too short (minimum ${MIN_TEXT_LENGTH} characters required).`);
      return;
    }

    // === USAGE CHECK STARTS HERE ===
    if (userUuid) { // Only check usage if userUuid is available
      setGenerationStage("Checking quiz credits...");
      const remainingCredits = await getUserActivityUsage('quiz');

      if (remainingCredits <= 0) {
        toast("Free limit for Quizzes finished, Buy premium!", {
          description: "For $4.99 get higher usage limits",
          action: {
            label: "Buy",
            onClick: () => triggerProButtonDialog(),
          },
        });
        setError("You have no remaining quizzes. Please upgrade your plan.");
        setLoading(false);
        setGenerationStage("");
        return; // Stop execution
      }
      console.log(`QuizTab: User has ${remainingCredits} quiz credits. Proceeding.`);
    } else {
      // Handle case where userUuid is not available, if necessary
      // For example, allow generation or show a different message
      console.warn("QuizTab: User ID not available, skipping usage check for now.");
    }
    // === USAGE CHECK ENDS HERE ===

    setLoading(true);
    setError(null);
    setLimitReachedMessage(null);
    setProgress(5);
    setGenerationStage("Preparing document processing...");
    setProcessedChunks([]);
    setFullContext("");

    try {
      const chunks = splitIntoChunks(rawText, CHUNK_SIZE);
      const totalChunks = chunks.length;

      setProgress(10);
      setGenerationStage(`Prepared ${totalChunks} chunks for sequential processing...`);

      let accumulatedContext = "";

      for (let i = 0; i < totalChunks; i++) {
        if (!isMounted.current) break;
        const updatedContext = await processChunk(chunks[i], i, totalChunks, accumulatedContext);
        if (updatedContext === null) {
          throw new Error(`Failed to process chunk ${i + 1}.`);
        }
        accumulatedContext = updatedContext;
      }

      setProgress(85);
      setGenerationStage("All chunks processed. Generating comprehensive quiz...");

      const quizData = await generateQuiz(accumulatedContext);

      if (!quizData) {
        throw new Error("Failed to generate quiz from processed content.");
      }

      setProgress(98);
      setGenerationStage(`Saving ${quizData.length} questions...`);

      const success = await updateQuiz(quizData);

      if (success) {
        // === DECREMENT USAGE STARTS HERE ===
        if (userUuid) { // Only decrement if userUuid is available
          await decrementUserActivityUsage('quiz');
          console.log("QuizTab: Quiz usage decremented.");
        }
        // === DECREMENT USAGE ENDS HERE ===

        const { data: updatedUserAttempt, error: updateError } = await supabase
          .from("file_data")
          .update({ isQuizFirstAttempt: true }) // Or false, depending on your logic
          .eq("file_id", fid)
          .select()
          .maybeSingle();

        setProgress(100);
        setGenerationStage(`Quiz generated with ${quizData.length} questions!`);
        setTimeout(() => {
          if (isMounted.current) {
            setProgress(0);
            setGenerationStage("");
          }
        }, 3000);
      } else {
        throw new Error("Failed to save generated quiz.");
      }

    } catch (err) {
      console.error("Quiz generation error:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "An error occurred during quiz generation.");
        setProgress(0);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Helper functions
  const splitIntoChunks = (text, size) => {
    if (!text || typeof text !== 'string') return [];

    const chunks = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.substring(i, i + size));
    }
    return chunks;
  };

  const processChunk = async (chunkText, chunkIndex, totalChunks, accumulatedContext) => {
    if (!isMounted.current) return null;

    setGenerationStage(`Processing sections ${chunkIndex + 1}/${totalChunks}...`);

    try {
      // Calculate progress percentage
      const progressPct = 10 + Math.floor(((chunkIndex + 1) / totalChunks) * 75);
      setProgress(progressPct);

      setProcessedChunks(prev => [...prev, {
        index: chunkIndex,
        text: chunkText
      }]);

      // Update full context
      const updatedContext = accumulatedContext + "\n\n" + chunkText;
      setFullContext(updatedContext);

      // Add a delay between requests to avoid rate limiting
      const delay = MIN_REQUEST_DELAY + Math.random() * (MAX_REQUEST_DELAY - MIN_REQUEST_DELAY);
      await new Promise(resolve => setTimeout(resolve, delay));

      return updatedContext;
    } catch (err) {
      console.error(`Error processing chunk ${chunkIndex + 1}:`, err);
      if (isMounted.current) {
        setError(`Failed to process chunk ${chunkIndex + 1}: ${err.message}`);
      }
      return null;
    }
  };

  const generateQuiz = async (context) => {
    if (!isMounted.current) return null;

    setGenerationStage("Generating comprehensive quiz questions...");
    setProgress(85);
    try {
      const formattedContext = context;

      const quizPrompt = `
        [SYSTEM]
        You are a quiz generator that MUST follow these instructions EXACTLY.
        [/SYSTEM]
        
        Generate a quiz under ${totalQuizToGenerate} questions based on this document:
        
        ${formattedContext}
        
        STRICT RULES:
        1. CREATE EXACTLY ${totalQuizToGenerate * .33} EASY QUESTIONS (level "e")
        2. CREATE EXACTLY ${totalQuizToGenerate * .33} MEDIUM QUESTIONS (level "m")
        3. CREATE EXACTLY ${totalQuizToGenerate * .33} HARD QUESTIONS (level "h")
        
        Each question MUST follow this JSON format:
        {
          "q": "Question text",
          "opt": ["Option A", "Option B", "Option C", "Option D"],
          "ans": 0,  // Index (0-3) of correct answer
          "lvl": "e"  // MUST be "e", "m", or "h"
        }
        
        IMPORTANT: Before finishing, COUNT the questions in each level:
        - Count easy questions (level "e"): MUST BE AT LEAST ${totalQuizToGenerate * .33}
        - Count medium questions (level "m"): MUST BE AT LEAST ${totalQuizToGenerate * .33}
        - Count hard questions (level "h"): MUST BE AT LEAST ${totalQuizToGenerate * .33}
        
        Return ONLY the JSON array with this structure:
        [
          {question 1},
          {question 2},
          ...and so on
        ]
        
        Do not include any explanations or comments, only return the JSON array.
        [SYSTEM]
        Generate ${totalQuizToGenerate} in total.
        [/SYSTEM]
        `;


      setProgress(65);
      await waitForSlot();

      // const completion = await openai.chat.completions.create({
      //   messages: [{ role: "user", content: quizPrompt }],
      //   model,
      //   stream: false,
      //   max_tokens: 4096,
      //   temperature: 0.4
      // });
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash", // Ensure this model ID is correct and available
        contents: createUserContent(quizPrompt), // Pass the dynamically created array

      });


      if (!isMounted.current) return null;

      const responseText = result.text;
      console.log("QUIZ REPOSNE --->", responseText)
      const quizData = extractJson(responseText);

      if (!quizData || quizData.length === 0) {
        throw new Error("Failed to generate valid quiz questions.");
      }

      return quizData;
    } catch (err) {
      console.error("Quiz generation error:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to generate quiz.");
      }
      return null;
    } finally {
      await releaseSlot()
    }
  };

  const extractJson = (str) => {
    if (!str || typeof str !== 'string') return [];

    try {
      const startIndex = str.indexOf('[');
      const endIndex = str.lastIndexOf(']');
      if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return [];

      const jsonArrayStr = str.substring(startIndex + 1, endIndex); // remove brackets
      const entries = jsonArrayStr.split('},').map((entry, index, arr) => {
        // Add back '}' except for last item (may already have it)
        const cleaned = entry.trim() + (entry.trim().endsWith('}') ? '' : '}');
        try {
          const parsed = JSON.parse('{' + cleaned.split('{').pop()); // clean if nested
          // Basic structure validation
          if (
            typeof parsed.q === 'string' &&
            Array.isArray(parsed.opt) &&
            parsed.opt.length === 4 &&
            typeof parsed.ans === 'number' &&
            parsed.ans >= 0 && parsed.ans <= 3 &&
            typeof parsed.lvl === 'string' &&
            ['e', 'm', 'h'].includes(parsed.lvl)
          ) {
            return parsed;
          }
        } catch (e) {
          // Ignore incomplete or invalid JSON chunks
        }
        return null;
      });

      return entries.filter(Boolean);
    } catch (e) {
      console.error("JSON extraction failed:", e);
      return [];
    }
  };


  // Count questions by difficulty
  const countQuestionsByDifficulty = () => {
    if (!quiz || !Array.isArray(quiz)) return { easy: 0, medium: 0, hard: 0, total: 0 };

    const counts = {
      easy: quiz.filter(q => q.lvl === 'e').length,
      medium: quiz.filter(q => q.lvl === 'm').length,
      hard: quiz.filter(q => q.lvl === 'h').length,
    };

    counts.total = counts.easy + counts.medium + counts.hard;
    return counts;
  };

  // Render Logic
  if (checking) {
    return (
      <div className="flex flex-col bg-ambr-100 dark:bg-zinc-900 max-h-full h-full justify-center items-center p-6 text-center">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">Checking for existing quiz...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-ambr-100 dark:bg-zinc-900 max-h-full h-full justify-center items-center p-6 text-center">
      {(!quizExists || quiz.length === 0) && !loading ? (
        // Generate Button Section
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="flex flex-col items-center"
        >
          <FileQuestionIcon className="w-16 h-16 mb-4 text-green-300" />
          <h2 className="text-2xl font-semibold mb-3 dark:text-zinc-200">Generate Quiz</h2>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400 max-w-md">
            Create multiple-choice questions based on the document content.
          </p>
          {!openai && (<p className="mb-4 text-red-600 dark:text-red-400 font-semibold">Quiz generation service is not configured.</p>)}

          {/* Remaining quiz count display */}
          {remainingQuizzes !== null && (
            <p className="mb-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Remaining quizzes: <span className={remainingQuizzes > 0 ? "text-green-600 dark:text-green-400 font-bold" : "text-red-500 font-bold"}>
                {remainingQuizzes}
              </span>
            </p>
          )}

          <button
            onClick={streamAndGenerateQuiz}
            className={`flex items-center justify-center bg-indigo-600 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed text-xl md:text-2xl dark:bg-zinc-200 hover:dark:bg-zinc-800 dark:text-zinc-900 hover:dark:text-zinc-100 transition-all duration-300 ease-in-out transform hover:scale-105`}
            disabled={loading || !openai || !rawText || rawText.trim().length < MIN_TEXT_LENGTH || remainingQuizzes <= 0}
            title={
              remainingQuizzes <= 0 ? "No remaining quizzes available" :
                !openai ? "Quiz generation service unavailable" :
                  (!rawText || rawText.trim().length < MIN_TEXT_LENGTH) ? `Document content too short (min ${MIN_TEXT_LENGTH} chars)` :
                    "Generate a new quiz from the document"
            }
          >
            <Star className="w-5 h-5 mr-2" />
            {remainingQuizzes <= 0 ? "No Quizzes Left" : `Generate Quiz (${remainingQuizzes} left)`}
          </button>

          {error && !loading && (<p className="mt-4 text-red-600 dark:text-red-400">{error}</p>)}

          {remainingQuizzes <= 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-zinc-800 rounded-lg border border-amber-200 dark:border-zinc-700">
              <p className="text-amber-800 dark:text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                You have no remaining quizzes. Please contact support to add more to your account.
              </p>
            </div>
          )}
        </motion.div>
      ) : loading ? (
        // Loading/Progress Section
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full max-w-md">
          <LoadingSpinner />
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-6 mb-2">
            <motion.div className="bg-indigo-600 h-2.5 rounded-full dark:bg-indigo-500" style={{ width: `${progress}%` }}
              initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
          </div>
          <p className="text-lg text-zinc-700 dark:text-zinc-300 mt-2 text-center">
            {generationStage || "Initializing..."} {progress > 0 ? `(${progress}%)` : ''}
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Processed sections: {processedChunks.length}
          </p>
          {error && (<p className="mt-4 text-red-600 dark:text-red-400 text-center">{error}</p>)}
          {limitReachedMessage && (
            <p className="mt-4 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {limitReachedMessage}
            </p>
          )}
        </motion.div>
      ) : (
        // Quiz Ready Section
        <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center">
          <ListChecks className="w-16 h-16 mb-4 text-green-500" />
          <h2 className="text-2xl font-semibold mb-3 dark:text-zinc-200">Quiz Ready!</h2>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400"> {quiz.length > 0 ? `Your quiz with ${quiz.length} questions is ready.` : "A quiz is available."} </p>
          <Link href="/leaderboard" className="w-full flex flex-col sm:w-auto">
            <button className="w-full py-2.5 px-6 
            dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
            bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800
            
            font-medium rounded-lg shadow-md transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 mb-4">
              View Leaderboard <FiChevronRight className="inline ml-1" />
            </button>
          </Link>


          {/* Remaining quiz count display */}
          {remainingQuizzes !== null && (
            <p className="mb-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Remaining quizzes: <span className={remainingQuizzes > 0 ? "text-green-600 dark:text-green-400 font-bold" : "text-red-500 font-bold"}>
                {remainingQuizzes}
              </span>
            </p>
          )}

          {limitReachedMessage && (
            <p className="mb-4 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> Note: Quiz based on partial document due to size limit.
            </p>
          )}
          {fid && (
            <div className="flex flex-row gap-4">
              <Link href={`/quiz`} passHref>
                <motion.h1 className="bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-xl md:text-2xl dark:bg-green-500 hover:dark:bg-green-600 dark:text-zinc-100 transition-colors duration-300"
                  whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                  Start full length
                </motion.h1>
              </Link>
              <Link href={`/iquiz`} passHref>
                <motion.h1 className="bg-rose-500 text-white px-8 py-4 rounded-lg shadow-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-xl md:text-2xl dark:bg-rose-400 hover:dark:bg-rose-600 dark:text-zinc-100 transition-colors duration-300"
                  whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                  Start rapid round
                </motion.h1>
              </Link>
            </div>
          )}
          <div className='flex flex-row dark:text-zinc-200 mt-10'>
            Number of questions:
            <select className='flex flex-col w-[3rem] ml-5 rounded dark:text-white bg-zinc-700' value={totalQuizToGenerate} onChange={(e) => setTotalQuizToGenerate(e.target.value)}>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              {/* <option value={60}>60</option> */}
            </select>
          </div>
          <button
            onClick={streamAndGenerateQuiz}
            className="mt-6 text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !genAI || !rawText || rawText.trim().length < MIN_TEXT_LENGTH || remainingQuizzes <= 0}
            title={
              remainingQuizzes <= 0 ? "No remaining quizzes available" :
                !genAI ? "Quiz generation unavailable" :
                  (!rawText || rawText.trim().length < MIN_TEXT_LENGTH) ? `Document too short (min ${MIN_TEXT_LENGTH} chars)` :
                    "Generate a new quiz (will replace current)"
            }>
            {remainingQuizzes <= 0 ? "No Quizzes Left" : `Regenerate Quiz (${remainingQuizzes} left)`}
          </button>

          {error && !loading && (<p className="mt-4 text-red-600 dark:text-red-400">{error}</p>)}
        </motion.div>
      )}
    </div>
  );
}