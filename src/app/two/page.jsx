// 'use client';

// import { useEffect, useRef, useState, useCallback } from 'react';
// import Script from 'next/script'; // Use Next.js Script component
// import { marked } from 'marked';
// import html2pdf from 'html2pdf.js';
// import RichMermaidMarkdown from '../components/MermaidRender'; // Adjust path as needed
// import LoadingSpinner from '../components/LoadingSpinner'; // Adjust path if needed
// // import generatePDF from 'react-to-pdf';
// import generatePDF, { Resolution, Margin } from 'react-to-pdf';

// import {
//   GoogleGenAI,
//   createUserContent,
//   createPartFromUri,
// } from "@google/genai";
// const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // Replace with your actual key or env var

// let genAI; // Initialize outside component to avoid recreation on re-renders

// genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

// // Default export component
// export default function MarkdownToPdf() {
//   const [markdown, setMarkdown] = useState('# hde');
//   const [isGenerating, setIsGenerating] = useState(false);
//   const [isDownloading, setIsDownloading] = useState(false);
//   const [error, setError] = useState(null); // Added error state
//   const contentRef = useRef(null); // Ref for the *container* of RichMarkdown for PDF capture

//   // --- REMOVED marked configuration ---
//   // --- REMOVED mermaid state/refs/functions ---
//   // const [mermaidReady, setMermaidReady] = useState(false);
//   // const mermaidInitialized = useRef(false);
//   // const renderMermaid = useCallback(...) => {};
//   // const handleMermaidLoad = () => {};

//   // --- REMOVED useEffect hooks for marked/mermaid rendering ---

//   // --- API Call (Simplified Gemini Usage) ---
//   const handleGenerateContent = async () => {
//     if (!genAI) {
//       setError("AI Client not initialized. Check API Key.");
//       alert("AI Client not initialized. Check API Key.");
//       return;
//     }
//     setIsGenerating(true);
//     setMarkdown(''); // Clear previous content
//     setError(null);

//     try {
//       // Using a more detailed prompt as used in the RichMarkdown example
//       const prompt = `
//         Generate a document using standard GitHub Flavored Markdown (GFM). Include ALL of the following elements:
//         1. A main title using H1 (# Title).
//         2. An H2 subheading (## Subheading).
//         3. At least two paragraphs of introductory text, including some **bold text** and *italic text*.
//         4. A blockquote (> Quote...).
//         5. An unordered bulleted list (* Item or - Item).
//         6. An ordered numbered list (1. Item).
//         7. A simple data table with a header row and at least two data rows.
//         8. A simple Mermaid flowchart diagram enclosed in a mermaid code block. Example:
//            \`\`\`mermaid
//            graph TD
//                A[Start] --> B(Process 1);
//                B --> C{Decision};
//                C -->|Yes| D[End];
//                C -->|No| E[Process 2];
//                E --> D;
//            \`\`\`
//         9. Some concluding text in a paragraph.

//         Ensure correct Markdown syntax for all elements, especially the table and the fenced code block for Mermaid. Do not include any text before the H1 title or after the concluding paragraph.
//         `;
//       console.log('Requesting content from Gemini...');

//       // const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
//       // const result = await model.generateContent(prompt);
//       const result = await genAI.models.generateContent({
//         model: "gemini-2.5-flash-preview-04-17", // Ensure this model ID is correct and available
//         contents: createUserContent(prompt), // Pass the dynamically created array
//       });
//       const response = result.text;
//       const generatedText = response

//       console.log('Received content from Gemini.');
//       setMarkdown(generatedText);

//     } catch (error) {
//       console.error('Error generating content from Gemini:', error);
//       let errorMsg = `Failed to generate content: ${error.message || 'Unknown error'}`;
//       if (error.message && error.message.includes('API key not valid')) {
//         errorMsg = "Invalid Google API Key. Please check your configuration.";
//       }
//       setError(errorMsg);
//       setMarkdown(`# Generation Error\n\n${errorMsg}`);
//     } finally {
//       setIsGenerating(false);
//     }
//   };
//   const options = {
//     // default is `save`
//     filename: "advanced-example.pdf",
//     // default is `save`
//     method: "save",


//     page: {
//       // margin is in MM, default is Margin.NONE = 0
//       margin: 15,
//       // default is 'A4'
//       // format: "letter",
//       // default is 'portrait'
//       // orientation: "landscape",
//     },

//     overrides: {
//       // see https://artskydj.github.io/jsPDF/docs/jsPDF.html for more options
//       pdf: {
//         compress: true,
//       },
//       // see https://html2canvas.hertzen.com/configuration for more options
//       canvas: {
//         useCORS: true,
//       },
//     },
//   };
//   const getTargetElement = () => document.getElementById('pdf-content-area');
//   // --- PDF Download (Adjusted) ---
//   const downloadPDF = async () => {
//     // 1. Get the element to capture directly
//     generatePDF(contentRef, options)
//   };

//   // --- JSX ---
//   return (
//     <div className="container mx-auto p-4 md:p-8 max-w-5xl"> {/* Adjusted max-width */}
//       <h1 className="text-2xl font-bold mb-6 text-center">Markdown Generator & PDF Exporter (ReactMarkdown)</h1>

//       {/* Button Controls */}
//       <div className="flex flex-wrap gap-4 mb-6 justify-center">
//         <button
//           onClick={handleGenerateContent}
//           disabled={isGenerating || isDownloading || !genAI}
//           className="px-5 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//           title={!genAI ? "Google AI client not initialized." : "Generate content using Gemini"}
//         >
//           {isGenerating ? (<span className="flex items-center"><LoadingSpinner size="h-5 w-5" color="border-white" /> <span className="ml-2">Generating...</span></span>) : 'Generate Markdown'}
//         </button>

//         <button
//           onClick={downloadPDF}
//           disabled={!markdown || isGenerating || isDownloading}
//           className="px-5 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//         >
//           {isDownloading ? (<span className="flex items-center"><LoadingSpinner size="h-5 w-5" color="border-white" /> <span className="ml-2">Downloading...</span></span>) : 'Download PDF'}
//         </button>
//       </div>

//       {/* Error Display Area */}
//       {error && (
//         <div className="my-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center">
//           <strong>Error:</strong> {error}
//         </div>
//       )}

//       {/* Loading Placeholder */}
//       {isGenerating && !markdown && <p className="text-center text-gray-500 dark:text-gray-400">Loading content from Gemini...</p>}


//       {/* Container for RichMarkdown - This div is captured by html2pdf */}
//       <div ref={contentRef} id="pdf-content-area" >

//         <RichMermaidMarkdown mark={markdown} />
//       </div>

//     </div>
//   );
// }

export default function g() {
  return (<h1>Working</h1>)
}
