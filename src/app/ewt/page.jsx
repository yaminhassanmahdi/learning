"use client";

import React, { useState, useEffect } from 'react';

import { useUserActivityAPI } from '../lib/getUsage'; // Adjust path as needed
import { useRouter } from 'next/navigation'; // Or 'next/router' if using Pages Router
import { toast } from "sonner"; // Or your preferred toast library
import { triggerProButtonDialog } from '@/lib/utils';
import { GoogleGenAI, createUserContent } from "@google/genai"; // Or your specific import
// Add Info icon from lucide-react
import { Shuffle, Smile, SpellCheck, Brain, Edit3, Languages, Info } from 'lucide-react'; // Added Languages and Info icon
import PersonalizedWritingTab from '../components/PerW';
import GrammarCorrectorTab from '../components/gramTab';
import AIDetectorTab from '../components/AIDetectortab'; // Import the new AIDetectorTab component

// Import Resizable components (adjust path if necessary)
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"; // Assuming this is the correct path

// IMPORTANT: It's highly recommended to move API keys to environment variables
// and not hardcode them in client-side code for security reasons.
const GOOGLE_API_KEY = "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // User's provided key
const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

const styleOptions = [
  { value: 'default', label: 'Default' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'concise', label: 'Concise' },
  { value: 'academic', label: 'Academic' },
  // { value: 'creative', label: 'Creative' },
  { value: 'gen_z', label: 'Gen Z' },
];

const languageOptions = [
  { value: 'en-US', label: 'US English' },
  { value: 'en-GB', label: 'British English' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
];

const callAiModel = async (action, text, style = 'default', language = 'en-US') => {
  let prompt = "";
  let processedText = "";

  if (!text.trim()) {
    return "Please enter some text.";
  }

  const selectedStyleOption = styleOptions.find(option => option.value === style);
  const styleLabel = selectedStyleOption ? selectedStyleOption.label : 'default';

  const selectedLanguageOption = languageOptions.find(option => option.value === language);
  const languageLabel = selectedLanguageOption ? selectedLanguageOption.label : 'US English';

  try {
    if (action === "paraphraser") {
      prompt = `Paraphrase the following text in a ${styleLabel} style, adhering to ${languageLabel} language conventions. Return only the paraphrased text, without any introductory phrases, option numbering, or explanations:

${text}`;
    } else if (action === "humanizer") {
      prompt = `Rewrite this text to sound natural and human-written. Use simple, clear language that anyone can understand.

      Rules for humanizing:
      - Replace difficult words with common synonyms
      - Keep sentences short (10 words or less when possible)
      - Write like a basic English speaker
      - Use simple, everyday words
      - Avoid filler words like "you know", "you see", "like", "well"
      - Don't add unnecessary phrases or transitions
      - Make it sound natural but not overly casual
      - Write in ${styleLabel} style using ${languageLabel} conventions
      - Keep the original meaning intact

      Return only the rewritten text. No explanations or extra words.

      Text to humanize:
      ${text}`;
    } else if (action === "ai_detect") {
      // MODIFIED PROMPT for ai_detect
      prompt = `Analyze the provided multiline text to determine how AI-generated it sounds. Adhere strictly to the output format below.

Input Text (assume 1-based line numbering for your analysis of this text block):
---
${text}
---

Output Format:

AI Likeness Score: [Score from 0-100]%

General Analysis:
[Your general analysis about the text's overall AI-like characteristics, e.g., tone, repetitiveness, complexity, flow. Be concise. If none, state "No general AI-like characteristics identified.".]

Line-specific Feedback:
[List specific parts of the text that sound AI-generated. For each, provide:
- The 1-based line number from the original Input Text provided above.
- The exact phrase quoted from that line.
- A brief and concise explanation of why it sounds AI-generated.
Format each as: Line [Number]: "[Quoted phrase]" - [Explanation]
If no specific lines/phrases are identified as particularly AI-prone, state "No specific lines identified as AI-prone." under this heading.]
`;
    } else {
      console.log("Invalid action:", action);
      return "Invalid action.";
    }

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash", // Consider using a more advanced model if available and suitable for detailed analysis
      contents: createUserContent(prompt),
    });

    if (result.response && typeof result.response.text === 'function') {
      processedText = await result.response.text();
    } else if (result.response && result.response.candidates && result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts[0].text) {
      processedText = result.response.candidates[0].content.parts[0].text;
    } else if (result.text) { // Fallback for older or different SDK structures if any
      processedText = result.text;
    } else {
      console.warn("Unexpected AI response structure in callAiModel:", result);
      processedText = "Error: Could not extract text from AI response. Please check console for details. The AI's response might be empty or in an unexpected format.";
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
      processedText = `Error: Request blocked due to safety concerns (${error.response.promptFeedback.blockReason}). Please revise your input.`;
    } else if (error.message) {
      if (error.message.includes("API key not valid")) {
        processedText = "Error: The API key is not valid. Please check your API key.";
      } else if (error.message.includes("quota")) {
        processedText = "Error: API quota exceeded. Please try again later.";
      } else if (error.message.toUpperCase().includes("SAFETY")) { // General safety check
        processedText = "Error: Request blocked due to safety concerns. Please revise your input.";
      }
      else {
        processedText = `An error occurred: ${error.message}. Please try again.`;
      }
    } else {
      processedText = "An unknown error occurred while processing your request. Please try again later.";
    }
  }
  return processedText;
};


