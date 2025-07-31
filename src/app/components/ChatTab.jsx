"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAtomValue } from "jotai";

import { SendHorizontal, Bot, User, Info, MessageSquareWarning, Clock, AlertCircle } from 'lucide-react'; // Added AlertCircle
import TimeAgo from 'react-timeago';
import { releaseSlot, waitForSlot } from '../lib/redisClient'
import { NOVITA_BASE_URL } from './urls'
import RichMarkdown from './RichMarkdown'
import { useRouter } from 'next/navigation';        // Or 'next/router'
import { toast } from "sonner";                       // Or your preferred toast library
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';
const OpenAI = require("openai");

import { supabase } from "../lib/supabaseClient"; // Adjust path
import {
    file_contents_supabase,
    file_id_supabase,
    user_id_supabase
} from "../../store/uploadAtoms"; // Adjust path as needed
import LoadingSpinner from "./LoadingSpinner"; // Adjust path as needed

// Configuration (Consider moving API keys/base URLs to environment variables)
import { GiTeacher } from "react-icons/gi";
const MAX_CONTEXT_LENGTH = 100000;
const MAX_HISTORY_FOR_PROMPT = 5; // Max chat turns (user + assistant)
const baseURL = NOVITA_BASE_URL; // Your Novita Proxy/Endpoint
const apiKey = "AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk"; // Your Novita API Key
const model = "gemini-2.0-flash"; // Novita model identifier

// Initialize OpenAI client for Novita API
let openai = null;
if (apiKey && baseURL) {
    openai = new OpenAI({
        baseURL: baseURL,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // Acknowledge security implications
    });
} else {
    console.warn("ChatTab: Novita API Key or Base URL is missing. Chat functionality disabled.");
}

// Helper to truncate text
const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length <= maxLength ? text : text.substring(0, maxLength) + "... (truncated)";
};

