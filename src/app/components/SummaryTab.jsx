"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAtomValue, useSetAtom, useAtom, atomWithStorage } from "jotai";
import { useUserActivityAPI } from '../lib/getUsage'
import UsageModal from './UsageModal'
import { BookOpenText, RefreshCwIcon, Download } from "lucide-react";
import { IBM_Plex_Mono } from 'next/font/google';
// import { ErrorBoundary } from "next/dist/client/components/error-boundary";

import RichMermaidMarkdown from './MermaidRender'
import { useRouter } from 'next/navigation';
import { triggerProButtonDialog } from '@/lib/utils';
import {
  summaryState,
  smcomplx,
  chat_id_supabase, // Assuming this might be used elsewhere, kept for context
  file_id_supabase,
  file_contents_supabase,
  user_id_supabase,
  said_doesnt_have_credit_state
} from "../../store/uploadAtoms";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // Replace with your actual key or env var
import { supabase } from "../lib/supabaseClient";
import LoadingSpinner from "./LoadingSpinner";
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import { NOVITA_BASE_URL } from './urls'
import RichMarkdown from './RichMarkdown'
const OpenAI = require("openai");

const baseURL = NOVITA_BASE_URL;
const apiKey = "sk_TJGzb-mYV9KUKeLJiuIn7wJcYLwR6ZL0KaZCLnCztYo";
const model = "meta-llama/llama-3.3-70b-instruct";
const stream = true;

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey,
  dangerouslyAllowBrowser: true, // Required for frontend usage, acknowledge security risks
});
import { splitTextIntoChunks } from './a_summaryUtils';
import { updateSummaryUsage, getSummaryUsage } from './c_supabaseData'

const MAX_TOKENS_PER_REQUEST = 6000; // Keep this, Novita likely uses a similar concept
const TARGET_WORDS_PER_CHUNK = 90000;
const DELAY_BETWEEN_CHUNKS_MIN_MS = 500;
const DELAY_BETWEEN_CHUNKS_MAX_MS = 2000;
const SAVE_INTERMEDIATE_EVERY_N_CHUNKS = 6;
let genAI; // Initialize outside component to avoid recreation on re-renders

genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
import React from 'react';

import { toast } from "sonner"