const EWTPage = () => {
  const router = useRouter();
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  const [activeTab, setActiveTab] = useState('paraphraser');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentStyle, setCurrentStyle] = useState(styleOptions[0].value);
  const [currentLanguage, setCurrentLanguage] = useState(languageOptions[0].value);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const tabs = [
    { id: 'paraphraser', name: 'Paraphraser', icon: Shuffle },
    { id: 'humanizer', name: 'Humanizer', icon: Smile },
    { id: 'grammar', name: 'Grammar', icon: SpellCheck },
    { id: 'ai_detect', name: 'AI Detector', icon: Brain },
    { id: 'personalized_writing', name: 'Personalized', icon: Edit3 },
  ];

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleCurrentStyleChange = (styleValue) => {
    setCurrentStyle(styleValue);
    setOutputText('');
  };

  const handleCurrentLanguageChange = (langValue) => {
    setCurrentLanguage(langValue);
    setOutputText('');
  };

  const processText = async () => {
    // Determine the current action key based on activeTab
    const actionKeyMap = {
      paraphraser: "paraphrase",
      humanizer: "humanizer",
      ai_detect: "ai_check",
      // grammar: "grammar_check" // If you plan to use this function for grammar too
    };
    const currentActionKey = actionKeyMap[activeTab];

    if (!currentActionKey && (activeTab === 'paraphraser' || activeTab === 'humanizer' || activeTab === 'ai_detect')) {
      setOutputText("Invalid action selected for processing."); // Or setError
      return;
    }

    // For tabs handled by this function (paraphraser, humanizer, ai_detect)
    if (currentActionKey) {
      if (!inputText.trim()) {
        setOutputText("Please enter some text to process.");
        return;
      }

      // ===USAGE CHECK STARTS HERE===
      const remainingCredits = await getUserActivityUsage(currentActionKey);
      if (remainingCredits <= 0) {
        toast("Free limit finished, Buy premium!", {
          description: "For $4.99 get higher usage limits", // Updated price
          action: {
            label: "Buy",
            onClick: () => triggerProButtonDialog(),
          },
        });
        setIsLoading(false); // Ensure loading state is turned off
        return; // Stop further processing
      }
      // ===USAGE CHECK ENDS HERE===
    }

    setIsLoading(true);
    setOutputText('');
    try {
      let result;
      // For ai_detect, paraphraser, humanizer, callAiModel
      if (activeTab === 'paraphraser' || activeTab === 'humanizer' || activeTab === 'ai_detect') {
        result = await callAiModel(activeTab, inputText, currentStyle, currentLanguage);
        setOutputText(result);

        // ===DECREMENT USAGE STARTS HERE===
        if (result && !result.toLowerCase().startsWith("error:")) { // Check if AI call was successful
          await decrementUserActivityUsage(currentActionKey);
        }
        // ===DECREMENT USAGE ENDS HERE===

      }
      // Note: GrammarCorrectorTab and PersonalizedWritingTab handle their own API calls
      // If you were to integrate their logic directly here, you'd add their usage checks
      // and decrements similarly.
    } catch (error) {
      console.error("Error processing text in EWTPage:", error);
      setOutputText("An error occurred while processing the text.");
    }
    setIsLoading(false);
  };

  const copyToClipboard = () => {
    if (outputText) {
      const textToCopy = outputText; // For AI detector, this copies the raw AI analysis string
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Avoid overwriting outputText if it contains valid results
        alert("Failed to copy. Check console or clipboard permissions.");
      });
    }
  };

  useEffect(() => {
    if (activeTab !== 'personalized_writing' && activeTab !== 'grammar') {
      // Consider if inputText should be cleared for ai_detect or if user expects it to persist
      // setInputText(''); // Clearing input text for ai_detect might not be ideal if user wants to re-analyze or compare
    }
    setOutputText('');
    setCopied(false);
  }, [activeTab]);


  const renderSelectors = (showStyle = true, showLanguage = true) => {
    const newButtonThemeBase = "px-3 py-[2px] text-sm rounded-md transition-colors ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50";
    const newButtonTheme = `bg-zinc-200 text-black dark:text-white dark:bg-zinc-700 dark:text-green-300 dark:hover:bg-zinc-200 dark:hover:text-zinc-800 duration-300`;
    const selectedButtonTheme = "dark:bg-green-300 bg-zinc-700 dark:text-zinc-900 dark:text-black text-white border-1 border-green-300";

    return (
      <div className='flex flex-row w-full'>
        {showStyle && (
          <div className="mb-3 flex flex-col md:flex-row items-center">
            <label className="flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 mr-4">
              <button
                onClick={() => setShowInfoModal(true)}
                className="mr-3 p-0.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                <Info size={24} />
              </button>
              {activeTab === 'paraphraser' ? 'Paraphrasing' : (activeTab === 'humanizer' ? 'Humanizing' : 'Style')}:
            </label>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleCurrentStyleChange(option.value)}
                  disabled={isLoading}
                  className={`${newButtonThemeBase}
                    ${currentStyle === option.value
                      ? `${selectedButtonTheme} ring-green-400 dark:ring-green-500 border dark:border-green-400`
                      : `${newButtonTheme} focus:ring-green-400`
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className='mx-2 flex flex-col h-full mt-2 text-sm'> Language: </label>
        {showLanguage && (
          <div className="mb-3 flex flex-col items-center md:flex-row">

            <div className="flex flex-wrap gap-2">
              {languageOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleCurrentLanguageChange(option.value)}
                  disabled={isLoading}
                  className={`${newButtonThemeBase}
                    ${currentLanguage === option.value
                      ? `${selectedButtonTheme} ring-green-400 dark:ring-green-500 border dark:border-green-400`
                      : `${newButtonTheme} focus:ring-green-400`
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'personalized_writing') {
      return <PersonalizedWritingTab genAI={genAI} />;
    }
    if (activeTab === 'grammar') {
      return (
        <div className="p-6 pt-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg rounded-tl-none rounded-tr-none  shadow-md">
          {renderSelectors(false, true)}
          <GrammarCorrectorTab genAI={genAI} currentLanguage={currentLanguage} />
        </div>
      );
    }
    // MODIFIED: Handle ai_detect by rendering AIDetectorTab
    if (activeTab === 'ai_detect') {
      return (
        <AIDetectorTab
          inputText={inputText}
          outputText={outputText}
          isLoading={isLoading}
          handleInputChange={handleInputChange}
          processText={processText} // Pass the main processText function
          copyToClipboard={copyToClipboard} // Pass the main copyToClipboard function
          copied={copied} // Pass the copied state for the button label
        // Style and language selectors are not typically used for AI detection,
        // but if callAiModel for ai_detect ever needs them, pass currentStyle and currentLanguage
        />
      );
    }

    // For Paraphraser and Humanizer
    let title = "";
    switch (activeTab) {
      case 'paraphraser':
        title = "Paraphraser";
        break;
      case 'humanizer':
        title = "Humanizer";
        break;
      default:
        // Should not happen if ai_detect is handled above
        return null;
    }

    const newButtonTheme = `bg-zinc-800 text-white dark:bg-zinc-700 dark:text-green-300 dark:hover:bg-zinc-200 dark:hover:text-zinc-800 duration-300`;

    return (
      <div className="p-5 pt-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg rounded-tl-none rounded-tr-none shadow-md">
        {renderSelectors(true, true)} {/* Show style and language for paraphraser/humanizer */}

        {/* Mobile Column Layout */}
        <div className="block md:hidden mt-4">
          <div className="flex flex-col space-y-4 min-h-[400px]">
            {/* Input Section */}
            <div className="flex flex-col">
              <textarea
                className="w-full h-48 p-3 text-sm text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-600 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 scrollbar-thin"
                placeholder="Enter your text here..."
                value={inputText}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <button
                onClick={processText}
                disabled={isLoading || !inputText.trim()}
                className={`w-full mt-2 px-4 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center transition-colors ${newButtonTheme}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  activeTab === 'paraphraser' ? 'Paraphrase Text' : 'Humanize Text'
                )}
              </button>
            </div>

            {/* Output Section */}
            <div className="flex flex-col">
              {outputText ? (
                <div className="p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 flex flex-col min-h-[200px]">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Result:</h3>
                  <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 flex-grow overflow-y-auto">{outputText}</p>
                  <button
                    onClick={copyToClipboard}
                    className={`mt-4 px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors self-start ${newButtonTheme}`}
                  >
                    {copied ? "Copied!" : "Copy to Clipboard"}
                  </button>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center h-32 p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-zinc-500 dark:text-zinc-400 ml-3">Processing your text...</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600">
                  <p className="text-zinc-500 dark:text-zinc-400">Output will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Horizontal Layout */}
        <div className="hidden md:block">
          <ResizablePanelGroup
            direction="horizontal"
            className="mt-4 rounded-lg min-h-[400px] md:min-h-[500px]"
          >
            <ResizablePanel defaultSize={70} minSize={40}>
              <div className="flex flex-col h-full">
                <textarea
                  className="w-full flex-grow p-3 text-sm text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-600 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 scrollbar-thin"
                  placeholder="Enter your text here..."
                  value={inputText}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  style={{ height: 'calc(100% - 60px)' }}
                />
                <button
                  onClick={processText}
                  disabled={isLoading || !inputText.trim()}
                  className={`w-full mt-2 px-4 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center justify-center transition-colors ${newButtonTheme}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    activeTab === 'paraphraser' ? 'Paraphrase Text' : 'Humanize Text'
                  )}
                </button>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-zinc-300 dark:bg-zinc-600 w-1 mx-2 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />

            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="flex flex-col h-full">
                {outputText ? (
                  <div className="p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 flex flex-col flex-grow" style={{ minHeight: '100px' }}>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Result:</h3>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 flex-grow overflow-y-auto">{outputText}</p>
                    <button
                      onClick={copyToClipboard}
                      className={`mt-4 px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors self-start ${newButtonTheme}`}
                    >
                      {copied ? "Copied!" : "Copy to Clipboard"}
                    </button>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-full p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600">
                    <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-zinc-500 dark:text-zinc-400 ml-3">Processing your text...</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full p-4 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600">
                    <p className="text-zinc-500 dark:text-zinc-400">Output will appear here.</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-200 p-4 md:p-6 selection:bg-blue-500 selection:text-white">
      <header className="flex mb-3">
        {/* Header content can go here if any */}
      </header>

      <div className="max-w-full mx-auto">
        <div className="grid md:grid-cols-5 grid-cols-2 gap-2 dark:bg-zinc-900/60 bg-gray-100 p-1.5 rounded-lg mb- rounded-bl-none rounded-br-none flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex items-center justify-center space-x-1.5 px-2 md:px-3 py-2 text-xs md:text-sm rounded-md font-medium cursor-pointer duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 hover:scale-[1.05] transform hover:shadow-md hover:shadow-green-300/50 hover:-translate-y-0.5
                  ${isActive
                    ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-green-300"
                    : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700/70 hover:text-gray-700 dark:hover:text-zinc-200 "
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {Icon && <Icon size={16} className="flex-shrink-0" />}
                <span className="truncate">{tab.name}</span>
              </button>
            );
          })}
        </div>

        {renderTabContent()}

        {showInfoModal && (activeTab === 'paraphraser' || activeTab === 'humanizer') && ( // Only show modal for relevant tabs
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 sm:p-6">
            <div className="relative w-full max-w-md mx-auto bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 md:p-8 overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-3 right-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-full"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                About {activeTab === 'paraphraser' ? 'Paraphrasing' : 'Humanizing'} Style
              </h3>
              {activeTab === 'paraphraser' ? (
                <div className="text-zinc-700 dark:text-zinc-300 space-y-4 text-sm">
                  <p>The Paraphraser allows you to rewrite existing text while preserving the original meaning. This is useful for avoiding plagiarism, simplifying complex language, or varying sentence structure.</p>
                  <p>Use the style options to control the tone and formality of the rewritten text. Choose "Formal" for academic papers, "Casual" for informal communication, or "Gen Z" for a more modern, internet-style voice.</p>
                  <p>Select the desired language to ensure the output adheres to specific regional linguistic conventions (e.g., US vs. British English).</p>
                </div>
              ) : ( // Humanizer
                <div className="text-zinc-700 dark:text-zinc-300 space-y-4 text-sm">
                  <p>The Humanizer makes AI-generated or stiff text sound natural and human-written. It uses simple words, short sentences, and everyday language that anyone can understand.</p>
                  <p>It replaces difficult words with common synonyms and keeps sentences under 10 words when possible. No filler words or unnecessary phrases are added.</p>
                  <p>The style setting controls the tone (formal, casual, etc.) while keeping the language simple and clear. The result sounds natural without being overly conversational.</p>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EWTPage;