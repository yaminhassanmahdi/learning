'use client'; // Use this directive if using Next.js App Router
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image'; // Using Next.js Image component
import { supabase } from "../lib/supabaseClient";
import { Download } from "lucide-react";

import {
    GoogleGenerativeAI, // Updated import name
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai"; // Updated package name
import LoadingSpinner from "./LoadingSpinner";
import {
    file_contents_supabase,
    file_id_supabase,
    activeChat, // Assuming this might be used elsewhere, kept for context
    user_id_supabase, // Needed for usage tracking
    memesState
} from "../../store/uploadAtoms";
import { useRouter } from 'next/navigation';        // Or 'next/router'
import { toast } from "sonner";                       // Or your preferred toast library
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';
const GOOGLE_API_KEY = "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk";
const IMGFLIP_USERNAME = "NasrinAnwar1993";
const IMGFLIP_PASSWORD = "Arefin123";

import { templatenames } from './memenames'; // Adjust path if necessary
import { Prompt } from "next/font/google";

const allMemeTemplates = templatenames.data.memes.map(meme => ({
    id: meme.id,
    name: meme.name,
    box_count: meme.box_count,
    height: meme.height,
    width: meme.width
}));

// Filter templates suitable for 2 text boxes (used for the prompt)
const suitableTemplatesForPrompt = allMemeTemplates
    .filter(meme => meme.box_count === 2)
    .map(meme => ({
        id: meme.id,
        name: meme.name
    }));

let genAI;
let generativeModel;

try {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_GOOGLE_AI_API_KEY") {
        console.warn("Google AI API Key is missing or placeholder.");
    } else {
        genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        generativeModel = genAI.getGenerativeModel({
            model: "gemini-2.5-pro-preview-05-06", // Use a reliable model
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: "You are a humorous meme generator. Plese follow the instrcutions and generate humorous memes",
            }
        });
        console.log("Gemini AI Initialized");
    }
} catch (error) {
    console.error("Failed to initialize Google AI:", error);
}

// Helper function to add watermark
async function addWatermarkToImage(imageUrl, watermarkText = "Learningly.xyz") {
    return new Promise((resolve, reject) => {
        const img = new window.Image(); // Use window.Image to be explicit in Next.js/React context
        img.crossOrigin = "anonymous"; // Crucial for loading external images onto canvas

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Watermark properties
            const padding = 5; // Padding around the text
            const fontSize = 10; // Dynamic font size
            ctx.font = `bold ${fontSize}px Arial`;
            const textMetrics = ctx.measureText(watermarkText);
            const textWidth = textMetrics.width;
            const textHeight = fontSize; // Approximate height

            // Background rectangle for the watermark
            const rectHeight = textHeight + padding;
            const rectWidth = textWidth + padding;

            const desiredLeftMargin = 2;
            const desiredBottomMargin = 0;

            const rectX = desiredLeftMargin;
            const rectY = canvas.height - rectHeight - desiredBottomMargin;

            ctx.fillStyle = '#e3e3e3';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

            // Draw the watermark text
            ctx.fillStyle = 'black';
            ctx.fillText(watermarkText, rectX + (padding / 2), rectY + textHeight - (padding / 4) /* Adjust baseline */);

            resolve(canvas.toDataURL('image/png')); // Or 'image/jpeg'
        };

        img.onerror = (error) => {
            console.error("Error loading image for watermarking:", error);
            reject(new Error("Could not load image for watermarking."));
        };

        img.src = imageUrl;
    });
}

// --- React Component ---
export default function Memetab() {
    const router = useRouter(); // For navigation in toast
    const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
    const [contextInput, setContextInput] = useState('');
    const [memeIdeas, setMemeIdeas] = useAtom(memesState);
    const [loadingAllImages, setLoadingAllImages] = useState(false);
    const [generatingTexts, setGeneratingTexts] = useState(false);
    const [aiError, setAiError] = useState('');
    const [downloadingMeme, setDownloadingMeme] = useState(null); // Track which meme is being downloaded
    const userUuid = useAtomValue(user_id_supabase);
    const fid = useAtomValue(file_id_supabase);
    const [totalQuizToGenerate, setTotalQuizToGenerate] = useState(10);

    // Use ref to track the latest meme ideas for database operations
    const memeIdeasRef = useRef(memeIdeas);
    const savingToDbRef = useRef(false);

    // Update ref whenever memeIdeas changes
    useEffect(() => {
        memeIdeasRef.current = memeIdeas;
    }, [memeIdeas]);

    // localStorage backup functions
    const saveMemesToLocalStorage = useCallback((memesToSave) => {
        if (!fid) return;
        try {
            const key = `memes_${fid}`;
            localStorage.setItem(key, JSON.stringify(memesToSave));
            console.log("Memes saved to localStorage as backup");
        } catch (error) {
            console.warn("Failed to save memes to localStorage:", error);
        }
    }, [fid]);

    const loadMemesFromLocalStorage = useCallback(() => {
        if (!fid) return null;
        try {
            const key = `memes_${fid}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.warn("Failed to load memes from localStorage:", error);
        }
        return null;
    }, [fid]);

    // Debounced database save function
    const saveToDatabase = useCallback(async (memesToSave) => {
        if (savingToDbRef.current || !fid) return;

        savingToDbRef.current = true;
        try {
            // Filter out any memes with extremely long URLs that might cause database issues
            const memesToSaveFiltered = memesToSave.map(meme => {
                if (meme.memeUrl && meme.memeUrl.length > 1000000) { // 1MB limit for data URLs
                    console.warn(`Meme URL too long for ${meme.name}, skipping save`);
                    return { ...meme, memeUrl: '', imgflipError: 'Image too large to save' };
                }
                return meme;
            });

            const { error: updateError } = await supabase
                .from("file_data")
                .update({ memes: memesToSaveFiltered })
                .eq("file_id", fid);

            if (updateError) {
                console.error("Failed to save meme data:", updateError.message);
                // Retry with smaller data if the error might be due to size
                if (updateError.message.includes('too large') || updateError.message.includes('size')) {
                    console.log("Retrying save with URLs removed due to size constraints...");
                    const memesWithoutUrls = memesToSave.map(meme => ({
                        ...meme,
                        memeUrl: meme.memeUrl ? 'saved_locally' : meme.memeUrl // Keep text but remove actual data URL
                    }));

                    const { error: retryError } = await supabase
                        .from("file_data")
                        .update({ memes: memesWithoutUrls })
                        .eq("file_id", fid);

                    if (retryError) {
                        console.error("Retry save also failed:", retryError.message);
                    } else {
                        console.log("Meme structure successfully saved to database (without large URLs).");
                    }
                }
            } else {
                console.log("Meme data successfully saved to database.");
            }
        } catch (err) {
            console.error("Error saving to database:", err);
            // Try to save at least the structure without URLs as fallback
            try {
                const memesStructureOnly = memesToSave.map(meme => ({
                    templateId: meme.templateId,
                    name: meme.name,
                    width: meme.width,
                    height: meme.height,
                    text0: meme.text0,
                    text1: meme.text1,
                    memeUrl: '', // Clear URL on fallback
                    imgflipError: meme.imgflipError || '',
                    isLoadingImage: false
                }));

                await supabase
                    .from("file_data")
                    .update({ memes: memesStructureOnly })
                    .eq("file_id", fid);

                console.log("Fallback: Saved meme structure without URLs.");
            } catch (fallbackErr) {
                console.error("Fallback save also failed:", fallbackErr);
            }
        } finally {
            // Always try to save to localStorage as backup, regardless of database result
            saveMemesToLocalStorage(memesToSave);
            savingToDbRef.current = false;
        }
    }, [fid, saveMemesToLocalStorage]);

    async function getRawText() {
        try {
            // --- Stage 1: Fetch and process 'memes' ---
            console.log(`Fetching memes for file_id: ${fid}...`);
            const { data: memesRowData, error: memesDbError } = await supabase
                .from("file_data")
                .select("memes") // Select only the 'memes' column
                .eq("file_id", fid)
                .maybeSingle();

            if (memesDbError) {
                console.error("Supabase error fetching memes:", memesDbError.message);
            }

            // Check if memesRowData is not null, and if memes property exists and has items
            if (memesRowData && memesRowData.memes && memesRowData.memes.length > 0) {
                console.log("Memes data fetched from Supabase. Count:", memesRowData.memes.length);

                // Try to merge with localStorage backup if URLs are missing
                const localStorageMemes = loadMemesFromLocalStorage();
                let mergedMemes = memesRowData.memes;

                if (localStorageMemes && localStorageMemes.length === memesRowData.memes.length) {
                    console.log("Found localStorage backup, merging URLs...");
                    mergedMemes = memesRowData.memes.map((dbMeme, index) => {
                        const localMeme = localStorageMemes[index];
                        // If database meme doesn't have URL but localStorage does, use localStorage URL
                        if (!dbMeme.memeUrl && localMeme && localMeme.memeUrl && localMeme.templateId === dbMeme.templateId) {
                            return { ...dbMeme, memeUrl: localMeme.memeUrl };
                        }
                        return dbMeme;
                    });
                    console.log("Merged memes with localStorage URLs");
                }

                // Set all memes first, including those with URLs
                setMemeIdeas(mergedMemes);

                // Process images for existing memes that don't have URLs but avoid showing loading for memes that already exist
                const memesNeedingImages = mergedMemes.filter(meme => !meme.memeUrl && !meme.imgflipError);
                if (memesNeedingImages.length > 0) {
                    console.log(`Processing images for ${memesNeedingImages.length} existing memes silently...`);
                    // Process only the memes that need images, without affecting the UI state of loaded memes
                    handleGenerateAllImagesQuietly(mergedMemes, memesNeedingImages);
                }
            } else {
                console.log("No existing memes found. Initializing memeIdeas to [].");
                setMemeIdeas([]); // Initialize to empty array if no memes
            }

            // --- Stage 2: Fetch and process 'raw_text' ---
            console.log(`Fetching raw_text for file_id: ${fid}...`);
            const { data: rawTextRowData, error: rawTextDbError } = await supabase
                .from("file_data")
                .select("raw_text") // Select only the 'raw_text' column
                .eq("file_id", fid)
                .maybeSingle();

            if (rawTextDbError) {
                console.error("Supabase error fetching raw_text:", rawTextDbError.message);
                setContextInput(''); // Clear context or set an error indication
            }

            // Check if rawTextRowData is not null, and if raw_text property exists and is a string
            if (rawTextRowData && typeof rawTextRowData.raw_text === 'string') {
                setContextInput(rawTextRowData.raw_text); // Update state with fetched raw_text
                console.log("Raw text data fetched and contextInput state updated.");
            } else {
                console.log("Raw text data is missing, setting contextInput to empty.");
                setContextInput(''); // Set to empty if no raw_text
            }

        } catch (err) {
            console.error("Error in getRawText:", err);
            return 0; // Block generation on error
        }
    }

    useEffect(() => {
        if (fid) {
            getRawText();
        }
    }, [fid, loadMemesFromLocalStorage]);

    // --- Function to Generate Multiple Meme Ideas with Gemini ---
    const generateMemeIdeasFromGemini = async () => {
        if (!generativeModel) {
            setAiError("AI Service not initialized. Check API Key/Console.");
            return;
        }
        if (!contextInput.trim()) {
            setAiError('Please enter some context for meme generation.');
            return;
        }

        // === USAGE CHECK STARTS HERE ===
        if (userUuid) { // Only check/decrement if userUuid is available
            setGeneratingTexts(true); // Set loading early for feedback
            setAiError('');
            // memeIdeas and loadingAllImages will be reset after the check

            const remainingCredits = await getUserActivityUsage('memes');
            if (remainingCredits <= 0) {
                toast("Free limit for Memes finished, Buy premium!", {
                    description: "For $4.99 get higher usage limits", // Updated price
                    action: {
                        label: "Buy",
                        onClick: () => triggerProButtonDialog(),
                    },
                });
                setAiError("Your meme generation limit has been reached.");
                setGeneratingTexts(false); // Reset loading state
                return; // Stop execution
            }
            console.log(`Memetab: User has ${remainingCredits} meme credits.`);
        } else {
            // Handle case where userUuid is not available
            console.warn("Memetab: User ID not available, skipping usage check for meme generation.");
            setGeneratingTexts(true); // Still set loading if proceeding without check
            setAiError('');
        }
        // === USAGE CHECK ENDS HERE ===

        // Clear previous ideas now that usage check has passed (or was skipped)
        setMemeIdeas([]);
        setLoadingAllImages(false);

        const templateListString = suitableTemplatesForPrompt.map(t => `ID: ${t.id}, Name: "${t.name}"`).join('\n');
        const prompt = `
        Hey there, Meme Brain! Let's have some fun! 😄 Your mission, should you choose to accept it, is to help someone understand a concept using memes. Be lighthearted, funny, and super clear!
    
        Here are the meme templates we can use (they all have a top and bottom text area):
        ${templateListString}
    
        This is the idea the user wants to illustrate: "${contextInput}"
    
        Okay, here's the plan:
        1.  Think about the user's context. What's the core feeling or situation?
        2.  Look through the template list and pick ${totalQuizToGenerate} *different* templates that could hilariously or cleverly represent that context. Try to pick diverse styles!
        3.  For *each* chosen template, write a short, snappy, and funny Top Text and Bottom Text. Make it easy to understand and relate to the context. Keep it clean and fun for everyone!
    
        Now, beam back the results *exactly* like this, with no extra chatter or formatting:
    
        Meme 1:
        Template ID: [ID of first chosen template]
        Top Text: [Funny Top Text for Meme 1]
        Bottom Text: [Funny Bottom Text for Meme 1]
    
        Meme 2:
        Template ID: [ID of second chosen template]
        Top Text: [Funny Top Text for Meme 2]
        Bottom Text: [Funny Bottom Text for Meme 2]
        
        Meme n:
        Template ID: [ID of nth chosen template]
        Top Text: [Funny Top Text for Meme n]
        Bottom Text: [Funny Bottom Text for Meme n]
        
        Generate exactly ${totalQuizToGenerate} memes. The memes should contain important info from the context, don't criticize the context, just add main points that can come in an exam in memes through various templates.
        Remember: Stick to the format! Just the facts (and the funny bits). No extra words before or after. For business-based topics, please make it humorous. Please follow the template structure. Do not explain memes in top or bottom text; just add humor only. 
        
        In "Change My Mind" template, only add text0, no text1.
        
        Also, do not repeat meme templates in a single response. Randomize meme output. Prefer to use templates from the end and middle of the provided template IDs. Try to use Trump, 9/11, and Undertaker memes if appropriate. Please do not add meme explanations inside parentheses; just make the meme humorous, no explanation.
        
        Preferably use "Chicken Jockey", "Trump Tariff", "Say Drake", "Kanye Tweet Blank", "What am I reading", "Trump, Vance, and Zelensky" templates as they are trending. Make all these funny.
    
        Go! 🚀
        `;

        try {
            console.log("Sending multi-meme prompt to Gemini...");
            const result = await generativeModel.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            console.log('Gemini raw response text:', responseText);

            const parsedIdeas = [];
            const memeBlocks = responseText.split(/Meme \d+:/i).filter(block => block.trim() !== '');

            if (memeBlocks.length === 0 && responseText.includes('Template ID:')) {
                memeBlocks.push(responseText);
            }
            console.log(`Found ${memeBlocks.length} potential meme blocks.`);

            memeBlocks.forEach((block, index) => {
                const idMatch = block.match(/Template ID:\s*(\d+)/i);
                const topMatch = block.match(/Top Text:\s*(.*)/i);
                const bottomMatch = block.match(/Bottom Text:\s*(.*)/i);

                const extractedId = idMatch ? idMatch[1].trim() : null;
                let extractedTop = topMatch ? topMatch[1].trim() : null;
                let extractedBottom = bottomMatch ? bottomMatch[1].trim() : null;

                if (extractedTop && extractedTop.includes('\n')) extractedTop = extractedTop.split('\n')[0].trim();
                if (extractedBottom && extractedBottom.includes('\n')) extractedBottom = extractedBottom.split('\n')[0].trim();

                if (extractedId && extractedTop !== null && extractedBottom !== null) {
                    const templateData = allMemeTemplates.find(m => m.id === extractedId);
                    if (templateData) {
                        parsedIdeas.push({
                            templateId: extractedId,
                            name: templateData.name,
                            width: templateData.width,
                            height: templateData.height,
                            text0: extractedTop,
                            text1: extractedBottom,
                            memeUrl: '',
                            imgflipError: '',
                            isLoadingImage: false
                        });
                    } else {
                        console.warn(`Block ${index + 1}: Template ID ${extractedId} found in response but not in our list.`);
                    }
                } else {
                    console.warn(`Block ${index + 1}: Failed to parse structure accurately. Block content:`, block.trim());
                }
            });

            if (parsedIdeas.length > 0) {
                setMemeIdeas(parsedIdeas);
                console.log("Successfully parsed meme ideas:", parsedIdeas);
                await saveToDatabase(parsedIdeas); // Save initial ideas
                saveMemesToLocalStorage(parsedIdeas); // Also save to localStorage

                // === DECREMENT USAGE STARTS HERE ===
                if (userUuid) { // Only decrement if user was identified for the check
                    await decrementUserActivityUsage('memes');
                    console.log("Memetab: Meme generation usage decremented.");
                }
                // === DECREMENT USAGE ENDS HERE ===

                handleGenerateAllImages(parsedIdeas); // Proceed to generate images
            } else {
                console.error('Error: Could not parse any valid meme ideas from the AI response.');
                setAiError('Failed to understand AI response structure. Check console for details.');
                if (memeBlocks.length === 0 && responseText) { // Check if responseText is not empty
                    setAiError(`Failed to parse AI response. Raw: ${responseText.substring(0, 100)}...`);
                } else if (memeBlocks.length === 0) {
                    setAiError('AI response was empty or did not contain meme blocks.');
                }
            }
        } catch (error) {
            console.error('Error generating meme ideas from Gemini:', error);
            let errorMessage = `Failed to generate meme ideas: ${error.message || 'Unknown error'}`;
            if (error.message && error.message.includes('SAFETY')) {
                errorMessage = 'Content generation blocked by safety settings. Try adjusting the context.';
            } else if (error.message && error.message.includes('API key')) {
                errorMessage = 'Invalid Google AI API Key. Please check configuration.';
            }
            setAiError(errorMessage);
        } finally {
            setGeneratingTexts(false);
        }
    };

    // --- Function to Generate a SINGLE Meme Image ---
    const generateSingleMemeImage = useCallback(async (index) => {
        const currentMemes = memeIdeasRef.current;
        const idea = currentMemes[index];

        if (!idea || !idea.templateId || idea.memeUrl) {
            console.log(`Skipping image generation for index ${index}: No idea, no ID, or URL already exists.`);
            return null;
        }

        if (!IMGFLIP_USERNAME || IMGFLIP_USERNAME === "YOUR_IMGFLIP_USERNAME" || !IMGFLIP_PASSWORD || IMGFLIP_PASSWORD === "YOUR_IMGFLIP_PASSWORD") {
            // Set error for this specific meme idea
            setMemeIdeas(prev => prev.map((item, idx) =>
                idx === index ? { ...item, imgflipError: "Imgflip credentials missing.", isLoadingImage: false } : item
            ));
            return null;
        }

        // Set loading state specifically for this item
        setMemeIdeas(prev => prev.map((item, idx) =>
            idx === index ? { ...item, isLoadingImage: true, imgflipError: '' } : item
        ));

        const formData = new URLSearchParams();
        formData.append('template_id', idea.templateId);
        formData.append('username', IMGFLIP_USERNAME);
        formData.append('password', IMGFLIP_PASSWORD);
        formData.append('text0', idea.text0);
        formData.append('text1', idea.text1);

        try {
            console.log(`Generating image for index ${index}, template ${idea.templateId}`);
            const response = await fetch('https://api.imgflip.com/caption_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
            });
            const data = await response.json();

            if (data.success) {
                const originalUrl = data.data.url;
                console.log(`Original Imgflip URL for index ${index}: ${originalUrl}`);
                const watermarkedDataUrl = await addWatermarkToImage(originalUrl, "learningly.xyz");

                // Update the specific meme with the generated URL
                setMemeIdeas(prev => {
                    const updated = prev.map((item, idx) =>
                        idx === index ? { ...item, memeUrl: watermarkedDataUrl, isLoadingImage: false } : item
                    );
                    // Save to database after successful generation
                    saveToDatabase(updated);
                    // Also immediately save to localStorage for instant persistence
                    saveMemesToLocalStorage(updated);
                    return updated;
                });

                return watermarkedDataUrl;
            } else {
                console.error(`Imgflip API Error for index ${index}:`, data.error_message);
                setMemeIdeas(prev => prev.map((item, idx) =>
                    idx === index ? { ...item, imgflipError: `Imgflip Error: ${data.error_message}`, isLoadingImage: false } : item
                ));
                return null;
            }
        } catch (error) {
            console.error(`Network error generating image for index ${index}:`, error);
            setMemeIdeas(prev => prev.map((item, idx) =>
                idx === index ? { ...item, imgflipError: `Network Error: ${error.message}`, isLoadingImage: false } : item
            ));
            return null;
        }
    }, [saveToDatabase, saveMemesToLocalStorage]);

    // --- Function to Generate a SINGLE Meme Image Quietly (without UI loading states) ---
    const generateSingleMemeImageQuietly = useCallback(async (index, memeData) => {
        if (!memeData || !memeData.templateId || memeData.memeUrl) {
            console.log(`Skipping quiet image generation for index ${index}: No data, no ID, or URL already exists.`);
            return null;
        }

        if (!IMGFLIP_USERNAME || IMGFLIP_USERNAME === "YOUR_IMGFLIP_USERNAME" || !IMGFLIP_PASSWORD || IMGFLIP_PASSWORD === "YOUR_IMGFLIP_PASSWORD") {
            return null;
        }

        const formData = new URLSearchParams();
        formData.append('template_id', memeData.templateId);
        formData.append('username', IMGFLIP_USERNAME);
        formData.append('password', IMGFLIP_PASSWORD);
        formData.append('text0', memeData.text0);
        formData.append('text1', memeData.text1);

        try {
            console.log(`Quietly generating image for index ${index}, template ${memeData.templateId}`);
            const response = await fetch('https://api.imgflip.com/caption_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
            });
            const data = await response.json();

            if (data.success) {
                const originalUrl = data.data.url;
                console.log(`Original Imgflip URL for index ${index} (quiet): ${originalUrl}`);
                const watermarkedDataUrl = await addWatermarkToImage(originalUrl, "learningly.xyz");

                // Update the specific meme with the generated URL (quietly)
                setMemeIdeas(prev => {
                    const updated = prev.map((item, idx) =>
                        idx === index ? { ...item, memeUrl: watermarkedDataUrl, isLoadingImage: false, imgflipError: '' } : item
                    );
                    // Save to database after successful generation
                    saveToDatabase(updated);
                    // Also immediately save to localStorage for instant persistence
                    saveMemesToLocalStorage(updated);
                    return updated;
                });

                return watermarkedDataUrl;
            } else {
                console.error(`Imgflip API Error for index ${index} (quiet):`, data.error_message);
                // Don't show errors in UI for quiet generation
                return null;
            }
        } catch (error) {
            console.error(`Network error generating image for index ${index} (quiet):`, error);
            return null;
        }
    }, [saveToDatabase, saveMemesToLocalStorage]);

    // --- Function to Trigger Generation for ALL Meme Images in Parallel ---
    const handleGenerateAllImages = useCallback(async (memeIdeasToProcess) => {
        if (loadingAllImages) return;

        console.log("Starting generation of all meme images...");
        setLoadingAllImages(true);

        // Process images in parallel with limited concurrency
        const maxConcurrent = 5; // Limit concurrent requests to be API-friendly
        const imagesToGenerate = memeIdeasToProcess
            .map((idea, index) => ({ idea, index }))
            .filter(({ idea }) => !idea.memeUrl && !idea.imgflipError);

        console.log(`Processing ${imagesToGenerate.length} images with max ${maxConcurrent} concurrent requests`);

        // Process in batches
        for (let i = 0; i < imagesToGenerate.length; i += maxConcurrent) {
            const batch = imagesToGenerate.slice(i, i + maxConcurrent);
            const promises = batch.map(({ index }) => generateSingleMemeImage(index));

            try {
                await Promise.allSettled(promises);
                // Small delay between batches to be API-friendly
                if (i + maxConcurrent < imagesToGenerate.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error("Error in batch processing:", error);
            }
        }

        console.log("Finished generating all meme images.");
        setLoadingAllImages(false);
    }, [generateSingleMemeImage, loadingAllImages]);

    // --- Function to Quietly Generate Images for Existing Memes (no UI loading states) ---
    const handleGenerateAllImagesQuietly = useCallback(async (allMemes, memesNeedingImages) => {
        console.log("Starting quiet generation of missing meme images...");

        // Create a map of original memes for reference
        const memeIndexMap = new Map();
        allMemes.forEach((meme, index) => {
            if (!meme.memeUrl && !meme.imgflipError) {
                memeIndexMap.set(meme, index);
            }
        });

        // Process images in parallel with limited concurrency
        const maxConcurrent = 3; // Lower concurrency for background processing
        const imagesToGenerate = Array.from(memeIndexMap.entries());

        console.log(`Quietly processing ${imagesToGenerate.length} images with max ${maxConcurrent} concurrent requests`);

        // Process in batches
        for (let i = 0; i < imagesToGenerate.length; i += maxConcurrent) {
            const batch = imagesToGenerate.slice(i, i + maxConcurrent);
            const promises = batch.map(([memeData, index]) => generateSingleMemeImageQuietly(index, memeData));

            try {
                await Promise.allSettled(promises);
                // Small delay between batches to be API-friendly
                if (i + maxConcurrent < imagesToGenerate.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error("Error in quiet batch processing:", error);
            }
        }

        console.log("Finished quiet generation of missing meme images.");
    }, [generateSingleMemeImageQuietly]);

    // Retry function for individual memes
    const retryMemeGeneration = useCallback(async (index) => {
        await generateSingleMemeImage(index);
    }, [generateSingleMemeImage]);

    // Download meme function
    const downloadMeme = async (memeUrl, memeName, index) => {
        if (!memeUrl || downloadingMeme === index) return;

        setDownloadingMeme(index);
        try {
            // Create a canvas to draw the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Use the browser's native Image constructor explicitly
            const img = new window.Image();

            img.crossOrigin = 'anonymous';

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw the image (which already has watermark)
                ctx.drawImage(img, 0, 0);

                // Convert to blob and download
                canvas.toBlob((blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${memeName.replace(/\s+/g, '_')}_meme_${index + 1}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    setDownloadingMeme(null);
                }, 'image/png');
            };

            img.onerror = () => {
                console.error('Failed to load image for download');
                setDownloadingMeme(null);
            };

            img.src = memeUrl;
        } catch (error) {
            console.error('Error downloading meme:', error);
            setDownloadingMeme(null);
        }
    };

    // --- Render Component ---
    return (
        <div className="p-4 max-w-full mx-auto font-sans dark:bg-zinc-900 dark:text-zinc-200 min-h-screen">
            <h1 className="text-3xl font-bold mb-2 text-center text-zinc-900 dark:text-zinc-200">Memes ftw!</h1>
            <p className="text-sm mb-5 text-center text-zinc-600 dark:text-zinc-200">Turn your distractions to <span className="text-green-300 italic">strength!</span></p>

            {/* Generate Meme Ideas Button */}
            <button
                onClick={generateMemeIdeasFromGemini}
                className="p-3 w-full rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800"
                disabled={!generativeModel || generatingTexts || loadingAllImages || !contextInput.trim()}
            >
                {generatingTexts ? (
                    <span className="flex items-center justify-center ">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Brewing Memes approx. {Math.round(totalQuizToGenerate * 4 / 60)} mins...
                    </span>
                ) : '💡 Get Memes!'}
            </button>

            {aiError && (
                <p className="text-red-600 dark:text-red-400 text-sm mb-3 text-center bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-300 dark:border-red-700">{aiError}</p>
            )}

            {generatingTexts && <LoadingSpinner />}

            {!generatingTexts && (
                <div className='flex flex-row text-zinc-800 dark:text-zinc-200 mt-2 mx-auto text-center'>
                    Number of memes:
                    <select
                        className='flex flex-col w-[3rem] ml-5 rounded dark:text-white bg-zinc-100 dark:bg-zinc-700'
                        value={totalQuizToGenerate}
                        onChange={(e) => setTotalQuizToGenerate(Number(e.target.value))}
                    >
                        <option value={3}>3</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={35}>35</option>
                        <option value={40}>40</option>
                    </select>
                </div>
            )}

            <div className="columns-1 md:columns-2 gap-4 mt-6 space-y-4">
                {memeIdeas.map((idea, index) => (
                    <div
                        key={`${idea.templateId}-${index}`}
                        className="mb-4 break-inside-avoid border rounded-lg dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 shadow p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                Meme # {index + 1}
                            </p>
                            {idea.memeUrl && !idea.isLoadingImage && !idea.imgflipError && (
                                <button
                                    onClick={() => downloadMeme(idea.memeUrl, idea.name, index)}
                                    disabled={downloadingMeme === index}
                                    className="flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Download meme"
                                >
                                    {downloadingMeme === index ? (
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <Download size={12} />
                                    )}
                                    {downloadingMeme === index ? 'Downloading...' : 'Download'}
                                </button>
                            )}
                        </div>

                        <div className="text-center">
                            {idea.isLoadingImage && !idea.memeUrl && (
                                <LoadingSpinner />
                            )}
                            {idea.imgflipError && !idea.isLoadingImage && !idea.memeUrl && (
                                <div className="text-center">
                                    <p className="text-red-600 dark:text-red-400 text-sm bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-300 dark:border-red-700">
                                        {idea.imgflipError}
                                    </p>
                                    <button
                                        onClick={() => retryMemeGeneration(index)}
                                        className="mt-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-2 rounded disabled:opacity-50"
                                        disabled={loadingAllImages || generatingTexts || idea.isLoadingImage}
                                    >
                                        Retry Image
                                    </button>
                                </div>
                            )}
                            {idea.memeUrl && (
                                <Image
                                    src={idea.memeUrl}
                                    width={idea.width || 500}
                                    height={idea.height || 500}
                                    alt={`Generated ${idea.name} meme ${index + 1}`}
                                    className="rounded shadow-md dark:border-zinc-600"
                                    loading="lazy"
                                    unoptimized={idea.memeUrl.includes('imgflip.com') || idea.memeUrl.startsWith('data:')}
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                            )}
                            {!idea.memeUrl && !idea.isLoadingImage && !idea.imgflipError && (
                                <div className="text-center p-4">
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                                        Meme template: {idea.name}
                                    </p>
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                        Top: "{idea.text0}"<br />
                                        Bottom: "{idea.text1}"
                                    </p>
                                    <button
                                        onClick={() => retryMemeGeneration(index)}
                                        className="mt-2 text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded disabled:opacity-50"
                                        disabled={loadingAllImages || generatingTexts || idea.isLoadingImage}
                                    >
                                        Generate Image
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {memeIdeas.length === 0 && !generatingTexts && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 mt-10">Seeing memes ain't no crime!</p>
            )}
        </div>
    );
}