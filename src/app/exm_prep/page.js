'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFileText, FiX, FiTrash2, FiLoader, FiAlertCircle, FiZap, FiMenu, FiArrowLeft, FiArrowRight, FiCheck, FiStar, FiEye, FiDownload } from 'react-icons/fi';
import Sidebar from './Sidebar';
import {
    GoogleGenAI,
    createUserContent,
    createPartFromUri,
} from "@google/genai";
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import RichMarkdownEXM from '../components/RichMarkEXM';
import { getExmPrepUsage, updateExmPrepUsage } from '../components/c_supabaseData'
import {
    extractTextFromPdf,
    convertDocxToPdfAPI,
    fetchUserPrepsFromDB,
    fetchPrepContentById,
    savePrepToDB,
    deletePrepFromDB,
} from './helpers';

import { supabase } from '../lib/supabaseClient';
import { useAtomValue } from "jotai";
import {
    user_id_supabase,
} from "../../store/uploadAtoms";
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const MAX_FILES = 20;
const MAX_USER_PREPS = 300;
const SUPPORTED_FORMATS = {
    'application/pdf': ['.pdf'],
};
const CONVERTAPI_CONFIGURED = false;

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk";

const AI_CONFIGURED = GOOGLE_API_KEY

let genAI;
if (AI_CONFIGURED) {
    try {
        genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
        console.log("Google AI SDK Initialized");
    } catch (e) {
        console.error("Error initializing Google AI SDK:", e);
    }
} else {
    console.warn("Google API Key not configured or is placeholder. AI features disabled.");
}