export default function ChatTab() {
    // --- State ---
    const userUuid = useAtomValue(user_id_supabase);
    const router = useRouter();
    const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
    const [chatHistory, setChatHistory] = useState([]); // { id?, created_at?, role, content, status? }
    const [userInput, setUserInput] = useState("");
    const [isLoadingChat, setIsLoadingChat] = useState(false); // Loading AI response
    const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Loading past messages
    const [chatError, setChatError] = useState(null); // General chat error
    const chatContainerRef = useRef(null);

    // --- Jotai Atoms ---
    const fid = useAtomValue(file_id_supabase);
    const fileContent = useAtomValue(file_contents_supabase);

    // --- Derived Data ---
    const rawText = fileContent?.[0]?.raw_text || "";
    const dbAiNotes = fileContent?.[0]?.ai_notes || "";
    const dbUserNotes = fileContent?.[0]?.notes || "";

    // --- Fetch Past Chat History ---
    const fetchChatHistory = useCallback(async (currentFid) => {
        if (!currentFid) {
            setChatHistory([]);
            return;
        }
        console.log("ChatTab: Fetching history for fid:", currentFid);
        setIsLoadingHistory(true);
        setChatError(null);
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('id, created_at, role, content')
                .eq('file_id', currentFid)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const formattedHistory = data?.map(msg => ({ ...msg, status: 'saved' })) || [];
            setChatHistory(formattedHistory);
            console.log(`ChatTab: Fetched ${formattedHistory.length} messages.`);

        } catch (error) {
            console.error("ChatTab: Error fetching chat history:", error);
            setChatError(`Failed to load chat history: ${error.message}`);
            setChatHistory([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    // --- Effect to fetch history when file changes ---
    useEffect(() => {
        setChatHistory([]);
        setUserInput("");
        setChatError(null);
        setIsLoadingChat(false);
        if (fid) {
            fetchChatHistory(fid);
        }
    }, [fid, fetchChatHistory]); // fetchChatHistory added as dependency

    // --- Effect to scroll chat to bottom ---
    useEffect(() => {
        if (chatContainerRef.current) {
            setTimeout(() => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [chatHistory, isLoadingChat, chatError]);

    // --- Prepare Context for LLM ---
    const prepareLlmContext = useCallback(() => {
        let context = "";
        if (dbAiNotes) context += "### AI Generated Notes Summary:\n" + dbAiNotes + "\n\n";
        if (dbUserNotes) context += "### User Notes:\n" + dbUserNotes + "\n\n";
        if (rawText) {
            const remainingLength = MAX_CONTEXT_LENGTH - context.length - 200; // Reserve space for prompt/history
            if (remainingLength > 100) {
                context += "### Document Raw Text (Excerpt):\n" + truncateText(rawText, remainingLength) + "\n\n";
            }
        }
        // Ensure final context doesn't exceed overall limit (though individual parts are truncated)
        return truncateText(context, MAX_CONTEXT_LENGTH);
    }, [dbAiNotes, dbUserNotes, rawText]);

    // --- Save single message to DB (Helper) ---
    const saveMessageToDb = async (message) => {
        if (!fid) {
            console.warn("ChatTab: Cannot save message, missing file ID (fid).");
            return null;
        }
        try {
            console.log("ChatTab: Saving message:", { role: message.role });
            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    file_id: fid,
                    role: message.role,
                    content: message.content
                })
                .select('id, created_at')
                .single();

            if (error) throw error;

            console.log("ChatTab: Message saved successfully, id:", data?.id);
            return data; // Return { id, created_at }

        } catch (error) {
            console.error(`ChatTab: Failed to save ${message.role} message:`, error);
            return null; // Indicate failure
        }
    };


    // --- Send Message Handler (with Usage Check) ---
    const handleSendMessage = useCallback(async () => {
        // --- 1. Initial Checks ---
        if (!userInput.trim() || isLoadingChat || !fid || !openai) {
            if (!openai) setChatError("Chat client not initialized. Check configuration.");
            if (!fid) setChatError("No document selected.");
            return;
        }

        const currentInput = userInput.trim();

        // === USAGE CHECK AND DECREMENT STARTS HERE ===
        if (userUuid) { // Only proceed if userUuid is available
            setChatError(null); // Clear previous errors before new request
            setIsLoadingChat(true); // Set loading early for feedback

            const remainingCredits = await getUserActivityUsage('chat_request');
            if (remainingCredits <= 0) {
                toast("Free limit for Chat requests finished, Buy premium!", {
                    description: "For $4.99 get higher usage limits",
                    action: {
                        label: "Buy",
                        onClick: () => triggerProButtonDialog(),
                    },
                });
                setChatError("Your chat request limit has been reached.");
                setIsLoadingChat(false);
                return; // Stop processing
            }
            console.log(`ChatTab: User has ${remainingCredits} chat credits.`);

            // Attempt to decrement usage *before* making the AI call
            const decrementSuccess = await decrementUserActivityUsage('chat_request');
            if (!decrementSuccess) {
                // This case might occur if there was an issue decrementing (e.g., DB error in the hook)
                // or if the count was already zero (though getUserActivityUsage should catch that).
                // You might want to handle this more specifically if needed.
                console.error("ChatTab: Failed to decrement chat usage count. Aborting AI call.");
                setChatError("Could not update usage count. Please try again.");
                setIsLoadingChat(false);
                return;
            }
            console.log(`ChatTab: Chat usage count decremented successfully for user ${userUuid}.`);

        } else {
            // Handle case where userUuid is not available, if necessary
            // For example, allow generation or show a different message
            console.warn("ChatTab: User ID not available, skipping usage check and decrement for now.");
            // If you want to allow chats without login/usage tracking, remove the return below.
            // Otherwise, you might set an error or disable the chat.
            // For now, proceeding without usage tracking if no userUuid
            setIsLoadingChat(true);
            setChatError(null);
        }
        // === USAGE CHECK AND DECREMENT ENDS HERE ===

        const tempUserMessageId = `temp_user_${Date.now()}`;
        const userMessage = {
            id: tempUserMessageId,
            role: 'user',
            content: currentInput,
            created_at: new Date().toISOString(),
            status: 'sending'
        };

        setChatHistory((prev) => [...prev, userMessage]);
        setUserInput("");
        // setIsLoadingChat(true); // Moved up
        // setChatError(null); // Moved up

        saveMessageToDb(userMessage).then(dbResult => {
            setChatHistory(prev => prev.map(msg =>
                msg.id === tempUserMessageId
                    ? { ...msg, status: dbResult ? 'saved' : 'failed', id: dbResult?.id ?? msg.id, created_at: dbResult?.created_at ?? msg.created_at }
                    : msg
            ));
        });

        const tempAiMessageId = `temp_ai_${Date.now()}`;
        let aiResponseContent = "";
        const aiMessagePlaceholder = {
            id: tempAiMessageId,
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
            status: 'streaming'
        };
        setChatHistory((prev) => [...prev, aiMessagePlaceholder]);

        try {
            const context = prepareLlmContext();
            const systemPrompt = `You are John, an intelligent AI assistant focused on providing precise, accurate, and concise answers. Your role is to help users understand the content of their uploaded documents.

Key guidelines:
- Always base your responses strictly on the provided context (summaries, notes, excerpts)
- Provide precise, factual answers without unnecessary elaboration
- If information is not available in the context, clearly state this limitation
- Maintain a helpful but professional tone
- Keep responses focused and to the point
- Use clear, structured explanations when complex topics arise

Context:\n\n${context}\n---\n`;

            const recentHistoryForApi = chatHistory
                .filter(msg => msg.status !== 'failed' && msg.id !== tempUserMessageId && msg.id !== tempAiMessageId) // Exclude current optimistic messages too
                .slice(-MAX_HISTORY_FOR_PROMPT)
                .map(({ role, content }) => ({ role, content }));

            const messagesForApi = [
                { role: "system", content: systemPrompt },
                ...recentHistoryForApi,
                { role: 'user', content: currentInput }, // This is the actual user message for this turn
            ];

            console.log("ChatTab: Sending to Llama (for streaming):", messagesForApi.length, "messages");
            await waitForSlot();

            const chatCompletion = await openai.chat.completions.create({
                model: model, // Ensure 'model' is defined in your component scope
                messages: messagesForApi,
                stream: true,
                temperature: 0.5
            });

            for await (const chunk of chatCompletion) {
                const chunkContent = chunk.choices[0]?.delta?.content || "";
                aiResponseContent += chunkContent;
                setChatHistory(prev => prev.map(msg =>
                    msg.id === tempAiMessageId
                        ? { ...msg, content: aiResponseContent }
                        : msg
                ));
            }

            if (!aiResponseContent.trim()) {
                throw new Error("AI returned an empty response.");
            }

            setChatHistory(prev => prev.map(msg =>
                msg.id === tempAiMessageId
                    ? { ...msg, status: 'saved' } // Finalize status
                    : msg
            ));

            saveMessageToDb({
                // id: tempAiMessageId, // The DB will generate its own ID on insert
                role: 'assistant',
                content: aiResponseContent,
                // created_at: new Date().toISOString(), // DB will timestamp
            }).then(dbResult => {
                setChatHistory(prev => prev.map(msg =>
                    msg.id === tempAiMessageId // Match by the temporary ID
                        ? { ...msg, id: dbResult?.id ?? tempAiMessageId, created_at: dbResult?.created_at ?? msg.created_at, status: dbResult ? 'saved' : 'failed' }
                        : msg
                ));
            });

        } catch (error) {
            console.error("ChatTab: Error during chat completion:", error);
            let friendlyError = `Failed to get response: ${error.message}. Please try again.`;
            // ... (your existing error handling for different statuses)
            setChatError(friendlyError);
            setChatHistory(prev => prev.map(msg =>
                (msg.id === tempUserMessageId || msg.id === tempAiMessageId) ? { ...msg, status: 'failed' } : msg
            ));
        } finally {
            setIsLoadingChat(false);
            await releaseSlot();
        }
    }, [userInput, isLoadingChat, fid, openai, chatHistory, prepareLlmContext, saveMessageToDb, userUuid, decrementUserActivityUsage, getUserActivityUsage, router, setChatError, setIsLoadingChat, setChatHistory, setUserInput]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // --- Render Logic ---
    const canChat = fid && openai && fileContent;
    const showWelcomeMessage = canChat && chatHistory.length === 0 && !isLoadingHistory && !isLoadingChat && !chatError;
    const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark'); // Check dark mode for syntax highlighter

    return (
        <div className="flex flex-col w-full h-full bg-gray-50 dark:bg-zinc-900 p-4 overflow-hidden"> {/* Darker bg */}
            <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-zinc-100 border-b dark:border-zinc-700 pb-2 flex-shrink-0">
                Chat with John
            </h2>

            {/* Chat Messages Area */}
            <div
                ref={chatContainerRef}
                className="flex-grow flex flex-col w-full overflow-y-auto mb-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-100 dark:scrollbar-track-zinc-800" // Adjusted track color
                aria-live="polite"
            >
                {/* Loading Past History Indicator */}
                {isLoadingHistory && (
                    <div className="flex items-center justify-center py-6 text-gray-500 dark:text-gray-400">
                        <LoadingSpinner message="Loading chat history..." />
                    </div>
                )}

                {/* Initial State Messages */}
                {!fid && !isLoadingHistory && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-4">
                            <Info size={24} className="text-slate-600 dark:text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No document selected</h3>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Upload or select a document to start a conversation with John about its content.</p>
                    </div>
                )}
                {!openai && fid && !isLoadingHistory && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-red-500 dark:text-red-400 px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-900/40 flex items-center justify-center mb-4">
                            <MessageSquareWarning size={24} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-medium text-red-700 dark:text-red-300 mb-2">Configuration Error</h3>
                        <p className="text-red-600 dark:text-red-400 leading-relaxed">Chat functionality is not properly configured. Please check your API settings.</p>
                    </div>
                )}
                {showWelcomeMessage && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 text-slate-700 dark:text-slate-200 shadow-sm max-w-[85%] self-start mr-auto text-sm border border-slate-200 dark:border-zinc-700">
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">J</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-slate-800 dark:text-slate-100 mb-1">John</p>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Hello! I'm here to help you understand your document. Ask me anything specific about the content, and I'll provide precise answers based on what's available.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rendered Chat History */}
                {chatHistory.map((msg) => (
                    <div key={msg.id || `temp-${msg.role}-${msg.created_at}`} className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-start max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}>
                            {/* Icon Column */}
                            <div className={`flex-shrink-0 mx-2 mt-1 ${msg.role === 'user' ? 'ml-2' : 'mr-2'}`}>
                                {msg.role === 'assistant' ? (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">J</span>
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center">
                                        <User size={14} className="text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div
                                className={`relative group p-4 rounded-xl shadow-sm min-w-[60px] ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700' // User bubble style
                                    : 'bg-gradient-to-br from-white to-slate-50 dark:from-zinc-800 dark:to-zinc-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-zinc-700'
                                    }`}
                            >
                                {/* Message Content */}
                                {msg.role === 'assistant' ? (
                                    < RichMarkdown mark={msg.content} />
                                ) : (
                                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                                )}

                                {/* Timestamp and Status */}
                                <div className={`text-xs mt-2 text-right ${msg.role === 'user' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {msg.status === 'failed' && <AlertCircle size={12} className="inline mr-1 text-red-500" title="Failed to send/save" />}
                                    {msg.status === 'sending' && <Clock size={12} className="inline mr-1 animate-spin-slow" title="Sending/Saving..." />}
                                    {msg.status === 'streaming' && <Clock size={12} className="inline mr-1 animate-pulse" title="Streaming response..." />}
                                    {msg.created_at && typeof msg.created_at === 'string' && (
                                        <TimeAgo date={msg.created_at} title={new Date(msg.created_at).toLocaleString()} />
                                    )}
                                    {/* Fallback for non-string date (e.g., temp date object) */}
                                    {msg.created_at && typeof msg.created_at !== 'string' && !isNaN(new Date(msg.created_at).getTime()) && (
                                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}


                {/* Loading indicator for AI response */}
                {isLoadingChat && (
                    <div className="flex justify-start">
                        <div className="flex items-start max-w-[85%] mr-auto">
                            <div className="flex-shrink-0 mx-2 mt-1 mr-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">J</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-zinc-800 dark:to-zinc-900 shadow-sm inline-flex items-center border border-slate-200 dark:border-zinc-700">
                                <LoadingSpinner message="Analyzing..." textClassName="text-sm ml-2 text-slate-600 dark:text-slate-300" />
                            </div>
                        </div>
                    </div>
                )}

                {/* General Chat Error Display */}
                {chatError && !isLoadingChat && (
                    <div className="flex justify-center my-2">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 max-w-[90%] text-center text-sm">
                            <div className="flex items-center justify-center space-x-2">
                                <AlertCircle size={16} className="text-red-500" />
                                <span className="font-medium">Unable to process request</span>
                            </div>
                            <p className="mt-1 text-red-600 dark:text-red-400">{chatError}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className={`mt-auto flex items-end space-x-3 pt-4 border-t border-slate-200 dark:border-zinc-700 flex-shrink-0 ${!canChat ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex-grow relative">
                    <textarea
                        rows={1}
                        className="w-full p-3 border border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-slate-100 bg-white dark:bg-zinc-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-500 dark:focus:ring-slate-400 focus:border-transparent dark:focus:border-transparent overflow-y-auto max-h-36 scrollbar-thin text-sm placeholder-slate-500 dark:placeholder-slate-400 transition-all duration-200"
                        placeholder={canChat ? "Ask John about your document..." : "Select a document to begin..."}
                        value={userInput}
                        onChange={(e) => {
                            setUserInput(e.target.value);
                            // Auto-resize textarea height
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`; // 144px = max-h-36 approx
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={isLoadingChat || isLoadingHistory || !canChat}
                        aria-label="Chat input"
                        style={{ height: 'auto' }} // Initial auto height
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-slate-400 dark:text-slate-500">
                        Enter to send
                    </div>
                </div>
                <button
                    onClick={handleSendMessage}
                    className="p-3 bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 hover:from-slate-700 hover:to-slate-800 dark:hover:from-slate-600 dark:hover:to-slate-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed self-end transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 shadow-sm"
                    disabled={isLoadingChat || isLoadingHistory || !userInput.trim() || !canChat}
                    aria-label="Send chat message"
                    title="Send Message (Enter)"
                >
                    <SendHorizontal size={18} />
                </button>
            </div>
        </div>
    );
}