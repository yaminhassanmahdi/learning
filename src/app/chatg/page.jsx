'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { atom, useAtom, Provider, useAtomValue, useSetAtom } from 'jotai';
import { Paperclip, ArrowUp, X, Loader2, Plus, Globe, Mic, StopCircle, ArrowUpIcon, EditIcon, PencilIcon, TrashIcon, CheckIcon, XIcon, PanelLeftOpen, PanelLeftClose, } from 'lucide-react';
import ChatMarkdownRenderer from '../components/ChatMarkdownRenderer'
import { atomWithStorage } from "jotai/utils";
import Image from 'next/image';
import { AuroraText } from "@/components/magicui/aurora-text";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { useUserActivityAPI } from '../lib/getUsage';
import { triggerProButtonDialog } from '@/lib/utils';
import {
  flashCardsState,
  chats_supabase_state,
  user_id_supabase,
  chat_id_supabase,
  activeChat,
  file_id_supabase,
  quizQuestions,
  summaryState,
  file_url_supabase,
  file_contents_supabase,
  userEmail_state,
  sideBar_state,
  reading_State,
  writing_chat_id_supabase,
  activeWritingChat,
  centralTab,
  create_ChatGlow, // Kept in case used elsewhere, but glow effect removed from input
} from "../../store/uploadAtoms";
import { Menu, MessageSquare, Settings, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThumbsUp, ThumbsDown, Copy, RefreshCw } from 'lucide-react'; // Import new icons
import { v4 as uuidv4 } from 'uuid';
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

// --- 0. CONSTANTS & CONFIGURATION ---
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || 'AIzaSyC-Tw-ccOtZ0y0TAjdAzIJ6N2b8TnbAOzk'; // Replace with your actual key
const SUPABASE_BUCKET_NAME = 'file-uploads';
import { supabase } from "../lib/supabaseClient"; // Adjust path if needed
let genAI;
if (GOOGLE_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
} else {
  console.error("Google API Key is not configured or is using the placeholder. AI features might not work properly.");
  // Mock genAI if needed to prevent errors, or handle disabled state in UI
  genAI = null;
}


// --- JOTAI ATOMS ---
const chatSessionsAtom = atom([]); // Stores { id, title, updated_at, user_id }
const currentChatIdAtom = atom(null); // String: ID of the active chat, or null
const messagesAtom = atom([]); // Stores messages for the currentChatId
const isLoadingAtom = atom(false); // For AI response loading
const isChatPanelLoadingAtom = atom(false); // For loading messages of a selected chat

// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return 'Invalid date';
  }
};

const truncateText = (text, length = 30) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};


function Sidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(sidebarOpenAtom);
  const [sessions, setSessions] = useAtom(chatSessionsAtom);
  const [currentChatId, setCurrentChatId] = useAtom(gemini_chat_id);
  const [, setMessages] = useAtom(messagesAtom);
  const [, setIsChatPanelLoading] = useAtom(isChatPanelLoadingAtom);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const USER_ID = useAtomValue(user_id_supabase);

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const fetchChatSessions = useCallback(async () => {
    if (!supabase || !USER_ID) {
      setSessions([]); // Clear sessions if no user or supabase
      setIsSidebarLoading(false);
      return;
    }
    setIsSidebarLoading(true);
    const { data, error } = await supabase
      .from('gem_chats') // Using 'gem_chats' as per original code
      .select('id, title, updated_at, user_id')
      .eq('user_id', USER_ID)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat sessions:', error);
      setSessions([]);
    } else {
      setSessions(data || []);
    }
    setIsSidebarLoading(false);
  }, [setSessions, USER_ID]); // Added USER_ID dependency

  useEffect(() => {
    if (USER_ID) { // Fetch sessions only if USER_ID is available
      fetchChatSessions();
    } else {
      setSessions([]); // Clear sessions if no user ID
      setIsSidebarLoading(false);
    }
  }, [fetchChatSessions, USER_ID]); // Added USER_ID dependency

  const handleCreateNewChat = () => {
    const newChatId = uuidv4();
    setCurrentChatId(newChatId);
    setMessages([]);
    setIsChatPanelLoading(false);
    setEditingSessionId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) { // Add window check
      setIsSidebarOpen(false);
    }
  };

  const handleSelectChat = async (chatId) => {
    if (editingSessionId === chatId || currentChatId === chatId) return;

    setEditingSessionId(null);
    setCurrentChatId(chatId);
    setIsChatPanelLoading(true);
    setMessages([]);

    if (!supabase) {
      setIsChatPanelLoading(false);
      return;
    }

    const { data: msgs, error: msgsError } = await supabase
      .from('gem_chat_messages')
      .select('*, gem_chat_attachments(*)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (msgsError) {
      console.error('Error fetching messages for chat:', chatId, msgsError);
      setMessages([]);
    } else {
      setMessages(msgs || []);
    }
    setIsChatPanelLoading(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) { // Add window check
      setIsSidebarOpen(false);
    }
  };

  const handleStartEdit = (session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '');
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async () => {
    if (!editingSessionId || !editingTitle.trim()) {
      handleCancelEdit();
      return;
    }
    if (!supabase) return;

    const originalSession = sessions.find(s => s.id === editingSessionId);
    if (originalSession?.title === editingTitle.trim()) {
      handleCancelEdit();
      return;
    }

    const newUpdatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('gem_chats')
      .update({ title: editingTitle.trim(), updated_at: newUpdatedAt })
      .eq('id', editingSessionId);

    if (error) {
      console.error('Error updating chat title:', error);
      alert(`Failed to update chat title: ${error.message}`);
    } else {
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === editingSessionId ? { ...s, title: editingTitle.trim(), updated_at: newUpdatedAt } : s
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    }
    handleCancelEdit();
  };

  const handleTitleInputChange = (e) => {
    setEditingTitle(e.target.value);
  };

  const handleTitleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleDeleteChat = async (sessionIdToDelete, sessionTitle) => {
    if (!supabase) return;

    if (typeof window !== 'undefined' && window.confirm(`Are you sure you want to delete the chat "${sessionTitle || 'Untitled Chat'}"? This action cannot be undone.`)) { // Add window check
      if (editingSessionId === sessionIdToDelete) {
        handleCancelEdit();
      }

      const { error } = await supabase
        .from('gem_chats')
        .delete()
        .eq('id', sessionIdToDelete);

      if (error) {
        console.error('Error deleting chat session:', error);
        alert(`Failed to delete chat: ${error.message}`);
      } else {
        setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionIdToDelete));
        if (currentChatId === sessionIdToDelete) {
          setCurrentChatId(null);
          setMessages([]);
        }
        // alert(`Chat "${sessionTitle || 'Untitled Chat'}" deleted successfully.`); // Optional: consider a less intrusive notification
      }
    }
  };

  useEffect(() => {
    // Only assign to window if window is defined
    if (typeof window !== 'undefined') {
      window.refreshChatSessions = fetchChatSessions;
      return () => { delete window.refreshChatSessions; };
    }
  }, [fetchChatSessions]);

  const groupedSessions = useMemo(() => {
    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    if (!sessions || sessions.length === 0) return [];

    const now = new Date();
    const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    sessions.forEach(session => {
      if (!session.updated_at) { // Handle cases where updated_at might be null
        groups.older.push(session);
        return;
      }
      const sessionDate = new Date(session.updated_at);
      const sessionUtcStart = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()));

      if (sessionUtcStart.getTime() === todayUtcStart.getTime()) {
        groups.today.push(session);
      } else {
        const yesterdayUtcStart = new Date(todayUtcStart);
        yesterdayUtcStart.setUTCDate(todayUtcStart.getUTCDate() - 1);

        if (sessionUtcStart.getTime() === yesterdayUtcStart.getTime()) {
          groups.yesterday.push(session);
        } else {
          const last7DaysBoundaryUtcStart = new Date(todayUtcStart);
          // This boundary means items from 6 days ago up to today.
          // Since "today" and "yesterday" are handled, this will effectively be 2-6 days ago.
          last7DaysBoundaryUtcStart.setUTCDate(todayUtcStart.getUTCDate() - 6);

          if (sessionUtcStart.getTime() >= last7DaysBoundaryUtcStart.getTime()) {
            groups.last7Days.push(session);
          } else {
            groups.older.push(session);
          }
        }
      }
    });

    return [
      { title: "Today", chats: groups.today },
      { title: "Yesterday", chats: groups.yesterday },
      { title: "Last 7 days", chats: groups.last7Days },
      { title: "Older", chats: groups.older },
    ].filter(category => category.chats.length > 0);

  }, [sessions]);


  return (
    <div className={`fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out w-[17rem]
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col h-full shadow-lg`}>

      {isSidebarOpen && (
        <div className="p-1 mt- border-b border-zinc-300 dark:border-zinc-700">
          <div className='flex flex-row my-3 w-[77%] items-center justify-between gap- bg-amber-0 mb-5 ml-3 mr-auto'> {/* Added mx-auto for centering */}
            <Image src="/panacia_d.png" priority className="ml- hidden dark:block" width={70 - 40} height={65 - 40} alt="Dark Mode Logo" />
            <Image src="/panacia_l.png" priority className="ml- block dark:hidden" width={70 - 40} height={65 - 40} alt="Light Mode Logo" />
            <div>
              <AuroraText colors={["#FF0080", "#7928CA", "#0070F3", "#38bdf8"]} speed={2} className='text-[2rem]'>Learningly</AuroraText>

            </div>
          </div>

          <button
            onClick={handleCreateNewChat}
            className="w-full py-2 px-3 mx-auto rounded-lg transition ease-in-out focus:outline-none focus:ring-2 
            dark:hover:bg-zinc-700 dark:text-zinc-200 duration-200 text-zinc-900 bg-zinc-00 dark:hover:text-zinc-200 hover:bg-zinc-300 hover:text-zinc-900 flex flex-row items-center justify-center mb- -mt-3" // Added mb-2
          >
            <EditIcon size={19} className='mr-2' /> New Chat
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isSidebarLoading ? (
          <div className="p-4 text-center text-slate-400">Loading chats...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No chats yet.</div>
        ) : groupedSessions.length === 0 && sessions.length > 0 ? ( // Should ideally not be hit if "Older" catches all
          <div className="p-4 text-center text-slate-400">No chats to display in categories.</div>
        ) : (
          <div className="p-2"> {/* Padding for the entire list of groups */}
            {groupedSessions.map(category => (
              <div key={category.title} className="mb-3"> {/* Margin between category groups */}
                <h3 className="px-1 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 bg-zinc-100 dark:bg-zinc-900 z-10">
                  {category.title}
                </h3>
                <ul className="space-y-1 mt-1">
                  {category.chats.map((session) => (
                    <li key={session.id}
                      className={`group relative rounded-md flex items-center justify-between 
                        ${editingSessionId === session.id ? 'dark:bg-slate-600 bg-slate-300' : // Added bg-slate-300 for light mode editing
                          currentChatId === session.id ? 'dark:bg-zinc-800 bg-zinc-300 dark:text-white text-zinc-900' : // Ensure text color contrast for light active
                            'hover:bg-zinc-200 dark:hover:bg-zinc-800 dark:text-zinc-300 text-zinc-700 dark:hover:text-zinc-100' // Adjusted hover colors
                        }`}
                    >
                      {editingSessionId === session.id ? (
                        <div className="flex-grow p-2 flex items-center">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={handleTitleInputChange}
                            onKeyDown={handleTitleInputKeyDown}
                            onBlur={() => setTimeout(handleSaveEdit, 100)} // Delay to allow click on save/cancel
                            className="flex-grow dark:bg-slate-500 bg-slate-100 text-zinc-900 dark:text-white text-sm p-1.5 rounded-l-md focus:ring-1 focus:ring-indigo-400 outline-none"
                            autoFocus
                          />
                          <button onClick={handleSaveEdit} className="p-1.5 text-green-500 hover:text-green-400 dark:bg-slate-500 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-400"><CheckIcon size={16} /></button>
                          <button onClick={handleCancelEdit} className="p-1.5 text-red-500 hover:text-red-400 dark:bg-slate-500 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-400 rounded-r-md"><XIcon size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSelectChat(session.id)}
                            className={`w-full text-left px-3 py-2.5 text-sm truncate 
                              ${currentChatId === session.id ? 'font-semibold' : 'font-normal'}
                            `}
                            title={session.title || "Untitled Chat"}
                          >
                            {truncateText(session.title || "Untitled Chat", 25)}
                          </button>
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 
                                         bg-zinc-200/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-l p-0.5"> {/* Adjusted background for better visibility */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(session); }}
                              className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none"
                              title="Edit chat name"
                            >
                              <PencilIcon size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteChat(session.id, session.title); }}
                              className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 focus:outline-none"
                              title="Delete chat"
                            >
                              <TrashIcon size={16} /> {/* Ensure consistent icon sizing */}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
const gemini_chat_id = atom('geminiChatid'); // Default to open

// --- CHAT PANEL COMPONENT (adapted from GemCloneChat) ---
const TimeBasedGreeting = ({ }) => {
  const getGreeting = (hour) => {
    if (hour >= 5 && hour < 12) {
      return "Good morning";
    } else if (hour >= 12 && hour < 17) {
      return "Good afternoon";
    } else if (hour >= 17 && hour < 21) {
      return "Good evening";
    } else if (hour >= 21 && hour < 24) {
      return "Late evening";
    } else { // Covers 00:00 to 04:59
      return "Hello, night owl!";
    }
  };
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const USER_ID = useAtomValue(user_id_supabase);

  useEffect(() => {
    // Only run this effect on the client side
    if (typeof window !== 'undefined') {
      // Update time every minute to refresh greeting if hour changes
      const timerId = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000); // 60000ms = 1 minute

      // Clear interval on component unmount
      return () => clearInterval(timerId);
    }
  }, []);

  useEffect(() => {
    const currentHour = currentTime.getHours();
    setGreeting(getGreeting(currentHour));
  }, [currentTime]); // Re-calculate greeting when currentTime changes
  const getUsername = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('id', USER_ID)
      .single();
    return data?.name;
  };
  const [namee, setName] = useState(null)

  useEffect(() => {
    async function fetchName() {
      const username = await getUsername()
      setName(username)
    }
    if (USER_ID) fetchName()
  }, [USER_ID])

  const [activeTab, setActiveTab] = useAtom(centralTab);
  return (
    <div className={`p-6 rounded-lg bg-transparent transition-colors duration-300 ease-in-out`}>
      {/* <h1 className={`text-8xl font-  text-center dark:text-zinc-200 text-zinc-500`}>
        {greeting}!
      </h1> */}
      <p className={`text-3xl  dark:text-zinc-200 text-zinc-900 text-center mt-4`}>
        How can I help you, {namee}?
      </p>
      <button onClick={() => setActiveTab('sci_chat')} className='block max-w-80 italic mx-auto mt-4 text-center p-4 rounded-lg border dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700  bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:text-white transition-colors duration-200 text-sm cursor-pointer'>
        <p>Solve your HW in concise, check out <span className='text-green-300'>solver</span></p>

      </button>

    </div>
  );
};
function ChatPanel() {
  const router = useRouter();
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  const USER_ID = useAtomValue(user_id_supabase);
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(sidebarOpenAtom);
  const [searchActive, setSearchActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const initialUserInputRef = useRef("");

  const toggleSearch = () => {
    console.log('searh state --->', searchActive)
    setSearchActive(prev => !prev);
  };
  const getUsername = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('id', USER_ID)
      .single();
    return data?.name;
  };
  const [namee, setName] = useState(null)

  useEffect(() => {
    async function fetchName() {
      const username = await getUsername()
      setName(username)
    }
    if (USER_ID) fetchName()
  }, [USER_ID])
  const [currentChatId, setCurrentChatId] = useAtom(gemini_chat_id);
  // const [currentChatId, setCurrentChatId] = useState('');
  const [messages, setMessages] = useAtom(messagesAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom); // AI loading
  const [isChatPanelLoading, setIsChatPanelLoading] = useAtom(isChatPanelLoadingAtom); // Message loading
  const clickableElementRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') { // Only run this on the client side
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        console.warn("Speech recognition not supported by this browser.");
        return;
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let currentFullTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentFullTranscript += event.results[i][0].transcript;
        }
        setUserInput(initialUserInputRef.current + currentFullTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        let errorMessage = "An error occurred during speech recognition.";
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMessage = "Microphone access denied. Please allow microphone access in your browser settings and try again.";
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech was detected. Please try again.";
        } else if (event.error === 'audio-capture') {
          errorMessage = "Microphone not found or not working. Please check your microphone.";
        }
        alert(errorMessage);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;

      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
        }
      };
    }
  }, []);

  useEffect(() => {
    // This effect also accesses window.innerWidth, so it needs a check
    if (typeof window !== 'undefined') {
      const element = clickableElementRef.current;
      const handleClickOutside = (event) => {
        const menuButton = document.querySelector('.menu-button');
        if (isSidebarOpen && !element.contains(event.target) && (!menuButton || !menuButton.contains(event.target))) {
          setIsSidebarOpen(false);
        }
      };
      // Add event listener here if `clickableElementRef` is the document or a broadly accessible element
      // For now, removing the listener setup since clickableElementRef might not be the correct element to attach it to.
      // If you intend to use it, ensure it's attached to a parent element of the chat panel,
      // and that the listener is added/removed in the useEffect and not executed on the server.
    }
  }, [isSidebarOpen, setIsSidebarOpen]);


  const [counter, setCounter] = useState(0)


  const handleVoiceInputClick = () => {
    if (typeof window === 'undefined' || !recognitionRef.current) { // Add window check
      alert("Voice recognition is not supported by your browser or has failed to initialize.");
      return;
    }
    if (isLoading) return;

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      let currentInput = userInput;
      if (currentInput && !currentInput.endsWith(' ') && currentInput.length > 0) {
        currentInput += ' ';
      }
      initialUserInputRef.current = currentInput;

      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setIsRecording(false);
        alert("Could not start voice recognition. Please try again.");
      }
    }
  };

  const handleClick = () => {
    setIsSidebarOpen(false)
  };
  const [userInput, setUserInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [isCurrentChatPersisted, setIsCurrentChatPersisted] = useState(false);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (currentChatId && currentChatId !== 'geminiChatid') {
      const isPersisted = chatSessionsAtom.init ? chatSessionsAtom.init.some(s => s.id === currentChatId) : false;
      setIsCurrentChatPersisted(isPersisted);
    } else {
      setIsCurrentChatPersisted(false);
    }
  }, [currentChatId]);


  // Auto-scroll disabled - user can scroll manually
  // useEffect(() => {
  //   const scrollToBottom = () => {
  //     if (messagesEndRef.current) {
  //       messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  //     }
  //   };

  //   // Small timeout to ensure DOM is updated
  //   const timer = setTimeout(scrollToBottom, 100);
  //   return () => clearTimeout(timer);
  // }, [messages, currentChatId]);

  // useEffect(() => {
  //   if (messagesEndRef.current) {
  //     messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
  //   }
  // }, [currentChatId]);

  useEffect(() => {
    // Only log chat info, no auto-scroll
    if (currentChatId) {
      console.log("Current chatid")
      console.log(messages)
      setCurrentChatId(prev => prev)
    }
  }, [messages, currentChatId]);

  const ensureChatSessionExists = async (chatIdToEnsure) => {
    if (isCurrentChatPersisted && chatIdToEnsure !== 'geminiChatid' || !supabase) return { success: true, isNew: false };

    const { data: existingChat, error: fetchError } = await supabase
      .from('gem_chats').select('id').eq('id', chatIdToEnsure).maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking for existing chat session:', fetchError);
      return { success: false, error: fetchError, isNew: false };
    }
    if (existingChat) {
      setIsCurrentChatPersisted(true);
      if (typeof window !== 'undefined' && window.refreshChatSessions) window.refreshChatSessions(); // Add window check
      return { success: true, isNew: false };
    }

    const initialTitle = `${truncateText(userInput, 20) || `New Chat ${new Date().toLocaleTimeString()}`}`;
    const { error: insertError } = await supabase
      .from('gem_chats').insert({ id: chatIdToEnsure, user_id: USER_ID, title: initialTitle });

    if (insertError) {
      console.error('Error creating new chat session:', insertError);
      return { success: false, error: insertError, isNew: true };
    }

    setIsCurrentChatPersisted(true);
    if (typeof window !== 'undefined' && window.refreshChatSessions) { // Add window check
      window.refreshChatSessions();
    }
    return { success: true, isNew: true };
  };
  let sys_prompt = `
  You are Learningly 🤖 — a concise and efficient AI assistant. Your goal is to provide the shortest possible answers while being helpful and accurate. The user name is ${namee}.

  ---

  ### 🎯 RESPONSE FORMAT RULES:

  1. **START WITH 2-3 LINE OVERVIEW:**
     - Begin with a 2-3 line maximum overview
     - Be as short as possible
     - For yes/no questions: Start with "Yes" or "No"
     - For general questions: Start with brief overview

  2. **KEEP RESPONSES UNDER 200 WORDS:**
     - All responses must be under 200 words
     - Be as concise as possible
     - Avoid unnecessary details

  3. **GREETING AT THE END:**
     - Move any greeting to the very end
     - Use format: "Hope this helps, ${namee}!"
     - Or similar friendly closing

  4. **STRUCTURE:**
     - Line 1-2: Brief overview/answer
     - Line 3+: Additional details (if needed)
     - Last line: Greeting with user's name

  ---

  ### 📝 EXAMPLES:

  **Yes/No Question:**
  "Is the Earth round?"
  → "Yes, the Earth is approximately spherical. It's an oblate spheroid, meaning it's slightly flattened at the poles. Hope this helps, ${namee}!"

  **General Question:**
  "What is photosynthesis?"
  → "Photosynthesis is the process where plants convert sunlight into energy. They use carbon dioxide and water to produce glucose and oxygen. This process sustains most life on Earth. Hope this helps, ${namee}!"

  **Complex Question:**
  "How does a computer work?"
  → "Computers process data using binary code (0s and 1s). They have a CPU for calculations, memory for storage, and input/output devices. The CPU follows instructions to perform tasks. Hope this helps, ${namee}!"

  ---

  ### ⚙️ CONSTRAINTS:
  - Maximum 200 words per response
  - Start with overview, end with greeting
  - Be as concise as possible
  - Use searchActive: ${searchActive} for real-time info
  - No lengthy explanations unless specifically asked

  ---

  ### 🎯 MISSION:
  Provide the shortest, most helpful answers possible while maintaining accuracy and friendliness.
  `;
  const sendToGemini = async (
    userInputContent,
    filesToProcess,
    existingMessages,
    chatIdToUse,
    messageIdToUpdate = null
  ) => {
    // === USAGE CHECK STARTS HERE ===
    if (USER_ID) {
      const remainingCredits = await getUserActivityUsage('general_chat');
      if (remainingCredits <= 0) {
        toast("Free limit for General Chat finished, Buy premium!", {
          description: "For $4.99 get higher usage limits",
          action: {
            label: "Buy",
            onClick: () => triggerProButtonDialog(),
          },
        });
        setIsLoading(false);
        return;
      }
      console.log(`ChatPanel (general_chat): User ${USER_ID} has ${remainingCredits} credits.`);
    } else {
      console.warn("ChatPanel (general_chat): User ID not available, skipping usage check.");
      // If you want to block chat for non-logged-in users, you can return or set an error here.
    }
    // === USAGE CHECK ENDS HERE ===

    setIsLoading(true);

    let isNewChatBeingCreated = false;
    let currentChatIdForProcessing = chatIdToUse;

    if (currentChatIdForProcessing === 'geminiChatid') { // 'geminiChatid' is your placeholder for new chat
      if (!userInputContent.trim() && filesToProcess.length === 0) {
        console.log("Please type a message or add a file to start a new chat."); // Replaced alert
        setIsLoading(false);
        return;
      }
      const newChatId = uuidv4();
      setCurrentChatId(newChatId);
      currentChatIdForProcessing = newChatId;
      isNewChatBeingCreated = true;
    }

    // ensureChatSessionExists should be defined in your component or imported
    const sessionResult = await ensureChatSessionExists(currentChatIdForProcessing);

    if (!sessionResult.success) {
      setIsLoading(false);
      console.error(`Error: Could not initialize or save chat session. ${sessionResult.error?.message || 'Please try again.'}`); // Replaced alert
      if (isNewChatBeingCreated) {
        setCurrentChatId('geminiChatid');
      }
      return;
    }

    if (sessionResult.isNew && userInputContent.trim()) {
      const newTitle = `${truncateText(userInputContent.trim(), 30)}`; // truncateText should be defined
      await supabase.from('gem_chats').update({ title: newTitle }).eq('id', currentChatIdForProcessing);
      if (typeof window !== 'undefined' && window.refreshChatSessions) window.refreshChatSessions();
    }

    let createdUserMessage = null;
    if (!messageIdToUpdate) {
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('gem_chat_messages') // Assuming this is your messages table
        .insert({ chat_id: currentChatIdForProcessing, user_id: USER_ID, role: 'user', content: userInputContent })
        .select('*, gem_chat_attachments(*)') // Assuming this is your attachments table relationship
        .single();

      if (userMsgError || !userMsgData) {
        console.error(`Error saving your message: ${userMsgError?.message || 'Unknown error'}.`); // Replaced alert
        setIsLoading(false);
        if (isNewChatBeingCreated) {
          setCurrentChatId('geminiChatid');
        }
        return;
      }
      createdUserMessage = userMsgData;
      setMessages(prev => [...prev, createdUserMessage]);
    }

    const geminiFilePartsForPrompt = [];
    const supabaseUploadedFileInfos = [];
    const googleFileResourceNamesUploaded = [];

    if (filesToProcess.length > 0) {
      for (const file of filesToProcess) {
        let googleUploadedFile = null;
        try {
          const supabaseFileName = `${uuidv4()}-${file.name}`;
          const supabaseFilePath = `${USER_ID}/${currentChatIdForProcessing}/${supabaseFileName}`;
          const { data: storageData, error: storageError } = await supabase.storage
            .from(SUPABASE_BUCKET_NAME)
            .upload(supabaseFilePath, file);

          if (storageError || !storageData) {
            console.error(`Error uploading ${file.name} to Supabase:`, storageError);
            continue;
          }
          const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET_NAME).getPublicUrl(storageData.path);
          const supabasePublicUrl = publicUrlData?.publicUrl;

          if (!genAI.files || typeof genAI.files.upload !== 'function') {
            console.error("Google AI File API (genAI.files.upload) is not available.");
            throw new Error("Google AI File API not available.");
          }
          googleUploadedFile = await genAI.files.upload({
            file: file,
            config: { mimeType: file.type || 'application/octet-stream', displayName: file.name },
          });

          if (!googleUploadedFile?.uri || !googleUploadedFile?.name) {
            console.error(`Error uploading ${file.name} to Google AI. Response:`, googleUploadedFile);
            continue;
          }
          googleFileResourceNamesUploaded.push(googleUploadedFile.name);
          geminiFilePartsForPrompt.push(createPartFromUri(googleUploadedFile.uri, googleUploadedFile.mimeType));

          const messageIdToAttachTo = createdUserMessage ? createdUserMessage.id : existingMessages[existingMessages.length - 1].id;

          const { data: attachmentData, error: attachmentError } = await supabase
            .from('gem_chat_attachments') // Assuming this is your attachments table
            .insert({
              message_id: messageIdToAttachTo,
              user_id: USER_ID,
              chat_id: currentChatIdForProcessing,
              file_name: file.name,
              file_path: storageData.path,
              file_type: file.type || 'application/octet-stream',
              file_size: file.size,
              metadata: { supabase_public_url: supabasePublicUrl, google_file_api_name: googleUploadedFile.name, google_file_uri: googleUploadedFile.uri }
            }).select().single();

          if (attachmentError || !attachmentData) console.error('Error saving attachment metadata:', attachmentError);
          else supabaseUploadedFileInfos.push(attachmentData);

        } catch (fileProcessingError) {
          console.error(`Error processing file ${file.name}:`, fileProcessingError);
          if (googleUploadedFile?.name && genAI.files?.deleteFile) {
            try { await genAI.files.deleteFile(googleUploadedFile.name); }
            catch (deleteErr) { console.error(`Failed to clean up Google AI file ${googleUploadedFile.name}:`, deleteErr); }
          }
        }
      }
      if (createdUserMessage && supabaseUploadedFileInfos.length > 0) {
        setMessages(prevMsgs => prevMsgs.map(msg =>
          msg.id === createdUserMessage.id
            ? { ...msg, gem_chat_attachments: [...(msg.gem_chat_attachments || []), ...supabaseUploadedFileInfos] }
            : msg
        ));
      }
    }

    // These should be part of your ChatPanel's state/refs if they are not already
    setUserInput('');
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const modelName = "gemini-2.5-flash"; // As in your original file
    let fullAiResponseText = "";
    let assistantMessagePlaceholder = null;

    if (messageIdToUpdate) {
      setMessages(prev => prev.map(msg =>
        msg.id === messageIdToUpdate ? { ...msg, content: "▋" } : msg
      ));
      assistantMessagePlaceholder = { id: messageIdToUpdate, chat_id: currentChatIdForProcessing, user_id: 'AI', role: 'assistant', content: "▋" };
    } else {
      const assistantMessageId = uuidv4();
      assistantMessagePlaceholder = {
        id: assistantMessageId, chat_id: currentChatIdForProcessing, user_id: 'AI', role: 'assistant',
        content: "▋", created_at: new Date().toISOString(), gem_chat_attachments: []
      };
      setMessages(prev => [...prev, assistantMessagePlaceholder]);
    }

    try {
      const historicalContents = existingMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || "" }]
      }));

      const finalPartsForApi = [];
      if (userInputContent) finalPartsForApi.push({ text: userInputContent });
      finalPartsForApi.push(...geminiFilePartsForPrompt);

      if (finalPartsForApi.length === 0 && !messageIdToUpdate) {
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholder.id));
        setIsLoading(false);
        return;
      }

      const contentsForApi = [...historicalContents, createUserContent(finalPartsForApi)];
      console.log("Sending to Gemini with context:", JSON.stringify(contentsForApi, null, 2));

      // Make sure sys_prompt is defined in your ChatPanel, including namee and searchActive
      const sys_prompt_for_chatg = `
        You are Learningly 🤖 — a concise and efficient AI assistant. Your goal is to provide the shortest possible answers while being helpful and accurate. The user name is ${namee || 'there'}.

        ---

        ### 🎯 RESPONSE FORMAT RULES:

        1. **START WITH 2-3 LINE OVERVIEW:**
           - Begin with a 2-3 line maximum overview
           - Be as short as possible
           - For yes/no questions: Start with "Yes" or "No"
           - For general questions: Start with brief overview

        2. **KEEP RESPONSES UNDER 200 WORDS:**
           - All responses must be under 200 words
           - Be as concise as possible
           - Avoid unnecessary details

        3. **GREETING AT THE END:**
           - Move any greeting to the very end
           - Use format: "Hope this helps, ${namee || 'there'}!"
           - Or similar friendly closing

        4. **STRUCTURE:**
           - Line 1-2: Brief overview/answer
           - Line 3+: Additional details (if needed)
           - Last line: Greeting with user's name

        ---

        ### 📝 EXAMPLES:

        **Yes/No Question:**
        "Is the Earth round?"
        → "Yes, the Earth is approximately spherical. It's an oblate spheroid, meaning it's slightly flattened at the poles. Hope this helps, ${namee || 'there'}!"

        **General Question:**
        "What is photosynthesis?"
        → "Photosynthesis is the process where plants convert sunlight into energy. They use carbon dioxide and water to produce glucose and oxygen. This process sustains most life on Earth. Hope this helps, ${namee || 'there'}!"

        **Complex Question:**
        "How does a computer work?"
        → "Computers process data using binary code (0s and 1s). They have a CPU for calculations, memory for storage, and input/output devices. The CPU follows instructions to perform tasks. Hope this helps, ${namee || 'there'}!"

        ---

        ### ⚙️ CONSTRAINTS:
        - Maximum 200 words per response
        - Start with overview, end with greeting
        - Be as concise as possible
        - Use searchActive: ${searchActive} for real-time info
        - No lengthy explanations unless specifically asked

        ---

        ### 🎯 MISSION:
        Provide the shortest, most helpful answers possible while maintaining accuracy and friendliness.
      `;

      const stream = await genAI.models.generateContentStream({
        model: modelName,
        contents: contentsForApi,
        config: { // Use 'config' for new SDK
          tools: [searchActive ? { googleSearch: {}, urlContext: {} } : { urlContext: {} }],
          systemInstruction: sys_prompt + `searchActive value ==>  ${searchActive}`, // Passed your sys_prompt here
        },
      });

      for await (const chunk of stream) {
        const chunkText = chunk.text; // Or chunk.text() if it's a method
        if (chunkText) {
          fullAiResponseText += chunkText;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessagePlaceholder.id ? { ...msg, content: fullAiResponseText + "▋" } : msg
          ));
        }
      }

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessagePlaceholder.id ? { ...msg, content: fullAiResponseText } : msg
      ));

      if (messageIdToUpdate) {
        const { data: updatedAiMsgData, error: updatedAiMsgError } = await supabase
          .from('gem_chat_messages') // Assuming this is your messages table
          .update({ content: fullAiResponseText })
          .eq('id', messageIdToUpdate)
          .select('*, gem_chat_attachments(*)') // Assuming attachments table
          .single();

        if (updatedAiMsgError || !updatedAiMsgData) console.error('Error updating AI message:', updatedAiMsgError);
        else setMessages(prev => prev.map(msg => msg.id === messageIdToUpdate ? updatedAiMsgData : msg));
      } else {
        const { data: aiMsgData, error: aiMsgError } = await supabase
          .from('gem_chat_messages') // Assuming this is your messages table
          .insert({
            chat_id: currentChatIdForProcessing,
            user_id: USER_ID, // AI message not directly from USER_ID
            role: 'assistant',
            content: fullAiResponseText,
          }).select('*, gem_chat_attachments(*)').single(); // Assuming attachments table

        if (aiMsgError || !aiMsgData) console.error('Error saving AI message:', aiMsgError);
        else setMessages(prev => prev.map(msg => msg.id === assistantMessagePlaceholder.id ? aiMsgData : msg));
      }

      // === DECREMENT USAGE STARTS HERE ===
      if (USER_ID) {
        await decrementUserActivityUsage('general_chat');
        console.log("ChatPanel (general_chat): General chat usage decremented.");
      }
      // === DECREMENT USAGE ENDS HERE ===

    } catch (aiError) {
      console.error('Error with Google Gemini API:', aiError);
      const errorContent = `AI Error: ${aiError?.message || 'Unknown'}`;
      setMessages(prev => prev.map(msg => msg.id === assistantMessagePlaceholder.id ? { ...msg, content: errorContent } : msg));
      await supabase.from('gem_chat_messages').insert({ // Assuming messages table
        chat_id: currentChatIdForProcessing,
        // user_id: 'AI_ERROR', // Or some identifier for AI errors
        role: 'assistant',
        content: errorContent
      });
      if (googleFileResourceNamesUploaded.length > 0 && genAI.files?.deleteFile) {
        for (const name of googleFileResourceNamesUploaded) {
          try { await genAI.files.deleteFile(name); } catch (delErr) { console.error(`Cleanup fail: ${name}`, delErr); }
        }
      }
    } finally {
      if (supabase && sessionResult.success) {
        await supabase.from('gem_chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChatIdForProcessing);
        if (typeof window !== 'undefined' && window.refreshChatSessions) {
          window.refreshChatSessions();
        }
      }
      setIsLoading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userInput.trim() && pendingFiles.length === 0 && currentChatId === 'geminiChatid') {
      alert("Please type a message or add a file to start a new chat.");
      return;
    }

    let chatToUse = currentChatId;
    if (currentChatId === 'geminiChatid') {
      chatToUse = uuidv4();
      setCurrentChatId(chatToUse);
    }

    await sendToGemini(userInput, pendingFiles, messages, chatToUse);
    setUserInput('')
  };

  const handleFileChange = (event) => {
    if (event.target.files) setPendingFiles(prev => [...prev, ...Array.from(event.target.files)]);
  };
  const removePendingFile = (fileNameToRemove) => {
    setPendingFiles(prev => prev.filter(f => !(f.name === fileNameToRemove && f.lastModified === fileNameToRemove.lastModified && f.size === fileNameToRemove.size)));
  };
  const ResponseActions = ({ message, onRegenerate, onLike, onDislike, onCopy, isLoading }) => (
    <div className="flex items-center mb-2 ml-3 mt-0 justify-end">
      {message.role === 'assistant' && message.content !== "▋" && (
        <>
          <button
            onClick={() => onRegenerate(message)}
            className="p-1 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            title="Regenerate response"
            disabled={isLoading}
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <RefreshCw size={16} />
            )}
          </button>

          <button
            onClick={() => onLike(message)}
            className={`p-1 rounded-md ${message.feedback === 'like' ? 'text-green-500 dark:text-green-400' : 'text-zinc-500 dark:text-zinc-400'} hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 transition-colors`}
            title="Like response"
            disabled={isLoading}
          >
            <ThumbsUp size={16} />
          </button>


          <button
            onClick={() => onDislike(message)}
            className={`p-1 rounded-md ${message.feedback === 'dislike' ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'} hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 transition-colors`}
            title="Dislike response"
            disabled={isLoading}
          >
            <ThumbsDown size={16} />
          </button>

          <button
            onClick={() => onCopy(message.content)}
            className="p-1 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            title="Copy response"
            disabled={isLoading}
          >
            <Copy size={16} />
          </button>
        </>
      )}
    </div>
  );

  const handleLikeResponse = async (message) => {
    const newFeedback = message.feedback === 'like' ? null : 'like';
    setMessages(prev => prev.map(msg => msg.id === message.id ? { ...msg, feedback: newFeedback } : msg));

    if (supabase) {
      const { error } = await supabase
        .from('gem_chat_messages')
        .update({ feedback: newFeedback })
        .eq('id', message.id);
      if (error) console.error("Error saving feedback:", error);
    }
  };

  const handleDislikeResponse = async (message) => {
    const newFeedback = message.feedback === 'dislike' ? null : 'dislike';
    setMessages(prev => prev.map(msg => msg.id === message.id ? { ...msg, feedback: newFeedback } : msg));

    if (supabase) {
      const { error } = await supabase
        .from('gem_chat_messages')
        .update({ feedback: newFeedback })
        .eq('id', message.id);
      if (error) console.error("Error saving feedback:", error);
    }
  };

  const handleCopyResponse = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) { // Check for navigator.clipboard
      try {
        await navigator.clipboard.writeText(text);
        console.log("Text copied to clipboard");
      } catch (err) {
        console.error("Failed to copy text:", err);
        alert("Failed to copy text to clipboard. Please try manually.");
      }
    } else {
      alert("Clipboard API not supported in this browser.");
    }
  };


  const handleRegenerateResponse = async (assistantMessage) => {
    if (isLoading) return;

    setIsLoading(true);

    const assistantMsgIndex = messages.findIndex(msg => msg.id === assistantMessage.id);
    if (assistantMsgIndex === -1) {
      console.error("Assistant message not found for regeneration.");
      setIsLoading(false);
      return;
    }


    let userMessage = null;
    for (let i = assistantMsgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) {
      console.error("No preceding user message found for regeneration context.");
      setIsLoading(false);
      return;
    }


    const historyForRegeneration = messages.slice(0, messages.indexOf(userMessage) + 1);


    await sendToGemini(userMessage.content, [], historyForRegeneration, assistantMessage.chat_id, assistantMessage.id);
  };

  // Message editing handlers
  const handleEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditText(message.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editText.trim()) return;

    try {
      // Update message in database
      const { error: updateError } = await supabase
        .from('gem_chat_messages')
        .update({ content: editText.trim() })
        .eq('id', messageId);

      if (updateError) {
        console.error('Error updating message:', updateError);
        return;
      }

      // Update local state
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, content: editText.trim() } : msg
      ));

      // Find the message and regenerate assistant response
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        // Find the next assistant message after this user message
        let assistantMessageIndex = -1;
        for (let i = messageIndex + 1; i < messages.length; i++) {
          if (messages[i].role === 'assistant') {
            assistantMessageIndex = i;
            break;
          }
        }

        if (assistantMessageIndex !== -1) {
          const assistantMessage = messages[assistantMessageIndex];
          // Get conversation history up to the edited message
          const historyForRegeneration = messages.slice(0, messageIndex + 1).map(msg =>
            msg.id === messageId ? { ...msg, content: editText.trim() } : msg
          );

          // Clear editing state
          setEditingMessageId(null);
          setEditText('');

          // Regenerate assistant response
          await sendToGemini(editText.trim(), [], historyForRegeneration, assistantMessage.chat_id, assistantMessage.id);
        } else {
          // No assistant message to regenerate, just clear editing state
          setEditingMessageId(null);
          setEditText('');
        }
      }

      // Update chat session timestamp
      if (supabase) {
        await supabase.from('gem_chats').update({ updated_at: new Date().toISOString() }).eq('id', currentChatId);
        if (typeof window !== 'undefined' && window.refreshChatSessions) {
          window.refreshChatSessions();
        }
      }

    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  // User Message Actions Component
  const UserMessageActions = ({ message, onEdit, isEditing, isLoading }) => (
    <div className="flex items-center justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {!isEditing && !isLoading && (
        <button
          onClick={() => onEdit(message)}
          className="p-1 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          title="Edit message"
        >
          <EditIcon size={14} />
        </button>
      )}
    </div>
  );


  const renderInputArea = () => (
    <div className="dark:bg-zinc-900 mb-2 rounded-2xl w-[calc(100%-1rem)] sm:w-[70%] mx-auto text-gray-200 p-4  border-1 
    dark:border-gray-500 border-gray-300 dark:border-1">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">

        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={isRecording ? "Listening..." : ((currentChatId === 'geminiChatid' || messages.length === 0) ? "Start a new chat with Learningly..." : "Type your message or upload files...")}
          className="w-full py-2.5 px-1 bg-transparent text-zinc-900 dark:text-zinc-200 rounded-xl placeholder-gray-400 outline-0 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors resize-none scrollbar-thin overflow-y-auto"
          rows="1"
          style={{ minHeight: '2.8rem' }}
          onInput={(e) => {
            if (typeof window !== 'undefined') {
              e.target.style.height = 'auto';
              const lineHeight = 24; // Base line height
              const maxLines = 4;
              const maxTextareaHeight = lineHeight * maxLines + (parseFloat(getComputedStyle(e.target).paddingTop) + parseFloat(getComputedStyle(e.target).paddingBottom));

              // Set the height to either the content height or max height, whichever is smaller
              e.target.style.height = `${Math.min(e.target.scrollHeight, maxTextareaHeight)}px`;

              // Add or remove scrollbar based on content height
              if (e.target.scrollHeight > maxTextareaHeight) {
                e.target.classList.add('overflow-y-scroll');
              } else {
                e.target.classList.remove('overflow-y-scroll');
              }
            }
          }}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        <div className='flex flex-row w-full max-w-full items-center justify-between'>
          <label
            htmlFor="file-upload-input-gem-clone-main"
            title="Attach files"
            className={`p-2 self-end mb-1 rounded-full  transition-colors dark:bg-zinc-800 border-0 dark:border-chart-1
            ${isLoading ? 'border-gray-700 text-gray-500 cursor-not-allowed opacity-60' : 'border-gray-600 text-black dark:text-gray-400 dark:hover:text-gray-100 dark:hover:border-gray-500 cursor-pointer'}`}
          >
            <Plus size={20} />
          </label>
          <input
            type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden"
            id="file-upload-input-gem-clone-main"
            accept=".pdf,image/jpeg,image/png,image/webp,.txt"
            disabled={isLoading}
          />
          <button
            type="button" onClick={toggleSearch}
            className={`flex items-center gap-2 px-3 py-2 rounded-3xl border transition-colors duration-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 ${searchActive ? ' bg-zinc-200 text-black dark:bg-zinc-200 border-green-700 dark:text-zinc-800' : 'dark:bg-zinc-800 border-zinc-600 text-zinc-900 dark:text-zinc-300'} hover:bg-opacity-80 mr-auto ml-3`}
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Search</span>
          </button>
          {pendingFiles.length > 0 && (
            <div className="flex flex-row gap-2 overflow-x-auto max-w-[80%] scrollbar-thin ml-3">
              {pendingFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center px-3 py-1 text-xs bg-zinc-700 text-white rounded-full whitespace-nowrap flex-shrink-0"
                  title={file.name}
                >
                  <span className="mr-2">
                    {file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name}
                  </span>
                  <button
                    type="button"
                    className="ml-1 text-red-300 hover:text-red-500"
                    onClick={() => {
                      const newFiles = [...pendingFiles];
                      newFiles.splice(idx, 1);
                      setPendingFiles(newFiles);
                    }}
                    title="Remove file"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button" onClick={handleVoiceInputClick} title={isRecording ? "Stop recording" : "Start voice input"} disabled={isLoading}
            className={`p-2.5 self-end mb-1 rounded-full transition-colors duration-150 ease-in-out flex items-center justify-center ${isLoading ? 'dark:bg-zinc-700 dark:text-gray-500 cursor-not-allowed opacity-60' : isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600 hover:text-white'} ml-2`}
          >
            {isRecording ? <StopCircle size={20} className="h-5 w-5" /> : <Mic size={20} className="h-5 w-5" />}
          </button>
          <button
            type="submit" title="Send message" disabled={isLoading || (!userInput.trim() && pendingFiles.length === 0)}
            className={`p-2.5 ml-2 self-end mb-1 rounded-full transition-colors duration-150 ease-in-out flex items-center justify-center ${isLoading ? 'bg-zinc-700 text-white opacity-70 cursor-wait' : (userInput.trim() || pendingFiles.length > 0) ? 'dark:hover:bg-zinc-700 dark:text-zinc-800 text-black hover:bg-zinc-300 dark:bg-zinc-200 duration-200 ' : 'bg-zinc-700 text-gray-400 cursor-not-allowed'}`}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <ArrowUpIcon size={19} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
  if (currentChatId === 'geminiChatid' || messages.length == 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-gray-500">
        <div className="text-center p-4 flex flex-col w-full px-2 sm:px-4">
          <TimeBasedGreeting />
          {renderInputArea()}
        </div>
      </div>
    );
  }

  if (isChatPanelLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-800">
        <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-3 text-gray-600">Loading chat messages...</p>
      </div>
    );
  }


  if (currentChatId) {
    return (

      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-800 text-zinc-200 overflow-hidden">
        {/* Chat messages area */}
        {/* Add window check for `window.innerWidth` */}
        {/* {typeof window !== 'undefined' && !isSidebarOpen && window.innerWidth < 768 && (<button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="menu-button p-2 rounded-md text-zinc-900 dark:text-gray-400 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors absolute top-4 left-4 z-10 sm:hidden" // Only visible on small screens
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}
          hy
        </button>)} */}

        <div className="flex-1 overflow-y-auto p-4 md:w-[70%] mx-auto space-y-4 pt-16 pb-32 scrollbar-thin">
          {messages.map((msg, index) => {
            // Determine if any attachment in this message is an image with a URL
            const hasDisplayableImage = msg.gem_chat_attachments?.some(att => {
              const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
              return imageMimeTypes.includes(att.file_type?.toLowerCase()) && att.metadata?.supabase_public_url;
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full animate-fade-in group`}
                style={{
                  animationDelay: `${index * 100}ms`,
                  opacity: 0,
                  animation: 'fadeIn 0.5s ease-out forwards'
                }}
              >
                <div className={`rounded-xl ${msg.role === 'user'
                  ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white px-3 py-2 sm:px-4 sm:py-0 w-fit h-fit max-w-[90%] sm:max-w-[70%] '
                  : 'bg-transparent text-zinc-200 max-w-full sm:max-w-3xl px-3 py-2 sm:px-4 sm:py-2.5'
                  }`}>

                  {/* Render text content if it exists */}
                  {msg.content === "▋" ? (
                    <span className="blinking-cursor text-white text-sm">▋</span>
                  ) : editingMessageId === msg.id ? (
                    // Edit mode for user messages
                    <div className="py-3 space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-transparent border border-zinc-400 dark:border-zinc-500 rounded-lg p-2 text-zinc-900 dark:text-white resize-none"
                        rows={Math.max(2, editText.split('\n').length)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSaveEdit(msg.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm rounded-md bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          disabled={!editText.trim() || isLoading}
                          className="px-3 py-1 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? 'Saving...' : 'Save & Regenerate'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    msg.role === 'user' ? (
                      <div className="py-3 relative flex flex-row space-x-2 ">
                        <p>{msg.content}</p>
                        <UserMessageActions
                          message={msg}
                          onEdit={handleEditMessage}
                          isEditing={editingMessageId === msg.id}
                          isLoading={isLoading}
                        />
                      </div>
                    ) : (
                      <ChatMarkdownRenderer mark={msg.content} />
                    )
                  )}

                  {/* Attachments Section */}
                  {msg.gem_chat_attachments && msg.gem_chat_attachments.length > 0 && (
                    <div className={`mt-2 ${msg.content ? 'pt-2 border-t border-zinc-700' : ''} space-y-2`}>
                      {msg.gem_chat_attachments.map(att => {
                        const imageMimeTypes = [
                          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
                        ];
                        const isImage = att.file_type && imageMimeTypes.includes(att.file_type.toLowerCase());

                        return (
                          <div key={att.id || att.file_name} className={`p-2 rounded-md my-1 ${isImage && att.metadata?.supabase_public_url ? 'bg-transparent' : 'bg-zinc-700/50'}`}>
                            {isImage && att.metadata?.supabase_public_url ? (
                              <div className="text-left">
                                <div className="relative w-full max-w-[350px] h-[250px]">
                                  <Image
                                    src={att.metadata.supabase_public_url}
                                    alt={`Attachment: ${att.file_name}`}
                                    fill
                                    sizes="(max-width: 350px) 100vw, 350px"
                                    className="rounded object-contain"
                                    unoptimized={true}
                                  />
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">
                                  🖼️ <span className="font-medium">{att.file_name}</span> ({(att.file_size / 1024).toFixed(2)} KB)
                                  <a href={att.metadata.supabase_public_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:text-blue-300 hover:underline">(Download)</a>
                                </p>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-300">
                                📄 <span className="font-medium">{att.file_name}</span> ({att.file_type}, {(att.file_size / 1024).toFixed(2)} KB)
                                {att.metadata?.supabase_public_url && (
                                  <a href={att.metadata.supabase_public_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:text-blue-300 hover:underline">(Download)</a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div> {/* End of message bubble div */}

                {/* Response Actions (moved inside the main message container) */}
                {msg.role === 'assistant' && msg.content !== "▋" && !isLoading && (
                  <div className={`mt-2 ${msg.role === 'user' ? 'self-end' : 'self-start'}`}> {/* Added self-end/start for alignment */}
                    <ResponseActions
                      message={msg}
                      onRegenerate={handleRegenerateResponse}
                      onLike={handleLikeResponse}
                      onDislike={handleDislikeResponse}
                      onCopy={handleCopyResponse}
                      isLoading={isLoading}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className='fixed bottom-0 left-0 right-0  flex flex-col items-center justify-center  relative'>
          <div className='max-w  w-full mx-auto px-4'>
            {renderInputArea()}
          </div>
        </div>

      </div>

    );
  }
}
const sidebarOpenAtom = atomWithStorage('sidebarOpen', true);

// --- MAIN PAGE COMPONENT ---
const GemCloneChatPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(sidebarOpenAtom);

  // This useEffect is no longer necessary as the toggle is now manual on all screen sizes.
  // You can keep it if you want the sidebar to default to closed on mobile load, but it's cleaner to remove it.
  /*
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [setIsSidebarOpen]);
  */


  return (
    // The main container is still a flex container.
    <div className="flex flex-col h-full font-sans antialiased text-gray-800 bg-gray-200">

      {/* CHANGE #1: The Menu Button
        - Removed `sm:hidden` to make it visible on all screens.
        - Simplified the margin logic to push the button based on the sidebar's state.
      */}
      <button
        onClick={() => {
          setIsSidebarOpen(!isSidebarOpen)
          console.log("clicked in chat sidebar")
        }}
        className={`fixed p-2 rounded-md text-black dark:text-white hover:bg-gray-100 hover:text-gray-800 focus:outline-none outline-0 transition-all duration-300 ease-in-out mt-5 z-50 bg-zinc-80
        ${isSidebarOpen ? 'ml-[14.3rem]' : 'ml-[0.5rem]'}`}
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isSidebarOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}

      </button>

      <Sidebar />

      {/* CHANGE #2: The Main Content Wrapper
        - Wrapped ChatPanel in a <main> tag.
        - This wrapper will now get a dynamic `margin-left` to make space for the sidebar.
        - This prevents the ChatPanel from being overlapped.
      */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-0 sm:ml-[17rem]' : 'ml-0'}`}>
        <ChatPanel />
      </main>

      {/* This overlay for mobile is still perfectly fine and requires no changes. */}
      {typeof window !== 'undefined' && isSidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default GemCloneChatPage;

<style jsx global>{`
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }

  .scroll-smooth {
    scroll-behavior: smooth;
  }
`}</style>