export default function SummaryTab() {
  // --- State (unchanged) ---
  const router = useRouter();
  const [loading, setLoading] = useState(false); // Overall process loading
  const [summaryProgress, setSummaryProgress] = useState(""); // Granular progress message
  const [error, setError] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false); // DB fetch loading
  const [said_doesnt_have_credit, set_said_doesnt_have_credit] = useAtom(said_doesnt_have_credit_state)
  const isGeneratingSummary = useRef(false); // Track if generation is active
  const [intermediateSummaryContent, setIntermediateSummaryContent] = useState(""); // For progressive display
  const [fadeKey, setFadeKey] = useState(0); // Key for triggering fade animation
  const rawChunkSummariesRef = useRef([]); // Store raw summaries for final combination
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false); // For PDF download state
  // --- Jotai Atoms (unchanged) ---
  const fid = useAtomValue(file_id_supabase);
  const userUuid = useAtomValue(user_id_supabase);
  const [finalSummaryState, setFinalSummaryState] = useAtom(summaryState);
  const [fileContent, setFileContent] = useAtom(file_contents_supabase);
  const [summaryComplexity, setSummaryComplexity] = useAtom(smcomplx)
  // Derived state for display (unchanged)
  const displaySummary = loading ? intermediateSummaryContent : finalSummaryState;
  const derivedRawText = fileContent?.[0]?.raw_text || "";
  // --- Summarize a Single Text Chunk (UPDATED for Novita.ai) ---

  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
      console.error("Mermaid rendering error:", error);

      // Call the provided error callback if available
      if (this.props.onError) {
        generateSummary(summaryComplexity)
        this.props.onError(error, errorInfo);
      }
    }

    render() {
      if (this.state.hasError) {
        generateSummary(summaryComplexity)
        return this.props.errorComponent || <div>Something went wrong.</div>;
      }

      return this.props.children;
    }
  }
  const summarizeTextChunk = useCallback(async (textChunk, isFinalCombine = false, chunkIndex = 0, totalChunks = 1, summaryComplexity = "fal") => {
    // Removed check for HF client: if (!client) throw new Error("AI client not initialized.");
    if (!openai) throw new Error("Novita AI client not initialized."); // Check Novita client
    if (!apiKey) {
      throw new Error("Novita API key is not configured. Please set NEXT_PUBLIC_NOVITA_API_KEY environment variable.")
    }
    // Prompts remain the same
    let prompt;
    if (summaryComplexity == "fal") {
      prompt = `
        
        You're given a large study document.

        Task: Create a single, clear revision SUMMARY in Markdown that’s visually engaging.

        Follow these rules:

        Merge all content into one coherent summary

        Exclude sources, citations, author names, or years

        Skip trivial info the audience already knows

        Use emojis where relevant

        Highlight with bold (key points) and italics (side notes)

        Eliminate repetition

        Write 5–8 clear sections with breaks for readability

        Avoid long paragraphs — use bullets, highlights, and tables

        Use blockquotes to emphasize info

        Use bold in interesting points, not just headings

        Output only clean Markdown — no extra text or backticks (except for code)

        Don't use the word "chunk"

        Make it a 6-minute scan-friendly read

        Context:
        ${textChunk}
        Output:
        - Use markdown tables to do compartive analysis of the document

        Final Consolidated summary (Markdown Format Only)

      `;
    }

    if (summaryComplexity == "eli5") {
      prompt = `you are given  a large document. 
       **EXPLAIN IT LIKE I AM 7 YO** Your task is to synthesize these into a **single, coherent revision SUMMARY** in **Markdown** format that is visually engaging. Strictly follow these guidelines: 
      - Combine all information into a unified, logical summary - **Do not include** any references, citations, or paper metadata (skip papers, sources, authors, years, etc.) 
      - **Skip super basic or trivial information** (e.g., definitions already known to the target audience) 
      - USE EMOJIS WHEN RELEVANT 
      
      - Use **bold** for key terms or important points - Use *italics* for secondary emphasis or side notes - Remove repetitive or overlapping information 
      - Use bold in interesting information not in headlines
      
      - Present **5–8 concise main points or sections** with paragraph breaks for readability - Avoid long paragraphs, use bullet points and highlights At the end, always include: 
       
      - Use blockquotes to highlight info ⚠️ Important: - Don’t add unnecessary text like “here you go” 
      - Do NOT use the word *"chunk"* anywhere 
      - Make the output super user-friendly 
      
      - Do NOT use backticks except when showing actual code - Make sure to follow proper markdown syntax EXPLAIN IT LIKE I AM 7 YO. Keep it simple and concise. 

      context: --- 
      ${textChunk} 
      
      ---

      Mandatorily Use tables to visualize info


      use  headline at first with # tag always others ##, ###, dont use bold in heading, before heading dont give anything,  explain everything in short use that Output: **Final Consolidated summary (Markdown Format Only)
      `
      // setSummaryComplexity("eli5")
    }
    if (summaryComplexity == "genz") {

      prompt = `You are given a large study document. 
      
      Your task is to synthesize this into a **single, coherent revision SUMMARY** in **Markdown** format that is visually engaging. Strictly follow these guidelines: 
      - Combine all information into a unified, logical summary - **Do NOT include** references, citations, or paper metadata (e.g., authors, years, sources, etc.) 
      - **Skip super basic or obvious info** already known to your target audience 
      - USE EMOJIS where relevant 🧠🔥💡💀🌸 
      - Use **bold** for key terms and major ideas 
      - Use *italics* for secondary emphasis or side notes 
      - Eliminate repetitive or overlapping content 
      - Use **5–8 concise main sections** with paragraph breaks or bullet points (no essay blocks) 
      - Keep it clean, scannable, and **6-minute read max** At the end, always include: -  Use **blockquotes** to highlight key info (like this ➤) ⚠️ IMPORTANT: - NO unnecessary fluff like “here’s your summary” 😤 
      - DO NOT use the word *"chunk"* ANYWHERE 💀 
      - DO NOT use backticks unless you are showing actual \`code\` 
      - Final output should be **Markdown format only**, ready to render directly to users 
      - Make it **friendly, easy to scan, visually clear**, and a lil fun if you can 💅 
      - Use bold in interesting information not in headlines
      
      context: --- 
       ${textChunk} --- 

       
     Mandatorily Use tables to visualize info


      Output: **Final Consolidated Summary use gen z slangs everywhere, use gen z slangs only, make it homie friendly, use gen z headline at first with # tag always others ##, ###, dont use bold in heading. use that, before heading dont give anything, while maintaining my structure for response (Markdown Format Only)** 
      `
      // setSummaryComplexity("genz")
    }

    const logPrefix = `SummaryTab: [${isFinalCombine ? 'Final Combine' : `Chunk ${chunkIndex + 1}/${totalChunks}`}]`;
    console.log(`${logPrefix} Requesting summary via Novita.ai...`);

    await waitForSlot();
    prompt = prompt + `

    [SYSTEM]
     Analyze the context thoroughly and mandatorily present a comparative analysis using Markdown tables. You must include at least one well-structured Markdown table, and use 2–3 tables if necessary to clearly highlight contrasts, similarities, or key differences between concepts, elements, or perspectives.

    Each table must follow this format:

    | Aspect         | Item A            | Item B            |
    |----------------|-------------------|-------------------|
    | Definition     | Description A     | Description B     |
    | Purpose        | Purpose A         | Purpose B         |

    ✅ Tables are not optional.
    ✅ Use bullet points or short sentences inside table cells if needed.
    ✅ Ensure the tables are directly relevant and insightful.
    ✅ Organize content for readability and depth of understanding. 

    Generate a Mermaid flowchart on given context 

    ⚠️ Important Syntax Rules:


     Generate a 2-4 valid Mermaid flowchart on the context with resposne for better understanding with the following conditions:
Do not add parentheses () or brackets [] anywhere in the labels or the flowchart, under any circumstances.

Use graph TD at the beginning to define a top-down flow.

Each node should have a single-line label (no line breaks or multi-line text).

Do not include special characters like %, &, ", or unmatched parentheses inside labels.

Do not use brackets or parentheses in labels; label each node with the format A[Label] where the label is concise and without line breaks.

To represent multiple inputs to a node, define each edge separately (e.g., A --> C and B --> C instead of A & B --> C).

Ensure that there are no semicolons (;) at the end of any line.



Wrap the Mermaid code block inside triple backticks and label it as mermaid in Markdown syntax.

Example Output:

graph TD

    Sunlight -->|Input sunlight| Photosynthesis
    CO2 -->|Input CO2| Photosynthesis
    Water -->|Input water| Photosynthesis
    Photosynthesis --> Photosynthesis_Process
    Photosynthesis_Process -->|Output sugar| Sugar_Output
    Photosynthesis_Process -->|Output oxygen| Oxygen_Output
    Sugar_Output -->|Input sugar| Cellular_Respiration
    Oxygen_Output -->|Input oxygen| Cellular_Respiration
    Cellular_Respiration --> Cellular_Respiration_Process
    Cellular_Respiration_Process -->|Output CO2| CO2_Output
    Cellular_Respiration_Process -->|Output water| Water_Output
    Cellular_Respiration_Process -->|Output usable energy| Usable_Energy_Output
    CO2_Output -->|Cycle| Atmosphere_CO2
    Oxygen_Output -->|Output| Atmosphere_Oxygen
    Usable_Energy_Output --> Plant_Growth_Maintenance

    |Input sunlight| is needed Input sunlight is not valid at all same for cycle, output
    Dont use input and output, cycle etc. Just pure Mermaid. Plz give simple mermaid syntax
   
   
    Dont give anything like here you before tilte, Start the summary with # headline always, not anything else
   Don't generate any kind ascii art or text diagram. Ensure mermaid syntax is correct
  [/SYSTEM]

`
    try {

      setSummaryProgress("50% done (1-2 mins more)")
      console.log("Summary complex --->", summaryComplexity)

      // console.log("Summary promt --->", prompt)
      const result = await genAI.models.generateContentStream({
        model: "gemini-2.5-flash-lite-preview-06-17", // Ensure this model ID is correct and available
        contents: prompt, // Pass the dynamically created array

        config: {
          system_instruction: 'You are given a large text corpus and instructions. Consider yourself an pro, follow the instrcutions. Do some comparative analysis using markdown table format, its mandatory, Always start with a heading not unncessary text',
          // tools: [{ googleSearch: {} }],
          temperature: .45,
        },
      });

      let fullResponse = "";
      for await (const chunk of result) {
        // console.log(chunk)
        let newText = chunk.text; // assuming chunk has a .text() method
        fullResponse = fullResponse + newText;
        setIntermediateSummaryContent(fullResponse);
      }

      if (!fullResponse && !stream) { // Only throw error for non-stream if empty after completion
        throw new Error(`Novita AI returned an empty response.`);
      }

      if (stream && fullResponse === "") {
        console.warn(`${logPrefix} Novita AI stream resulted in an empty response after processing.`);
        // Depending on requirements, you might want to throw an error here too,
        // or just return the empty string. Let's return empty for now.
      }


      console.log(`${logPrefix} Received summary from Novita.ai.`);
      return fullResponse;

    } catch (err) {
      console.error(`${logPrefix} Error during Novita AI call:`, err);
      // Extract a more specific error message if possible
      const errorMessage = err.response?.data?.message || err.message || 'Unknown AI error';
      throw new Error(`Failed during ${isFinalCombine ? 'final summary' : `chunk ${chunkIndex + 1}`} generation via Novita: ${errorMessage}`);
    } finally {
      console.log(` Releasing slot.`);
      await releaseSlot();
    }
  }, [apiKey, model, summaryComplexity]); // Dependencies for Novita call


  // --- Update Summary in Database (unchanged) ---
  const updateSummaryInDb = async (summaryToSave) => {
    if (!fid) {
      console.error("SummaryTab: Cannot update summary, File ID is missing.");
      throw new Error("File ID not available.");
    }
    if (!summaryToSave || summaryToSave === "") {
      console.log("SummaryTab: Skipping DB update for empty summary.");
      return;
    }

    console.log(`SummaryTab: Updating summary in DB for fid: ${fid}`);
    setSummaryProgress("Saving progress...");

    const { error: updateError } = await supabase
      .from("file_data")
      .update({ summary: summaryToSave })
      .eq("file_id", fid);

    if (updateError) {
      console.error("SummaryTab: Error updating summary in DB:", updateError);
      throw updateError; // Propagate error
    }

    console.log("SummaryTab: Summary successfully updated in DB.");
    setSummaryProgress(""); // Clear saving message only on success
  };

  // --- Download PDF Function ---
  const downloadPDF = async () => {
    if (!displaySummary || isDownloadingPDF) return;

    setIsDownloadingPDF(true);
    setError(null);

    try {
      // Create a timestamp for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Summary_${timestamp}.pdf`;

      // Convert markdown to HTML for PDF generation
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Summary</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
            h1, h2, h3 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            blockquote { border-left: 4px solid #ddd; margin: 20px 0; padding-left: 20px; }
            code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          ${displaySummary}
        </body>
        </html>
      `;

      // Make API call to generate PDF
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: htmlContent,
          filename: filename
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();

      // Create download link and trigger download
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      setError(`Failed to generate PDF: ${pdfError.message || 'Unknown error'}`);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // --- Generate Full Summary with Credit Check & Usage Update (updated dependencies) ---
  const generateSummary = useCallback(async (summaryComplexity) => {
    // --- 1. PRE-GENERATION CHECK ---
    if (isGeneratingSummary.current) return;

    if (!derivedRawText || !genAI || !userUuid) { // Check Novita client 'openai'
      setError(
        !derivedRawText ? "Document text is missing." :
          !openai ? "Novita AI client not initialized." : // Updated error message
            "User information unavailable."
      );
      return;
    }
    // Check for API Key configuration
    if (!apiKey || apiKey === "YOUR_NOVITA_API_KEY") {
      setError("Novita API key is not configured. Cannot generate summary.");
      return;
    }

    setLoading(true);
    setError(null);

    // --- Check Credits ---
    setSummaryProgress("Checking available credits...");
    const availableCredits = await getSummaryUsage(supabase, userUuid, setError);
    if (availableCredits <= 0) {

      setError("Insufficient summary credits to generate a new summary.");
      setLoading(false);
      setSummaryProgress("");
      return;
    }
    console.log(`SummaryTab: User has ${availableCredits} credits. Proceeding with generation.`);
    // --- 2. GENERATION PROCESS ---
    console.log("SummaryTab: Starting multi-chunk summary generation via Novita.ai...");
    isGeneratingSummary.current = true;
    setIntermediateSummaryContent("");
    setFinalSummaryState(null);
    rawChunkSummariesRef.current = [];
    let accumulatedChunkSummaries = "";


    if (await getUserActivityUsage('summary') == 0) {
      toast("Usage limit reached, Buy premium!", {
        description: "For 5.99$ get higher usage limits",
        action: {
          label: "Buy",
          onClick: () => triggerProButtonDialog(),
        },
      })
    }
    // return
    try {
      const chunks = splitTextIntoChunks(derivedRawText, TARGET_WORDS_PER_CHUNK);
      if (chunks.length === 0) throw new Error("Text could not be split into chunks.");

      // --- Map Phase (Chunk Summarization) ---
      for (let i = 0; i < chunks.length; i++) {
        const chunkSummary = await summarizeTextChunk(chunks[i], false, i, chunks.length, summaryComplexity);
        rawChunkSummariesRef.current.push(chunkSummary);

        const separator = accumulatedChunkSummaries ? "\n\n---\n\n" : "";
        const chunkHeader = `**Summary for part ${i + 1} of ${chunks.length}:**\n\n`;
        // Only add chunk if summary isn't empty
        if (chunkSummary && chunkSummary !== "") {
          accumulatedChunkSummaries += separator + chunkHeader + chunkSummary;
        } else {
          console.warn(`SummaryTab: Chunk ${i + 1} resulted in an empty summary, skipping.`);
          // Optionally add a placeholder or note in the intermediate display
          // accumulatedChunkSummaries += separator + chunkHeader + "*No summary generated for this chunk.*";
        }


        setFadeKey(prevKey => prevKey + 1);
        setIntermediateSummaryContent(accumulatedChunkSummaries); // Display accumulated chunk summaries

        // --- Periodic Saving ---
        if ((i + 1) % SAVE_INTERMEDIATE_EVERY_N_CHUNKS === 0 && i < chunks.length - 1) {
          try {
            await updateSummaryInDb(accumulatedChunkSummaries);
          } catch (dbError) {
            console.warn("SummaryTab: Failed to save intermediate summary, continuing generation...", dbError);
          }
        }

        // --- Delay between chunks ---
        if (i < chunks.length - 1) {
          const delay = DELAY_BETWEEN_CHUNKS_MIN_MS + Math.random() * (DELAY_BETWEEN_CHUNKS_MAX_MS - DELAY_BETWEEN_CHUNKS_MIN_MS);
          setSummaryProgress(`Waiting ${Math.round(delay / 1000)}s before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // --- Reduce Phase (Final Combination) ---
      let finalCombinedSummary;
      const validRawSummaries = rawChunkSummariesRef.current.filter(s => s && s !== "");

      if (validRawSummaries.length === 0) {
        console.warn("SummaryTab: No valid chunk summaries were generated. Cannot create final summary.");
        throw new Error("Failed to generate summaries for any text chunk.");
      } else if (chunks.length === 1 || validRawSummaries.length === 1) {
        // If only one chunk originally OR only one chunk produced a valid summary
        finalCombinedSummary = validRawSummaries[0];
        console.log("SummaryTab: Single valid chunk summary detected, using it as final.");
      } else {
        const combinedForFinalPass = validRawSummaries.join("\n\n---\n\n");
        finalCombinedSummary = await summarizeTextChunk(combinedForFinalPass, true, 0, validRawSummaries.length, summaryComplexity); // Pass valid summary count
      }
      console.log("SummaryTab: Final summary generated via Novita.ai.");

      // --- Final Update & Save ---
      setSummaryProgress("Saving final summary...");
      setIntermediateSummaryContent(finalCombinedSummary); // Update display immediately
      setFinalSummaryState(finalCombinedSummary);          // Update final atom state

      await updateSummaryInDb(finalCombinedSummary); // Save the final version to DB

      // --- 3. POST-GENERATION: UPDATE USAGE (only after successful save) ---
      await updateSummaryUsage(supabase, userUuid)
      // Update fileContent atom (optional, but good for consistency)
      setFileContent((prev) => prev ? [{ ...prev[0], summary: finalCombinedSummary }] : null);

      setFadeKey(prevKey => prevKey + 1); // Trigger final fade animation

    } catch (error) {
      console.error("SummaryTab: Error during multi-step summary generation:", error);
      setError(`Failed to generate summary: ${error.message}. ${accumulatedChunkSummaries ? 'Last successful progress might be shown.' : ''}`);
      // Keep the intermediate content if generation failed mid-way
      if (accumulatedChunkSummaries) {

        setFinalSummaryState(accumulatedChunkSummaries);
        setIntermediateSummaryContent(accumulatedChunkSummaries); // Ensure display reflects this state
      }
    } finally {
      // --- 4. CLEANUP ---
      setLoading(false);
      setSummaryProgress("");
      isGeneratingSummary.current = false;
    }
  }, [
    derivedRawText,
    // Removed client
    userUuid,
    fid,
    apiKey, // Added apiKey as dependency for checks

    summarizeTextChunk, // This now depends on Novita config indirectly
    updateSummaryInDb,
    setFinalSummaryState,
    setFileContent,
    // No need for openai instance in deps if it doesn't change
  ]);

  // --- Fetch file data (unchanged logic, updated dependencies) ---
  const fetchFileData = useCallback(async () => {
    if (!fid) {
      setFinalSummaryState(null);
      setFileContent(null);
      setError(null);
      setIntermediateSummaryContent("");
      return null;
    }

    if (isFetchingData) return;

    console.log(`SummaryTab: Fetching data for file ID: ${fid}`);
    setIsFetchingData(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from("file_data")
        .select("raw_text, summary")
        .eq("file_id", fid)
        .maybeSingle();

      if (dbError) throw dbError;

      const newRawText = data?.raw_text || "";
      const newSummary = data?.summary || null;

      setFileContent([{ raw_text: newRawText, summary: newSummary }]);
      setFinalSummaryState(newSummary);
      if (!isGeneratingSummary.current) {
        setIntermediateSummaryContent(newSummary || "");
      }

      console.log("SummaryTab: File data fetched and states updated.");
      return { raw_text: newRawText, summary: newSummary };

    } catch (error) {
      console.error("SummaryTab: Error fetching file data:", error);
      setError(`Failed to load document data: ${error.message}`);
      setFileContent(null);
      setFinalSummaryState(null);
      setIntermediateSummaryContent("");
      return null;
    } finally {
      setIsFetchingData(false);
    }
  }, [fid, setFileContent, setFinalSummaryState, isFetchingData]); // Removed isGeneratingSummary from deps, handled internally


  // --- Effect: Fetch data & Auto-generate if needed (unchanged logic, updated dependencies) ---
  useEffect(() => {
    // Basic check for API key configuration on mount/fid change
    if (fid && (!apiKey || apiKey === "YOUR_NOVITA_API_KEY")) {
      console.error("SummaryTab Effect: Novita API key is missing or placeholder.");
      setError("Novita AI Service is not configured (API Key missing). Cannot generate summaries.");
      // Potentially clear states or prevent further actions
      setLoading(false);
      isGeneratingSummary.current = false;
      return; // Prevent fetching/generation if key is missing
    } else if (error === "Novita AI Service is not configured (API Key missing). Cannot generate summaries.") {
      // Clear the specific API key error if the key becomes available (e.g., through env vars later)
      setError(null);
    }


    if (fid) {
      console.log(`SummaryTab Effect: FID changed to ${fid}. Fetching data.`);
      fetchFileData().then(data => {

        const currentRawText = fileContent?.[0]?.raw_text || ""; // Get potentially updated raw text

        if (data && !data.summary && !loading && !isGeneratingSummary.current && currentRawText) {
          console.log(`SummaryTab Effect: Data fetched for ${fid}, no summary found. Triggering auto-generation.`);
          generateSummary();
        } else if (data && data.summary) {
          console.log(`SummaryTab Effect: Data fetched for ${fid}, summary exists.`);
        } else if (!data) {
          console.log(`SummaryTab Effect: No data returned from fetch for ${fid}.`);
        } else {
          console.log(`SummaryTab Effect: Conditions not met for auto-generation for ${fid}. loading=${loading}, isGenerating=${isGeneratingSummary.current}, hasSummary=${!!data?.summary}, hasRawText=${!!currentRawText}`);
        }
      });
    } else {
      console.log("SummaryTab Effect: FID is null. Clearing states.");
      setFileContent(null);
      setFinalSummaryState(null);
      setError(null);
      setIntermediateSummaryContent("");
      isGeneratingSummary.current = false;
      setLoading(false);
    }

  }, [fid]); // Make sure effect re-evaluates if loading state changes or generateSummary updates


  // --- Render Logic (Unchanged) ---
  const showLoadingIndicator = isFetchingData || loading;
  const showGenerateButton = !displaySummary && !showLoadingIndicator && derivedRawText && !isGeneratingSummary.current;
  const showSummaryContent = !!displaySummary && !isFetchingData;
  const showPlaceholder = !derivedRawText && !showLoadingIndicator && !error && !displaySummary;

  // Conditional retry button logic (check if error is related to API key)
  const showRetryButton = error?.toLowerCase().includes("generate") &&
    derivedRawText &&
    !error?.toLowerCase().includes("credits") &&
    !error?.toLowerCase().includes("api key"); // Don't show retry if API key is the issue


  return (
    <div className="flex flex-col dark:bg-zinc-900 bg-gray-100 max-h-full h-full text-slate-800 dark:text-zinc-100 items-center  justify-center overflow-y-auto scrollbar-hide relative w-full bg-blue-200 pl20 overflow-x-scroll">

      {/* Loading Indicator */}
      {showLoadingIndicator && (
        <LoadingSpinner message={false ? "Loading document..." : summaryProgress || "Generating summary..."} />
      )}

      {/* Error Display */}
      {error && !loading && (
        <div className=" text-red-500 dark:text-red-400 mt-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-300 dark:border-red-700 rounded-md w-full max-w-2xl text-center z-10">
          <p>{error}</p>
          {/* Show Retry button only for generation errors (excluding credits/API key issues) and if text exists */}
          {showRetryButton && (
            <button
              onClick={generateSummary}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              disabled={loading || isGeneratingSummary.current || isFetchingData}
            >
              Retry Generation
            </button>
          )}
          {/* Specific message for API Key error */}
          {error?.toLowerCase().includes("api key") && (
            <p className="mt-2 text-sm">Please configure the Novita API key correctly.</p>
          )}
        </div>
      )}

      {/* Generate Button (Commented out as per original code) */}
      {/* {showGenerateButton && ( ... )} */}

      {/* Placeholder when no text is available */}

      {showPlaceholder && (
        <div className="text-center text-gray-500 dark:text-gray-400">
          <BookOpenText size={80} className="mx-auto my-3 opacity-50" />
          <p>No document text found or loaded.</p>
          <p className="text-sm mt-1">Upload a document or select one.</p>
        </div>
      )}
      {showSummaryContent && (
        <div>

        </div>)}
      {showSummaryContent && <button onClick={async () => { setSummaryComplexity("fal"); await generateSummary('fal') }} className="px-4 py-2  flex flex-row items-center justify-center gap-2 absolute transform   -left-6 md:left-4  rounded-lg -top-0 z-40 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white bg-zinc-800 dark:text-zinc-200 scale-[.6] md:scale-[1]">
        <RefreshCwIcon size={15} />REGENERATE</button>}


      {showSummaryContent && <button onClick={async () => { setSummaryComplexity("eli5"); await generateSummary('eli5') }} className="px-4 py-2 flex flex-row items-center justify-center gap-2 absolute transform -right-8 md:right-7 rounded-lg -top-0 z-40 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white bg-zinc-800 dark:text-zinc-200 scale-[.6] md:scale-[1]">
        <RefreshCwIcon size={15} />Explain like I am 6!</button>

      }


      {showSummaryContent && <button onClick={async () => { setSummaryComplexity("genz"); await generateSummary('genz') }} className="px-4 py-2 flex flex-row items-center justify-center gap-2 absolute transform right-24 md:right-56 rounded-lg -top-0 z-40 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white bg-zinc-800 dark:text-zinc-200 scale-[.6] md:scale-[1]">
        <RefreshCwIcon size={15} />Explain with vibes!</button>}

      {/* Download PDF Button */}
      {/* {showSummaryContent && (
        <button
          onClick={downloadPDF}
          disabled={isDownloadingPDF}
          className="px-3 py-2 flex items-center justify-center absolute transform left-48 md:left-48 rounded-lg top-2 z-40 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white bg-zinc-800 dark:text-zinc-200 scale-[.6] md:scale-[1] hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download as PDF"
        >
          <Download size={15} />
        </button>
      )} */}

      {/* <h1 className={ibmPlexMono.className}  > hello ----- —— \ \ ____</h1>
      <h1 className={ibmPlexMono.className}  > hello ----- —— U+2502 \ ____</h1> */}
      {
        showSummaryContent && (
          <div
            key={fadeKey}
            className="mt-5 p-4 border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-zinc-200 shadow-md overflow-y-auto min-w-full  scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-200 dark:scrollbar-track-zinc-800 break-words  fade-in-summary"
          >
            {/* <RichMarkdown mark={displaySummary} /> */}
            {loading ? (
              <RichMarkdown mark={displaySummary} />
            ) : (
              <ErrorBoundary
                errorComponent={<RichMarkdown mark={displaySummary} />}
                onError={() => generateSummary(summaryComplexity)}
              >
                <RichMermaidMarkdown mark={displaySummary} />
              </ErrorBoundary>
            )}


          </div>
        )
      }

    </div >
  );
}