export default function ExamPrepCreator() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [prepName, setPrepName] = useState('');
    const [studyFilesData, setStudyFilesData] = useState([]);
    const [sampleFile, setSampleFile] = useState(null);
    const [customInstructions, setCustomInstructions] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [generatedQuiz, setGeneratedQuiz] = useState('');
    const [userPreps, setUserPreps] = useState([]);
    const [selectedPrepContent, setSelectedPrepContent] = useState(null);
    const [activePrepId, setActivePrepId] = useState(null);
    const [loadingPrepContent, setLoadingPrepContent] = useState(false);
    const [uploadedFilesForCurrentPrep, setUploadedFilesForCurrentPrep] = useState([]);
    const [totalItems, setTotalItems] = useState(30);
    const userId = useAtomValue(user_id_supabase);
    const fileInputRef = useRef(null);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [currentStep, setCurrentStep] = useState(1);
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === 'enabled') {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDarkMode(false);
        }
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'enabled');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'disabled');
        }
    }, [isDarkMode]);

    const loadPreps = useCallback(async () => {
        if (!userId) return;

        setIsLoading(true);
        setLoadingMessage('Loading preparations...');
        try {
            const preps = await fetchUserPrepsFromDB(userId);
            setUserPreps(preps || []);
        } catch (error) {
            console.error('Error loading preparations:', error);
            setError('Failed to load preparations. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [userId]);

    const processAndUploadFiles = useCallback(async files => {
        if (!genAI) {
            setError("Google AI SDK not initialized.");
            return;
        }

        const limit = MAX_FILES - studyFilesData.filter(f => ['uploaded', 'uploading'].includes(f.status)).length;
        const toProcess = files.slice(0, limit);
        if (!toProcess.length) return;

        setError('');
        // setShowDeleteFilesButton(false);

        const now = Date.now();
        const temp = toProcess.map((file, i) => ({ id: now + i, file, status: 'queued', error: null, googleFileMetadata: null }));
        setStudyFilesData(p => [...p, ...temp]);

        for (const f of temp) {
            const update = (s, extra = {}) => setStudyFilesData(p => p.map(x => x.id === f.id ? { ...x, status: s, ...extra } : x));
            try {
                let fileToProcess = f.file;
                let type = fileToProcess.type;
                if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    if (!CONVERTAPI_CONFIGURED) throw new Error("DOCX conversion not configured. Please upload PDF.");
                    update('converting');
                    const { pdfBlob } = await convertDocxToPdfAPI(fileToProcess); // Ensure convertDocxToPdfAPI is correctly implemented
                    fileToProcess = pdfBlob; type = 'application/pdf';
                }
                if (type !== 'application/pdf') throw new Error(`Unsupported type: ${type}. Please upload PDF.`);
                update('uploading');
                // Ensure genAI.files.upload is correctly called. The example uses genAI.uploadFile.
                // Assuming genAI.files.upload is the correct SDK method based on original code.
                const r = await genAI.files.upload({ file: fileToProcess, config: { mimeType: type } });
                const meta = { name: r.name, uri: r.uri, mimeType: r.mimeType }; // Adjust according to actual response structure
                update('uploaded', { googleFileMetadata: meta });
                setUploadedFilesForCurrentPrep(p => [...p, meta]);
            } catch (e) {
                console.error(`Upload failed for ${f.file.name}:`, e);
                update('error', { error: e.message });
            }
        }
    }, [studyFilesData]);


    const handleRemoveStudyFile = async id => {
        const f = studyFilesData.find(x => x.id === id);
        if (!f) return;
        const n = f.googleFileMetadata?.name;
        if (f.status === 'uploaded' && n) {
            setStudyFilesData(p => p.map(x => x.id === id ? { ...x, status: 'deleting' } : x));
            try {
                if (genAI && genAI.deleteFile) { // Check if deleteFile method exists
                    await genAI.deleteFile(n);
                } else if (genAI && genAI.files && genAI.files.delete) { // Alternative path if SDK structure changed
                    await genAI.files.delete({ name: n });
                } else {
                    console.warn("genAI.deleteFile or genAI.files.delete method not found. Skipping server-side deletion.");
                }
                setUploadedFilesForCurrentPrep(p => p.filter(x => x.name !== n));
            } catch (e) { console.error(`Delete failed for ${n}:`, e); }
        }
        setStudyFilesData(p => p.filter(x => x.id !== id));
        if (n) {
            setUploadedFilesForCurrentPrep(p => p.filter(x => x.name !== n));
        }
    };


    const handleSampleFileChange = async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        setSampleFile({ file: f, text: '', error: 'processing...' });
        setError('');
        // setCustomInstructions(''); // Do not clear custom instructions when sample file changes, user might want to switch
        try {
            if (f.type !== 'application/pdf') throw new Error('Sample file must be PDF.');
            const text = await extractTextFromPdf(f);
            setSampleFile({ file: f, text, error: null });
        } catch (e) {
            console.error(`Sample error: ${f.name}`, e);
            setSampleFile({ file: f, text: '', error: e.message });
        }
    };

    const handleRemoveSampleFile = () => {
        setSampleFile(null);
        const i = document.getElementById('sample-file-input');
        if (i) i.value = '';
    };


    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        processAndUploadFiles(acceptedFiles);
        if (rejectedFiles && rejectedFiles.length > 0) {
            console.warn("Rejected files:", rejectedFiles);
            setError(`Some files were rejected. Ensure they are PDF format. Rejected: ${rejectedFiles.map(r => r.file.name).join(', ')}`);
        }
    }, [processAndUploadFiles]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: SUPPORTED_FORMATS,
        maxFiles: MAX_FILES,
        multiple: true,
        disabled: !AI_CONFIGURED || isLoading || loadingPrepContent || studyFilesData.filter(f => f.status === 'uploaded' || f.status === 'uploading').length >= MAX_FILES,
    });


    const successfullyUploadedFiles = studyFilesData.filter(f => f.status === 'uploaded' && f.googleFileMetadata);
    const filesCurrentlyProcessing = studyFilesData.some(f => ['uploading', 'converting', 'deleting', 'queued'].includes(f.status));
    const hasFileErrors = studyFilesData.some(f => f.status === 'error');
    const hasReachedPrepLimit = userPreps.length >= MAX_USER_PREPS;

    const canSubmit = AI_CONFIGURED
        && prepName.trim() !== ''
        && successfullyUploadedFiles.length > 0
        && !filesCurrentlyProcessing
        && !hasFileErrors
        && !isLoading
        && !loadingPrepContent
        && !hasReachedPrepLimit;


    const handleSubmit = async (event) => {
        if (event) event.preventDefault(); // Ensure event is passed and preventDefault is called
        if (!canSubmit) {
            if (!AI_CONFIGURED) setError("AI Service is not configured.");
            else if (prepName.trim() === '') setError("Please enter a preparation name.");
            else if (successfullyUploadedFiles.length === 0) setError("Please upload at least one study file successfully.");
            else if (filesCurrentlyProcessing) setError("Please wait for file processing to complete.");
            else if (hasFileErrors) setError("Please resolve file errors before submitting.");
            else if (hasReachedPrepLimit) setError("Preparation limit reached. Please delete an existing prep to create a new one.");
            return;
        }
        if (!genAI || !genAI.models || typeof genAI.models.generateContent !== 'function') { // More robust check for genAI
            setError("Google AI client or model could not be initialized.");
            return;
        }


        setIsLoading(true);
        setLoadingMessage("Generating super-duper prep in 3 min...");
        setError('');
        setGeneratedQuiz('');
        setSelectedPrepContent(null);
        setActivePrepId(null);
        // setShowDeleteFilesButton(false);

        const filesToUseInPrompt = uploadedFilesForCurrentPrep;

        if (filesToUseInPrompt.length === 0) {
            setError("Internal error: No uploaded file references found for generation.");
            setIsLoading(false);
            setLoadingMessage('');
            return;
        }

        const availableCredits = await getExmPrepUsage(supabase, userId, setError);
        if (availableCredits <= 0) {
            setError("Insufficient exam credits to generate a new exam prep.");
            setIsLoading(false);
            setLoadingMessage('');
            return;
        }

        await waitForSlot(); // Assuming this is an async function that resolves
        try {
            const hasSampleFile = sampleFile?.text && !sampleFile.error;
            const numMCQs = Math.floor(totalItems * 0.5);
            const numShortAnswer = Math.floor(totalItems * 0.25);
            const numBroadAnswer = Math.floor(totalItems * 0.25);
            // Ensure numFillBlanks is non-negative
            const numFillBlanks = Math.max(0, totalItems - numMCQs - numShortAnswer - numBroadAnswer);
            const estimatedTime = Math.max(30, Math.round(numMCQs * 1.5 + numShortAnswer * 3 + numBroadAnswer * 5));
            const subjectName = prepName.trim() || "[Subject Name / Course Title]"; // Use prepName for subject
            const examTitle = "Comprehensive Assessment";
            // const generalInstructions = `Answer all ${totalItems} questions. Section A: MCQs (${numMCQs}), Section B: Short Answers (${numShortAnswer}), Section C: Extended Responses (${numBroadAnswer}), Section D: Fill Blanks (${numFillBlanks}). Time: ${estimatedTime} mins.`;


            let instructionTextPart;
            const baseInstructions = `
            🧠 Learningly AI – Formal Assessment Generator (Markdown Version)

            **Your TASK is to generate a ${totalItems}-item assessment ONLY using the provided documents. The output MUST be STRICTLY and ONLY in Markdown format. NO HTML. NO CODE BLOCKS. NO TEXT OUTSIDE THE MARKDOWN STRUCTURE.**

            Adhere ABSOLUTELY to the specified Markdown structure for every question and the answer key. The AI MUST follow this structure PRECISELY.

            ---

            📎 **Custom Instructions:**
            ${customInstructions || "No additional custom instructions provided."}

            ---

            📌 **MANDATORY Markdown Output Structure & Guidelines:**

            1. **Entire Output Must Be Valid Markdown**
                - Use standard Markdown syntax: # for headings, * for lists, ** for bold, etc.
                - DO NOT include any HTML tags.
                - DO NOT include any code blocks (\`\`\`).
                - The output must be clean, readable Markdown ready for rendering.

            2. **Header Section Structure**
                Include the assessment title and time limit at the beginning.
                \`\`\`
                # ${subjectName} - ${examTitle}

                **Time:** ${estimatedTime} minutes
                **Total Marks:** ${totalItems * 2}

                ## Instructions:
                1. Answer all ${totalItems} questions.
                2. Section A: Multiple Choice (${numMCQs} questions × 2 marks each)
                3. Section B: Short Answer (${numShortAnswer} questions × 2 marks each)
                4. Section C: Extended Responses (${numBroadAnswer} questions × 2 marks each)
                5. Section D: Fill in the Blanks (${numFillBlanks} questions × 2 marks each)
                6. Time Limit: ${estimatedTime} minutes
                \`\`\`

            3. **Question Formatting Structure (CRITICAL - ADHERE PRECISELY)**
                - **EACH question MUST be separated by a blank line.**
                - The question number MUST be formatted as **bold**.
                - Multiple Choice Options MUST use [ ] for checkboxes, and **each option MUST be on its own line (not inline)**.
                - Include a blank line between each question.

                **Example MCQ Block (FOLLOW THIS EXACT STRUCTURE):**
                \`\`\`
                **Q1.** What is the primary function of the mitochondria in eukaryotic cells?

                [ ] A. Photosynthesis
                [ ] B. Protein synthesis
                [ ] C. Energy production (ATP)
                [ ] D. Waste removal
                \`\`\`

                **Example Short Answer Block (FOLLOW THIS EXACT STRUCTURE):**
                \`\`\`
                **Q${numMCQs + 1}.** Briefly explain the concept of cellular respiration.

                Answer: ________________________________________________
                \`\`\`

                **Example Fill-in-the-Blank Block (FOLLOW THIS EXACT STRUCTURE):**
                \`\`\`
                **Q${totalItems}.** The process by which plants convert light energy into chemical energy is called ________.
                \`\`\`

            4. **Content Distribution & Quality**
                - Use content from ALL provided documents **evenly and accurately**.
                - Avoid generating content not supported by the documents (no hallucinations).
                - Ensure a good mix of question types as outlined in the header section.
                - Each question should be clear, concise, and test a specific concept.

            5. **Answer Key Structure (CRITICAL - ADHERE PRECISELY)**
                - Add a final section AT THE END of the Markdown output for the answer key.
                - Use this structure:
                \`\`\`
                ## Answer Key

                ### Section A: Multiple Choice
                1. C
                2. B
                <!-- Continue for all MCQs -->

                ### Section B: Short Answer
                1. [Key points to include in answer]
                <!-- Continue for all short answers -->

                ### Section C: Extended Responses
                1. [Detailed answer/rubric notes]
                <!-- Continue for all extended responses -->

                ### Section D: Fill in the Blanks
                1. Photosynthesis
                <!-- Continue for all fill in the blanks -->
                \`\`\`

            6. **FINAL Output Requirements Summary**
                - Produce ONLY the Markdown, no surrounding text, no HTML, no code fences.
                - Include **EXACTLY ${totalItems} questions** following the structure above.
                - End with a complete and correctly formatted Answer Key section.
                - The Markdown must be clean, semantic, and ready for direct display or PDF conversion.
                - Each question must be properly numbered and formatted according to its type.
                - The answer key must be comprehensive and match the question format.

            GENERATE THE FULL MARKDOWN ASSESSMENT NOW, FOLLOWING ALL INSTRUCTIONS ABOVE PRECISELY.
            `;

            if (hasSampleFile) {
                instructionTextPart =
                    "🧠 Learningly AI – Formal Assessment Generator (Markdown Version)\n\n" +
                    "**Your TASK is to generate a **" + totalItems + "-item** assessment ONLY using the provided documents. Follow the structure, language, and formatting style of the sample file. The output MUST be STRICTLY and ONLY in the specific Markdown structure provided below. NO HTML. NO CODE BLOCKS. NO TEXT OUTSIDE THE MARKDOWN STRUCTURE.**\n\n" +
                    "Adhere ABSOLUTELY to the specified Markdown structure for every question and the answer key. The AI MUST follow this structure PRECISELY.\n\n" +
                    "---\n\n" +
                    "📎 **Custom Instructions (ignore if sample file provides sufficient guidance on format, otherwise integrate these needs):**\n" +
                    customInstructions + "\n\n" +
                    "---\n\n" +
                    "📄 **Sample Format (PRIORITIZE THIS for structure and style if provided):**\n" +
                    sampleFile.text + "\n\n" +
                    "---\n\n" +
                    "📌 **MANDATORY Markdown Output Structure & Guidelines (Refer to this if sample is unclear or for general rules):**\n\n" +
                    "1. **Entire Output Must Be Valid Markdown**\n" +
                    "   - Use standard Markdown syntax: # for headings, * for lists, ** for bold, etc.\n" +
                    "   - Do **not** include any HTML tags.\n" +
                    "   - Do **not** include any code blocks (\`\`\`).\n" +
                    "   - Ensure all Markdown is clean, readable, and render-ready for browser or PDF export.\n\n" +
                    "2. **Header Section Structure**\n" +
                    // Using template literals for easier reading of Markdown structure
                    `   # ${subjectName} - ${examTitle}

   **Time:** ${estimatedTime} minutes
   ## Instructions:
   1. Answer all ${totalItems} questions.
   2. Section A: Multiple Choice (select best answer) - Approximately ${numMCQs} questions.
   3. Section B: Short Answer (concise responses) - Approximately ${numShortAnswer} questions.
   4. Section C: Extended Responses (detailed answers) - Approximately ${numBroadAnswer} questions.
   5. Section D: Fill in the Blanks (complete the sentence) - Approximately ${numFillBlanks} questions.
   6. Time Limit: ${estimatedTime} minutes
   \n\n` +
                    "3. **Question Formatting Structure (CRITICAL - ADHERE PRECISELY)**\n" +
                    "   - **EACH question MUST be separated by a blank line.**\n" +
                    "   - The question number MUST be formatted as **bold**.\n" +
                    "   - Multiple Choice Options MUST use [ ] for checkboxes.\n" +
                    "   - Include a blank line between each question.\n\n" +
                    `   **Example MCQ Block (FOLLOW THIS EXACT STRUCTURE):**
   **Q1.** What is the primary function of the mitochondria in eukaryotic cells?

   [ ] A. Photosynthesis
   [ ] B. Protein synthesis
   [ ] C. Energy production (ATP)
   [ ] D. Waste removal
   \n\n` +
                    "4. **Content Distribution & Quality**\n" +
                    "   - Use content from ALL provided documents **evenly and accurately**.\n" +
                    "   - Avoid generating content not supported by the documents (no hallucinations).\n" +
                    "   - Ensure a good mix of question types as outlined in the header section, covering the provided material comprehensively.\n\n" +
                    "5. **Answer Key Structure (CRITICAL - ADHERE PRECISELY)**\n" +
                    "   - Add a final section AT THE END of the Markdown output for the answer key.\n" +
                    `   ## Answer Key

   ### Section A: Multiple Choice
   1. C
   2. B
   <!-- Continue for all MCQs -->

   ### Section B: Short Answer
   1. [Brief Explanation or Key Points for Short Answer]
   <!-- Continue for all short answers -->

   ### Section C: Extended Responses
   1. [Detailed Answer/Rubric Notes for Extended Response]
   <!-- Continue for all extended responses -->

   ### Section D: Fill in the Blanks
   1. Photosynthesis
   <!-- Continue for all fill in the blanks -->
   \n\n` +
                    "6. **FINAL Output Requirements Summary**\n" +
                    "- Produce ONLY the Markdown, no surrounding text, no HTML, no code fences.\n" +
                    `- Include **EXACTLY ${totalItems} questions** following the structure above.\n` +
                    "- End with a complete and correctly formatted Answer Key section.\n" +
                    "- The Markdown must be clean, semantic, and ready for direct display or PDF conversion.\n\n" +
                    "GENERATE THE FULL MARKDOWN ASSESSMENT NOW, FOLLOWING ALL INSTRUCTIONS ABOVE PRECISELY.";
            } else {
                instructionTextPart = baseInstructions;
            }


            console.log("Sending request to Gemini with file parts:", filesToUseInPrompt.map(f => f.uri));
            console.log("Instructions text length:", instructionTextPart.length);

            const contentParts = [
                ...filesToUseInPrompt.map(meta => createPartFromUri(meta.uri, meta.mimeType)), // Ensure createPartFromUri is correctly implemented
                instructionTextPart
            ];

            console.log("Content Parts for API Call:", contentParts.length);

            const result = await genAI.models.generateContent({
                model: "gemini-1.5-flash-latest", // Using the model from your original code, ensure it's available. Original had: gemini-2.5-pro-preview-05-06
                contents: createUserContent(contentParts), // Ensure createUserContent is correctly implemented
                generationConfig: { temperature: 0.1 }, // Corrected from 'config' to 'generationConfig'
            });

            console.log("Gemini Response Received:", result);

            // Safely access the text from the response
            let quizResultText = '';
            if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
                result.response.candidates[0].content && result.response.candidates[0].content.parts &&
                result.response.candidates[0].content.parts.length > 0 && result.response.candidates[0].content.parts[0].text) {
                quizResultText = result.response.candidates[0].content.parts[0].text;
            } else if (result && typeof result.text === 'function') { // Fallback for older SDK or different response structure
                quizResultText = await result.text(); // if result.text is an async function
            } else if (result && result.text) { // if result.text is a direct property
                quizResultText = result.text;
            }


            if (!quizResultText) throw new Error("AI service returned an empty or malformed response. Check console for Gemini response details.");

            const removeBackticks = (code) => code.replace(/```(?:html)?\n?([\s\S]*?)```/g, '$1').trim();
            const quizResult = removeBackticks(quizResultText);

            console.log("Gemini text Received (cleaned):", quizResult);

            if (!quizResult) throw new Error("AI service returned an empty response after cleaning.");
            setGeneratedQuiz(quizResult);
            setCurrentStep(1); // Reset to first step after generation

            setLoadingMessage("Saving preparation...");
            const prepData = {
                user_id: userId,
                prep_name: prepName.trim(),
                file_names: JSON.stringify(successfullyUploadedFiles.map(f => f.file.name)), // Ensure f.file.name exists
                model_response: quizResult,
                sample_instruction: hasSampleFile ? `Sample File: ${sampleFile.file.name}` : customInstructions.trim() || "Default: MC Quiz",
                total_items: totalItems, // Save total items
            };
            const savedPrep = await savePrepToDB(prepData); // Ensure savePrepToDB is correctly implemented
            await updateExmPrepUsage(supabase, userId); // Ensure updateExmPrepUsage is correctly implemented

            if (savedPrep && savedPrep.id && savedPrep.prep_name) { // Check if savedPrep is valid
                setUserPreps(prev => [{ id: savedPrep.id, prep_name: savedPrep.prep_name, total_items: savedPrep.total_items }, ...prev].slice(0, MAX_USER_PREPS));
            }

            // Reset form fields
            setPrepName('');
            setStudyFilesData([]);
            setUploadedFilesForCurrentPrep([]);
            setSampleFile(null);
            setCustomInstructions('');
            if (document.getElementById('sample-file-input')) { // Reset file input
                document.getElementById('sample-file-input').value = '';
            }
            // setShowDeleteFilesButton(true);
            setLoadingMessage("Success! Preparation saved.");

        } catch (err) {
            console.error("Submission/Generation error:", err);
            let detailedError = `Error: ${err.message || 'Unknown error during generation.'}`;
            // ... (your existing error handling logic)
            if (err.response && err.response.promptFeedback && err.response.promptFeedback.blockReason) {
                detailedError += ` (Block Reason: ${err.response.promptFeedback.blockReason})`;
                if (err.response.promptFeedback.safetyRatings && err.response.promptFeedback.safetyRatings.length > 0) {
                    detailedError += ` Safety Category: ${err.response.promptFeedback.safetyRatings.map(r => `${r.category} (${r.probability})`).join(', ')}`;
                }
            } else if (err.message?.includes('429')) {
                detailedError = "Rate limit exceeded. Please wait and try again later.";
            } else if (err.message?.includes('API key not valid')) {
                detailedError = "Invalid Google API Key. Please check your configuration.";
            } else if (err.message?.includes('quota')) {
                detailedError = "Quota exceeded for the API. Please check your Google Cloud project limits.";
            } else if (err.message?.toLowerCase().includes('request payload size') || err.message?.toLowerCase().includes('request too large')) {
                detailedError = "The request to the AI was too large. Please try with fewer/smaller files or shorter instructions.";
            }
            setError(detailedError);
            setGeneratedQuiz('');
            // setShowDeleteFilesButton(true);
        } finally {
            setTimeout(() => {
                setIsLoading(false);
                setLoadingMessage('');
            }, 2000);
            await releaseSlot(); // Ensure releaseSlot is correctly implemented
        }
    };


    const handlePrepSelect = async id => {
        if (!userId || !id || !AI_CONFIGURED) return;
        if (activePrepId === id) {
            setActivePrepId(null);
            setSelectedPrepContent(null);
            setGeneratedQuiz('');
            return;
        }

        setLoadingPrepContent(true);
        setError(''); setGeneratedQuiz(''); setSelectedPrepContent(null);
        setActivePrepId(id);
        // setShowDeleteFilesButton(false);

        try {
            const d = await fetchPrepContentById(id, userId); // Ensure fetchPrepContentById is correctly implemented
            if (d?.model_response) {
                setGeneratedQuiz(d.model_response);
                setSelectedPrepContent(d.model_response);
                // If prepName was not set for this view, you could set it here from d.prep_name
                // setPrepName(d.prep_name); // Potentially set prep name if viewing an old prep
                setTotalItems(d.total_items || 30); // Load total items if saved
            } else {
                const errorMessage = d ? "_(No content found for this preparation)_" : "Preparation data is null.";
                setGeneratedQuiz(errorMessage);
                setSelectedPrepContent(errorMessage);
            }
        } catch (e) {
            console.error("Prep load error:", e);
            setError(`Failed to load content: ${e.message}`);
            setActivePrepId(null); setSelectedPrepContent(null); setGeneratedQuiz('');
        } finally {
            setLoadingPrepContent(false);
        }
    };

    const handleDeletePrep = async id => {
        if (!userId || !id || !AI_CONFIGURED) return;
        // Replace window.confirm with a custom modal if running in an environment where it's blocked
        const confirmDelete = window.confirm("Delete this preparation? This action cannot be undone.");
        if (!confirmDelete) return;

        if (activePrepId === id) {
            setActivePrepId(null);
            setSelectedPrepContent(null);
            setGeneratedQuiz('');
        }

        setIsLoading(true); setLoadingMessage("Deleting database record...");
        setError('');
        // setShowDeleteFilesButton(false);

        try {
            await deletePrepFromDB(id, userId); // Ensure deletePrepFromDB is correctly implemented
            setUserPreps(p => p.filter(x => x.id !== id));
            setLoadingMessage("Database record deleted.");
        } catch (e) {
            console.error("Delete error:", e);
            setError(`Database deletion failed: ${e.message}`);
        } finally {
            setTimeout(() => { setIsLoading(false); setLoadingMessage(''); }, 1000);
        }
    };

    const downloadPDF = async () => {
        const elementToCapture = contentRef.current;
        if (!elementToCapture) {
            const errorMsg = 'No content to download or content area not found.';
            setError(errorMsg); return;
        }

        try {
            setIsDownloadingPDF(true);

            // Get the Markdown content
            const markdownContent = elementToCapture.innerHTML;

            // Create a timestamp for the filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const currentPrepName = activePrepId && userPreps.find(p => p.id === activePrepId)
                ? userPreps.find(p => p.id === activePrepId).prep_name
                : (prepName || "Generated_Prep");
            const filename = `ExmPrep_${currentPrepName.replace(/\s+/g, '_')}_${timestamp}.pdf`;

            // Make API call to generate PDF
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: markdownContent,
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
            const errorMsg = `Failed to generate PDF: ${pdfError.message || 'Unknown error'}. Check console for details.`;
            setError(errorMsg);
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    // Navigation functions for multi-step form
    const nextStep = () => setCurrentStep(prev => prev + 1);
    const prevStep = () => setCurrentStep(prev => prev - 1);

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: // Prep Name
                return (
                    <div className="space-y-6">
                        <div className="relative">
                            <label htmlFor="prepName" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                                Preparation Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    id="prepName"
                                    value={prepName}
                                    onChange={(e) => { setPrepName(e.target.value); setError(''); }}
                                    required
                                    maxLength={100}
                                    className="w-full px-4 py-3 bg-white/80 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-600 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500/50 focus:border-green-500 dark:focus:ring-green-400/50 dark:focus:border-green-400 transition-all duration-300 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 backdrop-blur-sm group-hover:shadow-md disabled:opacity-50"
                                    placeholder="e.g., Advanced Biology Midterm"
                                    disabled={isLoading || loadingPrepContent || filesCurrentlyProcessing}
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                            </div>
                        </div>

                        <div className="flex justify-end">

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    nextStep();
                                }}
                                disabled={prepName.trim() === '' || isLoading}
                                className=" group p-3 w-1/2 md:w-1/2 md:w-1/4 rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

                            >

                                <span>Continue</span>
                                <FiArrowRight className="transform group-hover:translate-x-1 transition-transform duration-200" />

                            </button>
                        </div>
                    </div>
                );
            case 2: // Study Files
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                                Study Files <span className="text-red-500">*</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                                    (PDF only - Max {MAX_FILES})
                                </span>
                            </label>

                            <div
                                {...getRootProps()}
                                className={`group relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 backdrop-blur-sm
                                    ${isDragActive
                                        ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 scale-105'
                                        : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
                                    }
                                    ${studyFilesData.filter(f => f.status === 'uploaded' || f.status === 'uploading').length >= MAX_FILES || isLoading || loadingPrepContent || filesCurrentlyProcessing
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:shadow-lg'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="relative">
                                        <FiUploadCloud className="w-12 h-12 text-zinc-400 group-hover:text-green-500 transition-colors duration-300" />
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-500/10 to-purple-500/10 scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                                            {isDragActive ? 'Drop your files here' : 'Upload your study materials'}
                                        </p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                            Drag & drop or click to select PDF files
                                        </p>
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                            {MAX_FILES - studyFilesData.filter(f => ['uploaded', 'uploading'].includes(f.status)).length} slots remaining
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </div>
                        </div>

                        {studyFilesData.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Uploaded Files</h4>
                                <div className="grid gap-3">
                                    {studyFilesData.map(item => (
                                        <div key={item.id} className="group relative flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-all duration-300 backdrop-blur-sm">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <div className="relative">
                                                    <FiFileText className={`w-5 h-5 transition-colors duration-200 ${item.status === 'uploaded' ? 'text-emerald-500' :
                                                        item.status === 'error' ? 'text-red-500' :
                                                            'text-green-500'
                                                        }`} />
                                                    {item.status === 'uploaded' && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                                                            <FiCheck className="w-2 h-2 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                        {item.file.name}
                                                    </p>
                                                    <div className="flex items-center space-x-2 text-xs">
                                                        {item.status === 'queued' && <span className="text-zinc-500">Queued...</span>}
                                                        {item.status === 'converting' && (
                                                            <div className="flex items-center space-x-1 text-green-600">
                                                                <FiLoader className="animate-spin w-3 h-3" />
                                                                <span>Converting...</span>
                                                            </div>
                                                        )}
                                                        {item.status === 'uploading' && (
                                                            <div className="flex items-center space-x-1 text-green-600">
                                                                <FiLoader className="animate-spin w-3 h-3" />
                                                                <span>Processing...</span>
                                                            </div>
                                                        )}
                                                        {item.status === 'deleting' && (
                                                            <div className="flex items-center space-x-1 text-red-600">
                                                                <FiLoader className="animate-spin w-3 h-3" />
                                                                <span>Removing...</span>
                                                            </div>
                                                        )}
                                                        {item.status === 'uploaded' && (
                                                            <span className="text-emerald-600 font-medium">Ready</span>
                                                        )}
                                                        {item.status === 'error' && (
                                                            <div className="flex items-center space-x-1 text-red-600">
                                                                <FiAlertCircle className="w-3 h-3" />
                                                                <span>{item.error || 'Upload failed'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveStudyFile(item.id)}
                                                className="ml-3 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                                                disabled={isLoading || loadingPrepContent || ['uploading', 'deleting', 'converting'].includes(item.status)}
                                            >
                                                <FiX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-lg p-3">
                                    <span>{successfullyUploadedFiles.length} / {MAX_FILES} files uploaded</span>
                                    {hasFileErrors && <span className="text-red-500 font-medium">⚠ Some files have errors</span>}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between pt-4">

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    prevStep();
                                }}
                                disabled={isLoading || loadingPrepContent}
                                className=" group p-3 w-1/2 md:w-1/2 md:w-1/2 md:w-1/4 rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

                            >
                                <FiArrowLeft className="transform group-hover:translate-x-1 transition-transform duration-200" />

                                <span>Previous</span>

                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    nextStep();
                                }}
                                disabled={successfullyUploadedFiles.length === 0 || filesCurrentlyProcessing || hasFileErrors || isLoading || loadingPrepContent}
                                className=" group p-3 w-1/2 md:w-1/2  md:w-1/4 rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

                            >

                                <span>Continue</span>
                                <FiArrowRight className="transform group-hover:translate-x-1 transition-transform duration-200" />

                            </button>

                        </div>
                    </div>
                );
            case 3: // Sample/Instructions & Generate
                return (
                    <div className="space-y-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label htmlFor="sample-file-input" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    Sample Questions <span className="text-xs text-zinc-500">(Optional)</span>
                                </label>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Upload a sample PDF to guide the AI&apos;s question format
                                </p>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        id="sample-file-input"
                                        onChange={handleSampleFileChange}
                                        accept="application/pdf"
                                        className="block w-full text-sm text-zinc-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 dark:file:bg-green-900/30 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-100 dark:hover:file:bg-green-800/50 file:transition-all file:duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm hover:shadow-md transition-all duration-300"
                                        disabled={isLoading || loadingPrepContent || filesCurrentlyProcessing}
                                    />
                                </div>
                                {sampleFile && (
                                    <div className="p-4 bg-white/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 backdrop-blur-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <FiFileText className="w-5 h-5 text-purple-500" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                        {sampleFile.file.name}
                                                    </p>
                                                    <div className="text-xs">
                                                        {sampleFile.error === 'processing...' && (
                                                            <div className="flex items-center space-x-1 text-green-600">
                                                                <FiLoader className="animate-spin w-3 h-3" />
                                                                <span>Processing...</span>
                                                            </div>
                                                        )}
                                                        {sampleFile.error && sampleFile.error !== 'processing...' && (
                                                            <div className="flex items-center space-x-1 text-red-500">
                                                                <FiAlertCircle className="w-3 h-3" />
                                                                <span>{sampleFile.error}</span>
                                                            </div>
                                                        )}
                                                        {!sampleFile.error && sampleFile.text && (
                                                            <span className="text-emerald-600 font-medium">Ready</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveSampleFile}
                                                className="ml-3 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                                disabled={isLoading || loadingPrepContent || filesCurrentlyProcessing}
                                            >
                                                <FiX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <label htmlFor="customInstructions" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    Custom Instructions
                                </label>
                                <div className="relative group">
                                    <textarea
                                        id="customInstructions"
                                        rows={4}
                                        value={customInstructions}
                                        onChange={(e) => setCustomInstructions(e.target.value)}
                                        className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500/50 focus:border-green-500 dark:focus:ring-green-400/50 dark:focus:border-green-400 bg-white/80 dark:bg-zinc-800/80 disabled:opacity-50 disabled:bg-zinc-100 dark:text-zinc-200 dark:disabled:bg-zinc-700/50 text-zinc-900 placeholder-zinc-500 dark:placeholder-zinc-400 backdrop-blur-sm transition-all duration-300 resize-none group-hover:shadow-md"
                                        placeholder="e.g., Create multiple-choice questions with 4 options each, focusing on key concepts and practical applications..."
                                        disabled={isLoading || loadingPrepContent || filesCurrentlyProcessing || (!!sampleFile?.text && !sampleFile.error)}
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                </div>
                                {!!sampleFile?.text && !sampleFile.error && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                                        Sample file selected - custom instructions disabled
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl backdrop-blur-sm">
                            <div className="flex items-center space-x-3">
                                <FiStar className="w-5 h-5 text-yellow-500" />
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    Number of questions:
                                </span>
                            </div>
                            <select
                                className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200"
                                value={totalItems}
                                onChange={(e) => setTotalItems(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                                <option value={40}>40</option>
                                <option value={60}>60</option>
                                <option value={100}>100</option>
                                <option value={120}>120</option>
                                <option value={150}>150</option>
                                <option value={180}>180</option>
                            </select>
                        </div>

                        <div className="flex justify-between items-center pt-4">

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    prevStep();
                                }}
                                disabled={isLoading}
                                className=" group p-3 w-1/2 md:w-1/2 md:w-1/4 rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

                            >
                                <FiArrowLeft className="transform group-hover:translate-x-1 transition-transform duration-200" />

                                <span>Previous</span>

                            </button>


                            <button
                                type="submit"
                                disabled={!canSubmit || isLoading || loadingPrepContent || filesCurrentlyProcessing}

                                className=" group p-3 w-1/2 md:w-1/2 md:w-1/4 rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

                            >
                                {isLoading ? (
                                    <FiLoader className="animate-spin w-5 h-5" />
                                ) : (
                                    <FiZap className="w-5 h-5" />
                                )}
                                <span>{isLoading ? (loadingMessage || 'Processing...') : 'Generate Exam'}</span>

                            </button>

                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    function fixMCQOptionsNewlines(markdown) {
        return markdown.replace(/((\[ \]|\[x\])[^\n\[]+)(?=\s*(\[ \]|\[x\]))/g, '$1\n');
    }

    useEffect(() => {
        if (userId) {
            loadPreps();
        }
    }, [userId, loadPreps]);

    return (
        <div className="flex flex-col min-h-screen h-full  dark:bg-zinc-800 bg-zinc-100">
            {/* Mobile Menu Button */}
            <button
                className="md:hidden fixed top-4 left-4 z-[60] p-3 rounded-xl shadow-lg bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle sidebar"
            >
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>

            {/* Main Layout Container */}
            <div className="flex min-h-screen">
                {/* Sidebar */}
                <div
                    className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-500 ease-in-out w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200/50 dark:border-zinc-700/50 shadow-xl md:relative md:translate-x-0 md:w-80 lg:w-80 md:flex-shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    <div className="flex-grow overflow-y-auto p-6">
                        <Sidebar
                            hasReachedPrepLimit={hasReachedPrepLimit}
                            AI_CONFIGURED={AI_CONFIGURED}
                            MAX_USER_PREPS={MAX_USER_PREPS}
                            onClearSelection={() => {
                                setGeneratedQuiz(null);
                                setActivePrepId(null);
                                setSelectedPrepContent(null);
                                setCurrentStep(1);
                                setPrepName('');
                                setStudyFilesData([]);
                                setUploadedFilesForCurrentPrep([]);
                                setSampleFile(null);
                                setCustomInstructions('');
                                setError('');
                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                    setIsSidebarOpen(false);
                                }
                            }}
                            userPreps={userPreps}
                            activePrepId={activePrepId}
                            handlePrepSelect={(id) => {
                                handlePrepSelect(id);
                                setCurrentStep(1);
                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                    setIsSidebarOpen(false);
                                }
                            }}
                            isLoading={isLoading}
                            loadingPrepContent={loadingPrepContent}
                            handleDeletePrep={handleDeletePrep}
                            onCloseSidebar={() => setIsSidebarOpen(false)} // <-- pass this prop
                        />
                    </div>
                </div>

                {/* Backdrop */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Main Content */}
                <main className={`flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 transition-all duration-500 min-w-0 ${isSidebarOpen ? 'md:ml-0' : ''}`}>
                    <div className="max-w-6xl mx-auto">
                        {!generatedQuiz && !selectedPrepContent && (
                            <div className="space-y-8">
                                {/* Header */}
                                <div className="text-center space-y-4">
                                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
                                    </h1>
                                    <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                                        Transform your study materials into comprehensive practice exams with AI-powered question generation
                                    </p>
                                </div>

                                {/* Progress Card */}
                                <div className="bg-white/80 dark:bg-zinc-900 backdrop-blur-sm rounded-2xl shadow-xl border border-zinc-200/50 dark:border-zinc-700/50 p-8 mx-auto max-w-4xl">
                                    {/* Step Header */}
                                    <div className="flex justify-between items-center mb-8">
                                        <div>
                                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                                {currentStep === 1 && "Name Your Preparation"}
                                                {currentStep === 2 && "Upload Study Materials"}
                                                {currentStep === 3 && "Configure & Generate"}
                                            </h2>
                                            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                                                {currentStep === 1 && "Give your exam preparation a descriptive name"}
                                                {currentStep === 2 && "Upload your PDF study materials"}
                                                {currentStep === 3 && "Set preferences and generate your exam"}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <span className="font-medium">Step {currentStep}</span>
                                            <span>/</span>
                                            <span>3</span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-10">
                                        <div className="flex justify-between items-center mb-2">
                                            {[1, 2, 3].map((step) => (
                                                <div
                                                    key={step}
                                                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500 ${step <= currentStep
                                                        ? 'bg-green-600 border-green-600 text-white'
                                                        : 'border-zinc-300 dark:border-zinc-600 text-zinc-400'
                                                        }`}
                                                >
                                                    {step < currentStep ? (
                                                        <FiCheck className="w-5 h-5" />
                                                    ) : (
                                                        <span className="text-sm font-semibold">{step}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                                                    <div
                                                        className="h-1 bg-gradient-to-r from-green-600 to-green-500 rounded-full transition-all duration-700 ease-out"
                                                        style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Alert Messages */}
                                    {hasReachedPrepLimit && (
                                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
                                            <div className="flex items-center space-x-2">
                                                <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-amber-700 dark:text-amber-300 font-medium">
                                                        Maximum limit reached
                                                    </p>
                                                    <p className="text-amber-600 dark:text-amber-400 text-sm">
                                                        You have reached the limit of {MAX_USER_PREPS} saved preparations. Delete one to create a new one.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!AI_CONFIGURED && (
                                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl">
                                            <div className="flex items-center space-x-2">
                                                <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-red-700 dark:text-red-300 font-medium">
                                                        AI Service not configured
                                                    </p>
                                                    <p className="text-red-600 dark:text-red-400 text-sm">
                                                        Exam preparation creation is disabled. Please check API key configuration.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Form Content */}
                                    {!hasReachedPrepLimit && AI_CONFIGURED && (
                                        <form onSubmit={handleSubmit} className="space-y-8">
                                            {renderStepContent()}
                                        </form>
                                    )}
                                </div>

                                {/* Global Loading State */}
                                {isLoading && (currentStep === 3 || loadingMessage.includes("Generating") || loadingMessage.includes("Saving")) && (
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                                        <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-zinc-200/50 dark:border-zinc-700/50 max-w-md mx-4">
                                            <div className="flex items-center space-x-4">
                                                <div className="relative">
                                                    <FiLoader className="animate-spin w-8 h-8 text-green-600" />
                                                    <div className="absolute inset-0 rounded-full border-2 border-green-200 dark:border-green-800 animate-pulse"></div>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-900 dark:text-zinc-100 font-semibold">
                                                        {loadingMessage || 'Processing...'}
                                                    </p>
                                                    <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                                        This may take a few moments
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <div className="max-w-4xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl">
                                        <div className="flex items-center space-x-2">
                                            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                            <p className="text-red-700 dark:text-red-300">{error}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Results View */}
                        {(generatedQuiz || (selectedPrepContent && activePrepId)) && (
                            <div className="space-y-6">
                                {/* Results Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-zinc-200/50 dark:border-zinc-700/50 shadow-lg">
                                    <div>
                                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                                            {activePrepId && userPreps.find(p => p.id === activePrepId)
                                                ? userPreps.find(p => p.id === activePrepId).prep_name
                                                : (prepName || "Generated Exam")}
                                        </h2>
                                        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                            Your exam is ready for review and download
                                        </p>
                                    </div>
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => {
                                                setGeneratedQuiz(null);
                                                setSelectedPrepContent(null);
                                                setActivePrepId(null);
                                                setCurrentStep(1);
                                                setPrepName('');
                                                setStudyFilesData([]);
                                                setUploadedFilesForCurrentPrep([]);
                                                setSampleFile(null);
                                                setCustomInstructions('');
                                                setError('');
                                            }}
                                            className="group px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2"
                                        >
                                            <FiArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform duration-200" />
                                            <span>Create New</span>
                                        </button>
                                        <button
                                            onClick={downloadPDF}
                                            className="group px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                            disabled={isDownloadingPDF}
                                        >
                                            {isDownloadingPDF ? (
                                                <FiLoader className="animate-spin w-4 h-4" />
                                            ) : (
                                                <FiDownload className="w-4 h-4" />
                                            )}
                                            <span>{isDownloadingPDF ? 'Downloading...' : 'Download PDF'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Results Content */}
                                <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-zinc-200/50 dark:border-zinc-700/50 overflow-y-scroll scrollbar-thin h-[500px] dark:text-zinc-100  ">
                                    <div
                                        ref={contentRef}
                                        className="prose prose-zinc dark:prose-invert max-w-none p-5 md:p-8"
                                        style={{
                                            backgroundColor: 'transparent',
                                            fontSize: '16px',
                                            lineHeight: '1.7'
                                        }}
                                    >
                                        <RichMarkdownEXM
                                            mark={fixMCQOptionsNewlines((generatedQuiz || selectedPrepContent || ''))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}