"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createUserContent } from "@google/genai"; // Assuming this is correctly set up for your genAI instance
import { Info } from 'lucide-react';
import { UploadCloud, FileText, Copy, Download, AlertCircle, Loader2, XCircle, Edit, BookOpen, Trash2, Bold, Italic, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useUserActivityAPI } from '../lib/getUsage'; // Adjust path if needed
import { useRouter } from 'next/navigation';      // Or 'next/router' if using Pages Router
import { toast } from "sonner";
import { triggerProButtonDialog } from '@/lib/utils';

// Initialize PDF.js only on client side
let pdfjsLib = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist/build/pdf').then((module) => {
    pdfjsLib = module;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
  });
}

const MIN_WORDS_PDF = 250;
const MIN_WORDS_READING_MATERIAL = 100;
const MAX_READING_MATERIALS = 5; // Change this number to set the maximum files allowed

// Style options similar to EWTPage for consistency
const predefinedStyleOptions = [
  { value: 'default', label: 'Default' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'informal', label: 'Informal' },
  { value: 'scientific', label: 'Scientific' },
  { value: 'business', label: 'Business' },
  { value: 'creative', label: 'Creative' },
  { value: 'academic', label: 'Academic' },
  { value: 'concise', label: 'Concise' },
  { value: 'witty', label: 'Witty' }
];

const PersonalizedWritingTab = ({ genAI }) => {
  // PDF related state (for writing style)
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [sampleText, setSampleText] = useState(''); // Text extracted from PDF
  const [wordCount, setWordCount] = useState(0);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const router = useRouter(); // For navigation if "Buy" is clicked
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  // Reading materials state
  const [readingMaterials, setReadingMaterials] = useState([]); // Array of {id, name, text, wordCount}
  const [isProcessingReading, setIsProcessingReading] = useState(false);
  const [readingUploadError, setReadingUploadError] = useState('');

  // Predefined style state
  const [selectedStyle, setSelectedStyle] = useState(predefinedStyleOptions[0].value);

  // Common state
  const [topic, setTopic] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For AI generation
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showStyleInfoModal, setShowStyleInfoModal] = useState(false);

  // Rich text editor state
  const [editorContent, setEditorContent] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [textAlign, setTextAlign] = useState('left');
  const editorRef = useRef(null);

  const isPdfUploadedAndValid = !!sampleText && wordCount >= MIN_WORDS_PDF;
  const hasValidReadingMaterials = readingMaterials.length > 0 && readingMaterials.every(rm => rm.wordCount >= MIN_WORDS_READING_MATERIAL);

  const resetPdfStates = () => {
    setUploadedFile(null);
    setPdfName('');
    setSampleText('');
    setWordCount(0);
    // Clear PDF-specific errors, but not general errors like API key issues
    if (error.includes("PDF") || error.includes("words")) {
      setError('');
    }
    // Reset the file input visually
    const fileInput = document.getElementById('pdfUpload');
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const resetReadingMaterials = () => {
    setReadingMaterials([]);
    setReadingUploadError('');
    const fileInput = document.getElementById('readingMaterialsUpload');
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      resetPdfStates(); // Clear PDF info if file selection is cancelled
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      resetPdfStates();
      return;
    }

    // Clear previous PDF data and errors before processing new file
    resetPdfStates();
    setError(''); // Clear general errors too
    setGeneratedText(''); // Clear previous output
    setUploadedFile(file);
    setPdfName(file.name);
    setIsProcessingPdf(true);

    try {
      // Ensure PDF.js is loaded
      if (!pdfjsLib) {
        const module = await import('pdfjs-dist/build/pdf');
        pdfjsLib = module;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }

      const words = fullText.trim().split(/\s+/).filter(Boolean);
      setSampleText(fullText.trim());
      setWordCount(words.length);

      if (words.length < MIN_WORDS_PDF) {
        setError(`PDF must contain at least ${MIN_WORDS_PDF} words. Detected: ${words.length}. Predefined styles are available.`);
        // Keep sampleText and wordCount to show the info, but it won't be "valid" for generation
      } else {
        setError(''); // Clear any previous errors if PDF is valid
      }
    } catch (e) {
      console.error("Error processing PDF:", e);
      setError("Failed to process PDF. Please ensure it's a valid file. Predefined styles are available.");
      resetPdfStates(); // Full reset if PDF processing fails
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleReadingMaterialsChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      resetReadingMaterials();
      return;
    }

    // Check file limit
    if (files.length > MAX_READING_MATERIALS) {
      setReadingUploadError(`Maximum ${MAX_READING_MATERIALS} files allowed. You selected ${files.length} files.`);
      resetReadingMaterials();
      return;
    }

    // Validate all files are PDFs
    const nonPdfFiles = files.filter(file => file.type !== 'application/pdf');
    if (nonPdfFiles.length > 0) {
      setReadingUploadError('All files must be PDF format.');
      resetReadingMaterials();
      return;
    }

    setReadingUploadError('');
    setIsProcessingReading(true);
    setGeneratedText(''); // Clear previous output

    try {
      const processedMaterials = [];

      for (const file of files) {
        // Ensure PDF.js is loaded
        if (!pdfjsLib) {
          const module = await import('pdfjs-dist/build/pdf');
          pdfjsLib = module;
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }

        const words = fullText.trim().split(/\s+/).filter(Boolean);

        processedMaterials.push({
          id: Date.now() + Math.random(), // Simple unique ID
          name: file.name,
          text: fullText.trim(),
          wordCount: words.length
        });
      }

      setReadingMaterials(processedMaterials);

      // Check if any materials are too short
      const shortMaterials = processedMaterials.filter(rm => rm.wordCount < MIN_WORDS_READING_MATERIAL);
      if (shortMaterials.length > 0) {
        setReadingUploadError(`Some files have too few words (min ${MIN_WORDS_READING_MATERIAL}): ${shortMaterials.map(rm => `${rm.name} (${rm.wordCount})`).join(', ')}`);
      }

    } catch (e) {
      console.error("Error processing reading materials:", e);
      setReadingUploadError("Failed to process some PDF files. Please ensure they are valid.");
      resetReadingMaterials();
    } finally {
      setIsProcessingReading(false);
    }
  };

  const removeReadingMaterial = (id) => {
    setReadingMaterials(prev => prev.filter(rm => rm.id !== id));
    if (readingMaterials.length === 1) {
      // If removing the last item, reset the file input
      const fileInput = document.getElementById('readingMaterialsUpload');
      if (fileInput) {
        fileInput.value = "";
      }
      setReadingUploadError('');
    }
  };

  const handleClearPdf = () => {
    resetPdfStates();
    setError(''); // Clear any errors related to PDF
  };

  const handleStyleButtonClick = (styleValue) => {
    setSelectedStyle(styleValue);
  };

  const handleTopicChange = (e) => {
    setTopic(e.target.value);
  };

  const callAIForTextGeneration = async () => {
    let prompt = "";
    let processedText = "";

    if (hasValidReadingMaterials) {
      // Mode 3: Use reading materials with optional style
      const combinedReadingText = readingMaterials
        .map(rm => `--- ${rm.name} ---\n${rm.text}`)
        .join('\n\n');

      let styleInstruction = "";
      if (isPdfUploadedAndValid) {
        styleInstruction = `Write in the style of the following sample text:\n\n--- Writing Style Sample ---\n${sampleText}\n\n`;
      } else {
        const selectedStyleLabel = predefinedStyleOptions.find(opt => opt.value === selectedStyle)?.label || 'default';
        styleInstruction = `Write in a ${selectedStyleLabel} style. `;
      }

      prompt = `You are tasked with writing content based ONLY on the information provided in the reading materials below. Do not use any external knowledge beyond what is explicitly stated in these documents.

${styleInstruction}

Reading Materials:
"""
${combinedReadingText}
"""

Instructions/Topic:
"""
${topic}
"""

Based ONLY on the information from the reading materials above, write a comprehensive response to the given instructions/topic. Extract relevant information from the provided documents and synthesize it according to the instructions. Do not include information that is not present in the reading materials.

The response should be well-structured, engaging, and at least 150 words if the topic allows. Return only the generated text without any introductory phrases or meta-commentary.

Generated Text:`;

    } else if (isPdfUploadedAndValid) {
      // Mode 1: Use PDF's writing style
      prompt = `Analyze the writing style of the following 'Sample Text'. Consider elements like tone, vocabulary, sentence structure, common phrases, rhythm, and pacing.
      After thoroughly understanding this style, write a new piece of text on the 'Given Topic'. Your generated text must emulate the analyzed writing style as closely as possible.
      The generated text should be at least 150 words long if the topic allows.
      Return *only* the newly generated text for the 'Given Topic', written in the identified style. Do not include any introductory phrases, your analysis of the style, or any other meta-commentary.

      Sample Text:
      """
      ${sampleText}
      """

      Given Topic:
      """
      ${topic}
      """

      Generated Text in the style of the Sample Text:
      `;
    } else {
      // Mode 2: Use predefined style
      const selectedStyleLabel = predefinedStyleOptions.find(opt => opt.value === selectedStyle)?.label || 'default';
      prompt = `Write a piece of text on the 'Given Topic' in a ${selectedStyleLabel} style.
      The text should be well-structured, engaging, and appropriate for the chosen style.
      Aim for at least 150 words if the topic allows.
      Return *only* the generated text. Do not include any introductory phrases or meta-commentary.

      Given Topic:
      """
      ${topic}
      """

      Generated Text in ${selectedStyleLabel} style:
      `;
    }

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: createUserContent(prompt),
      });

      if (result.response && typeof result.response.text === 'function') {
        processedText = await result.response.text();
      } else if (result.response && result.response.candidates && result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts[0].text) {
        processedText = result.response.candidates[0].content.parts[0].text;
      } else if (result.text) { // Fallback for original structure
        processedText = result.text;
      } else {
        console.warn("Unexpected AI response structure:", result);
        throw new Error("Could not extract text from AI response.");
      }
    } catch (error) {
      console.error("Error calling AI for text generation:", error);
      if (error.message?.includes("API key not valid")) {
        processedText = "Error: The provided API key is not valid. Please check your API key.";
      } else if (error.message?.includes("quota")) {
        processedText = "Error: API quota exceeded. Please check your quota or try again later.";
      } else if (error.message?.includes("SAFETY")) {
        processedText = "Error: The request was blocked due to safety concerns by the AI. Please revise your sample text or topic.";
      } else {
        processedText = "An error occurred while generating text. Please try again later.";
      }
      setError(processedText); // Also set it as a visible error
    }
    return processedText;
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic or writing prompt.");
      return;
    }

    const hasStyleOption = isPdfUploadedAndValid || selectedStyle;
    const hasContent = hasValidReadingMaterials || hasStyleOption;

    if (!hasContent) {
      setError("Please either upload reading materials, upload a valid style PDF, or select a writing style.");
      return;
    }

    // === USAGE CHECK STARTS HERE ===
    const actionKey = "per_w"; // Personalized Writing
    const remainingCredits = await getUserActivityUsage(actionKey);

    if (remainingCredits <= 0) {
      toast("Free limit finished for Personalized Writing, Buy premium!", {
        description: "For $4.99 get higher usage limits", // Updated price
        action: {
          label: "Buy",
          onClick: () => triggerProButtonDialog(),
        },
      });
      setIsLoading(false); // Ensure loading is off if returning early
      return; // Stop further processing
    }
    // === USAGE CHECK ENDS HERE ===

    setError('');
    setIsLoading(true);
    setGeneratedText('');
    setEditorContent(''); // Clear editor content

    const result = await callAIForTextGeneration();
    setGeneratedText(result); // This might set an error message if AI call failed internally

    // Update rich text editor with the generated content
    if (result && !result.startsWith("Error:")) {
      updateEditorContent(result);
    }

    // === DECREMENT USAGE STARTS HERE ===
    if (result && !result.startsWith("Error:")) { // Check if AI call was successful
      await decrementUserActivityUsage(actionKey);
    }
    // === DECREMENT USAGE ENDS HERE ===

    if (result.startsWith("Error:")) { // If the result itself is an error message
      setError(result);
    }
    setIsLoading(false);
  };

  const copyOutputToClipboard = () => {
    if (editorContent && !generatedText.startsWith("Error:")) {
      // Copy as plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editorContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      navigator.clipboard.writeText(plainText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        setError("Failed to copy text to clipboard.");
      });
    }
  };

  const downloadOutputAsTxt = () => {
    if (!editorContent || generatedText.startsWith("Error:")) return;

    // Create both HTML and plain text versions
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Download as HTML
    const htmlBlob = new Blob([editorContent], { type: 'text/html;charset=utf-8' });
    const htmlLink = document.createElement('a');
    htmlLink.href = URL.createObjectURL(htmlBlob);
    htmlLink.download = `${topic.trim().replace(/\s+/g, '_') || 'generated_writing'}.html`;
    document.body.appendChild(htmlLink);
    htmlLink.click();
    document.body.removeChild(htmlLink);
    URL.revokeObjectURL(htmlLink.href);

    // Also download as plain text
    const txtBlob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const txtLink = document.createElement('a');
    txtLink.href = URL.createObjectURL(txtBlob);
    txtLink.download = `${topic.trim().replace(/\s+/g, '_') || 'generated_writing'}.txt`;
    document.body.appendChild(txtLink);
    txtLink.click();
    document.body.removeChild(txtLink);
    URL.revokeObjectURL(txtLink.href);
  };

  const toggleStyleInfoModal = () => {
    setShowStyleInfoModal(!showStyleInfoModal);
  };

  // Rich text editor functions
  const toggleBold = () => {
    document.execCommand('bold', false, null);
    setIsBold(!isBold);
  };

  const toggleItalic = () => {
    document.execCommand('italic', false, null);
    setIsItalic(!isItalic);
  };

  const changeFontSize = (size) => {
    document.execCommand('fontSize', false, size);
    setFontSize(size);
  };

  const changeTextAlign = (align) => {
    document.execCommand('justify' + align.charAt(0).toUpperCase() + align.slice(1), false, null);
    setTextAlign(align);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML);
    }
  };

  const updateEditorContent = (content) => {
    // Convert plain text to HTML with proper line breaks
    const formattedContent = content.replace(/\n/g, '<br>');
    setEditorContent(formattedContent);
    if (editorRef.current) {
      editorRef.current.innerHTML = formattedContent;
    }
  };

  // Update editor content when generatedText changes
  useEffect(() => {
    if (generatedText && !generatedText.startsWith("Error:")) {
      updateEditorContent(generatedText);
    }
  }, [generatedText]);

  // Theme styles (consistent with EWTPage)
  const newButtonThemeBase = "px-3 py-2 text-sm rounded-md transition-colors ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50";
  const newButtonTheme = `bg-zinc-200 text-black dark:text-white dark:bg-zinc-700 dark:text-green-300 dark:hover:bg-zinc-200 dark:hover:text-zinc-800 duration-300`;
  const selectedButtonTheme = "dark:bg-green-300 bg-zinc-700 dark:text-zinc-900 dark:text-black text-white border-1 border-green-300";
  return (
    <div className="p-6 bg-zinc-100 dark:bg-zinc-900 rounded-lg rounded-tl-none rounded-tr-none  shadow-md">
      <div className="flex items-center mb-2">
        <Edit size={24} className="mr-3 text-zinc-900 dark:text-zinc-200" />
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-200">Personalized & Styled Writing</h2>
        <button
          onClick={toggleStyleInfoModal}
          className="ml-2 p-0.5 inline-flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 focus:ring-zinc-500 transition-colors"
          aria-label="More info on predefined styles"
          type="button" // Explicitly set type to button to prevent form submission
        >
          <Info size={16} /> </button>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Upload reading materials (PDFs) to write based on their content, use a PDF's writing style, or choose a predefined style. Then enter instructions to generate text.
      </p>


      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-800/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md flex items-center">
          <AlertCircle size={20} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-8">
        {/* Left Column: Inputs & Style Selection */}
        <div className="space-y-6">
          {/* Reading Materials Upload Section */}
          <div className="p-4 border-2 border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
            <label htmlFor="readingMaterialsUpload" className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              <BookOpen size={18} className="inline mr-2" />
              Option 1: Upload Reading Materials (Primary Source)
            </label>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
              Upload PDF documents that the AI will use as the source material for writing. The AI will extract information only from these documents. (Max {MAX_READING_MATERIALS} files)
            </p>

            <div className="flex items-center gap-2">
              <input
                type="file"
                id="readingMaterialsUpload"
                accept=".pdf"
                multiple
                onChange={handleReadingMaterialsChange}
                disabled={isLoading || isProcessingReading}
                className="hidden"
              />
              <label
                htmlFor="readingMaterialsUpload"
                className={`w-full flex items-center justify-center px-4 py-2.5 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors
                  ${(isLoading || isProcessingReading) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <UploadCloud size={18} className="mr-2" />
                {readingMaterials.length > 0 ? `Change Reading Materials (${readingMaterials.length}/${MAX_READING_MATERIALS} files)` : `Select PDF Reading Materials (Max ${MAX_READING_MATERIALS})`}
              </label>
              {readingMaterials.length > 0 && (
                <button
                  onClick={resetReadingMaterials}
                  className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Clear all reading materials"
                  disabled={isLoading || isProcessingReading}
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            {isProcessingReading && (
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center">
                <Loader2 size={16} className="animate-spin mr-2" />
                Processing reading materials...
              </div>
            )}

            {readingUploadError && (
              <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                <AlertCircle size={16} className="inline mr-1" /> {readingUploadError}
              </div>
            )}

            {readingMaterials.length > 0 && !isProcessingReading && (
              <div className="mt-3 space-y-2">
                {readingMaterials.map((rm) => (
                  <div key={rm.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600">
                    <div className="flex items-center text-sm">
                      <FileText size={16} className="mr-2 text-blue-500" />
                      <span className="font-medium">{rm.name}</span>
                      <span className={`ml-2 text-xs ${rm.wordCount >= MIN_WORDS_READING_MATERIAL ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        ({rm.wordCount} words)
                      </span>
                    </div>
                    <button
                      onClick={() => removeReadingMaterial(rm.id)}
                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Remove this file"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ✓ AI will write based only on content from these documents
                </p>
              </div>
            )}
          </div>

          {/* PDF Upload Section for Writing Style */}
          <div className="p-4 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white/50 dark:bg-zinc-700/30">
            <label htmlFor="pdfUpload" className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              Option 2: Use Your Writing Style (via PDF)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="pdfUpload"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isLoading || isProcessingPdf}
                className="hidden"
              />
              <label
                htmlFor="pdfUpload"
                className={`w-full flex items-center justify-center px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 cursor-pointer transition-colors
                  ${(isLoading || isProcessingPdf) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <UploadCloud size={18} className="mr-2" />
                {pdfName && sampleText ? 'Change Style PDF' : 'Select PDF for Writing Style'}
              </label>
              {pdfName && sampleText && (
                <button
                  onClick={handleClearPdf}
                  className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Clear uploaded PDF"
                  disabled={isLoading || isProcessingPdf}
                >
                  <XCircle size={20} />
                </button>
              )}
            </div>
            {isProcessingPdf && (
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center">
                <Loader2 size={16} className="animate-spin mr-2" />
                Processing PDF...
              </div>
            )}
            {pdfName && sampleText && !isProcessingPdf && (
              <div className={`mt-2 text-sm ${wordCount < MIN_WORDS_PDF ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                <FileText size={16} className="inline mr-1" /> {pdfName} ({wordCount} words)
                {wordCount > 0 && wordCount < MIN_WORDS_PDF && ` - (Style not used, needs ${MIN_WORDS_PDF - wordCount} more words)`}
                {wordCount >= MIN_WORDS_PDF && " - ✓ Style will be used"}
              </div>
            )}
            {!pdfName && !sampleText && !isProcessingPdf && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Min {MIN_WORDS_PDF} words required to use PDF style.</p>
            )}
          </div>

          {/* Predefined Style Selection Section */}
          <div className={`p-4 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white/50 dark:bg-zinc-700/30 ${isPdfUploadedAndValid ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
              Option 3: Select a Predefined Style <span className="text-xs font-normal">{isPdfUploadedAndValid ? '(Disabled - using PDF style)' : ''}</span>

            </label>

            <div className="flex flex-wrap gap-2">
              {predefinedStyleOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleStyleButtonClick(option.value)}
                  disabled={isLoading || isProcessingPdf || isPdfUploadedAndValid}
                  className={`${newButtonThemeBase}
                    ${selectedStyle === option.value && !isPdfUploadedAndValid
                      ? selectedButtonTheme // Use distinct selected theme
                      : `${newButtonTheme} focus:ring-blue-400`
                    }
                    ${(isLoading || isProcessingPdf || isPdfUploadedAndValid) ? 'opacity-60 cursor-not-allowed filter grayscale' : ''}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic Input */}
          <div>
            <label htmlFor="topicInputPersonalized" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Enter Your Instructions/Topic:
            </label>
            <textarea
              id="topicInputPersonalized"
              className="w-full h-32 p-3 text-sm text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-600 resize-none placeholder-zinc-400 dark:placeholder-zinc-500"
              placeholder={
                hasValidReadingMaterials
                  ? "e.g., Summarize the key findings, Write an analysis of the main themes, Create a report based on the research data..."
                  : "e.g., The future of AI in education, A story about a hidden world..."
              }
              value={topic}
              onChange={handleTopicChange}
              disabled={isLoading || isProcessingPdf || isProcessingReading}
            />
            {hasValidReadingMaterials && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                💡 The AI will write based only on your uploaded reading materials
              </p>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || isProcessingPdf || isProcessingReading}
            className={`w-full px-4 py-3 text-base rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 flex items-center justify-center transition-all duration-150 ease-in-out ${newButtonTheme} hover:shadow-lg hover:scale-[1.02]`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Generating Text...
              </>
            ) : (
              "Generate Text"
            )}
          </button>
        </div>

        {/* Right Column: Output */}
        <div className="mt-0 md:mt-0 h-full flex flex-col">
          {generatedText ? (
            <div className="p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[300px] flex flex-col flex-grow shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200">Generated Text:</h3>

                {/* Rich Text Editor Toolbar */}
                {!generatedText.startsWith("Error:") && (
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-600 rounded-md p-1">
                    <button
                      onClick={toggleBold}
                      className={`p-1.5 rounded ${isBold ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500'} transition-colors`}
                      title="Bold"
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      onClick={toggleItalic}
                      className={`p-1.5 rounded ${isItalic ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500'} transition-colors`}
                      title="Italic"
                    >
                      <Italic size={14} />
                    </button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-500 mx-1"></div>
                    <select
                      value={fontSize}
                      onChange={(e) => changeFontSize(parseInt(e.target.value))}
                      className="px-2 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-500 rounded text-zinc-700 dark:text-zinc-300"
                    >
                      <option value={12}>12px</option>
                      <option value={14}>14px</option>
                      <option value={16}>16px</option>
                      <option value={18}>18px</option>
                      <option value={20}>20px</option>
                      <option value={24}>24px</option>
                    </select>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-500 mx-1"></div>
                    <button
                      onClick={() => changeTextAlign('left')}
                      className={`p-1.5 rounded ${textAlign === 'left' ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500'} transition-colors`}
                      title="Align Left"
                    >
                      <AlignLeft size={14} />
                    </button>
                    <button
                      onClick={() => changeTextAlign('center')}
                      className={`p-1.5 rounded ${textAlign === 'center' ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500'} transition-colors`}
                      title="Align Center"
                    >
                      <AlignCenter size={14} />
                    </button>
                    <button
                      onClick={() => changeTextAlign('right')}
                      className={`p-1.5 rounded ${textAlign === 'right' ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500'} transition-colors`}
                      title="Align Right"
                    >
                      <AlignRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Rich Text Editor */}
              <div className="flex-grow overflow-y-scroll h-full scrollbar-thin">
                <div
                  ref={editorRef}
                  contentEditable={!generatedText.startsWith("Error:")}
                  onInput={handleEditorInput}
                  className="w-full h-full min-h-[200px]  text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto scrollbar-thin"
                  style={{ fontSize: `${fontSize}px` }}
                  suppressContentEditableWarning={true}
                  dangerouslySetInnerHTML={{ __html: editorContent }}
                />
              </div>

              {!generatedText.startsWith("Error:") && (
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-600 flex gap-2">
                  <button
                    onClick={copyOutputToClipboard}
                    className={`px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors self-start ${newButtonTheme} flex items-center gap-2`}
                  >
                    <Copy size={16} /> {copied ? "Copied!" : "Copy"}
                  </button>

                </div>
              )}
            </div>
          ) : isLoading || isProcessingPdf || isProcessingReading ? (
            <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[300px] flex-grow shadow">
              <Loader2 className="animate-spin h-10 w-10 text-blue-500 dark:text-blue-400" />
              <p className="text-zinc-500 dark:text-zinc-400 mt-3">
                {isProcessingReading ? "Processing reading materials..." : isProcessingPdf ? "Analyzing PDF..." : isLoading ? "Generating text..." : "Preparing..."}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 min-h-[300px] flex-grow shadow">
              <p className="text-zinc-500 dark:text-zinc-400">Output will appear here.</p>
            </div>
          )}
        </div>
      </div>


      {/* Style Info Modal */}
      {showStyleInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg shadow-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-xl font-semibold">Predefined Style Information</h3>
              <button
                onClick={toggleStyleInfoModal}
                className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close modal"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-4 text-sm space-y-3">
              <p>This option allows the AI to generate text in a specific, common writing style (like formal, casual, scientific, creative, etc.) based on your chosen topic/instructions.</p>
              <p><strong>How to use:</strong> Simply select one of the buttons representing the desired style. The AI will then attempt to write the text on your topic while mimicking the characteristics of that style.</p>
              <p><strong>Note:</strong> If you upload a PDF in Option 2 and it has enough words (min {MIN_WORDS_PDF}), the AI will prioritize using the writing style from your PDF. This option (Option 3) will be disabled in that case.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalizedWritingTab;