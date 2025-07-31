"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Flashcards from "./Flashcards";
import UserNotes from "./UserNote";
import QuizTab from "./QuizTab";
import SummaryTab from "./SummaryTab";
import ChatTab from './ChatTab';
import { supabase } from "../lib/supabaseClient";
import { useAtom, useAtomValue } from "jotai";
import {
  files_supabase_state,
  file_id_supabase,
  chat_id_supabase,
} from "../../store/uploadAtoms";
import { UploadCloud, FileText, CheckSquare, ArrowRight, ArrowDown } from 'lucide-react'; // Using lucide-react for icons
import Link from "next/link";
// Icons
import Memetab from './Memetab'
import {
  FileTextIcon,
  FileEdit,
  LibraryBig,
  FileQuestionIcon,
  FileIcon,
  AlertCircle,
  ListChecks,
  BrainCircuit,
  BookOpenText,
  Layers,
  MessageCircleQuestionIcon,
  SmileIcon
  // Link
} from "lucide-react";
import NoDocumentPlaceholder from './a_supplements'

const ExamPrepFlowchart = () => {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 my-auto">
      {/* Main container using flexbox for responsiveness */}
      <div className="flex flex-col md:flex-row items-center justify-center md:items-stretch">

        {/* Step 1: Upload Study Files */}
        <div className="flex flex-col md:flex-row items-center">
          {/* Card for Step 1 */}
          <div className="flex flex-col items-center p-4 md:p-5 bg-white dark:bg-zinc-800 rounded-lg shadow-md text-center border border-zinc-200 dark:border-zinc-700 w-48 md:w-56 h-full">
            <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
              <UploadCloud className="h-6 w-6 md:h-7 md:w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm md:text-base font-medium text-zinc-800 dark:text-zinc-100">
              Upload Study Files
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              PDFs of your notes, textbooks, etc.
            </p>
          </div>

          {/* Arrow (Vertical for Mobile, Horizontal for Desktop) */}
          <div className="my-3 md:my-0 md:mx-4 flex items-center justify-center">
            {/* Vertical Arrow (Mobile) */}
            <ArrowDown className="h-6 w-6 text-zinc-400 dark:text-zinc-500 block md:hidden" />
            {/* Horizontal Arrow (Desktop) */}
            <ArrowRight className="h-6 w-6 text-zinc-400 dark:text-zinc-500 hidden md:block" />
          </div>
        </div>

        {/* Step 2: Upload Sample/Instructions */}
        <div className="flex flex-col md:flex-row items-center">
          {/* Card for Step 2 */}
          <div className="flex flex-col items-center p-4 md:p-5 bg-white dark:bg-zinc-800 rounded-lg shadow-md text-center border border-zinc-200 dark:border-zinc-700 w-48 md:w-56 h-full">
            <div className="flex-shrink-0 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-3">
              <FileText className="h-6 w-6 md:h-7 md:w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm md:text-base font-medium text-zinc-800 dark:text-zinc-100">
              Add Sample or Instructions
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Optional: Provide a sample PDF or type instructions.
            </p>
          </div>

          {/* Arrow (Vertical for Mobile, Horizontal for Desktop) */}
          <div className="my-3 md:my-0 md:mx-4 flex items-center justify-center">
            {/* Vertical Arrow (Mobile) */}
            <ArrowDown className="h-6 w-6 text-zinc-400 dark:text-zinc-500 block md:hidden" />
            {/* Horizontal Arrow (Desktop) */}
            <ArrowRight className="h-6 w-6 text-zinc-400 dark:text-zinc-500 hidden md:block" />
          </div>
        </div>

        {/* Step 3: Get Test */}
        <div className="flex flex-col md:flex-row items-center">
          {/* Card for Step 3 */}
          <div className="flex flex-col items-center p-4 md:p-5 bg-white dark:bg-zinc-800 rounded-lg shadow-md text-center border border-zinc-200 dark:border-zinc-700 w-48 md:w-56 h-full">
            <div className="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
              <CheckSquare className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm md:text-base font-medium text-zinc-800 dark:text-zinc-100">
              Get Your Test!
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Receive a full test with answer keys, for free.
            </p>
          </div>
          {/* No arrow needed after the last step */}
        </div>


      </div>
      <Link href="/exm_prep" className="flex flex-col p-6 text-2xl rounded-lg transform
       duration-300 cursor-pointer dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
            bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 mt-10 w-[40%] mx-auto">
        <button><h1>Generate Prep</h1></button>

      </Link>

    </div>
  );
};
export default function Supplements() {
  // --- State ---
  const [activeTab, setActiveTab] = useState("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Refs ---
  const isMounted = useRef(true);

  // --- Jotai Atoms ---
  const [files, setFiles] = useAtom(files_supabase_state);
  const [fid, setFid] = useAtom(file_id_supabase);
  const chatID = useAtomValue(chat_id_supabase);

  // --- Tabs Definition ---
  const tabs = [
    { name: "Summary", id: "summary", icon: BookOpenText },
    { name: "Note", id: "note", icon: FileEdit },
    { name: "Chat", id: "chat", icon: MessageCircleQuestionIcon },
    { name: "Flash cards", id: "flashcards", icon: Layers },
    { name: "Quiz", id: "quiz", icon: ListChecks },
    { name: "Memes", id: "memes", icon: SmileIcon },

  ];

  // --- Data Fetching Logic ---
  const fetchFilesForChat = useCallback(async (chatId) => {
    if (!chatId) return { data: [], error: null };

    const { data, error } = await supabase
      .from("files")
      .select("*")
      .eq("chat_id", chatId)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  }, []);

  // --- Effect to Fetch Files ---
  useEffect(() => {
    // Setup
    isMounted.current = true;
    setIsLoading(false);
    setError(null);

    // Handle empty chatID case
    if (!chatID) {
      if (isMounted.current) {
        setFiles([]);
        setFid(null);
        setIsLoading(false);
      }
      return;
    }

    // Fetch data
    const fetchData = async () => {
      try {
        const { data, error: fetchError } = await fetchFilesForChat(chatID);

        if (!isMounted.current) return;

        if (fetchError) throw fetchError;

        // Only update if data has changed
        const newFirstFileId = data.length > 0 ? data[0].id : null;

        // Always set files - rely on React's state update optimization
        setFiles(data);

        // Only update file ID if needed
        if (fid !== newFirstFileId) {
          setFid(newFirstFileId);
        }
      } catch (err) {
        if (isMounted.current) {
          console.error("Error fetching files:", err);
          setError(err.message || 'Failed to load files');
          setFiles([]);
          setFid(null);
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup
    return () => {
      isMounted.current = false;
    };
  }, [chatID, fetchFilesForChat, setFiles, setFid]);

  // --- Render Logic ---

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col dark:bg-zinc-900 bg-slate-50 mt-5 h-[97%] w-[91%] md:w-[98%] md:mx-auto p-6 justify-center items-center rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">Loading files...</p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="flex flex-col dark:bg-zinc-900 bg-slate-50 mt-5 h-[97%] w-[91%] md:w-[98%] md:mx-auto p-6 justify-center items-center rounded-lg text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <p className="text-red-600 dark:text-red-400 font-medium mb-1">Error Loading Files</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  // 3. No File Selected State
  if (!fid) {
    return (
      <NoDocumentPlaceholder />
    );
  }

  // 4. File Selected - Show Tabs and Content
  return (
    <div className="flex flex-col dark:bg-zinc-900 bg-slate-50 mt-[8rem] h-[97%] w-[99%] md:w-[98%] md:mx-auto p-2 md:p-2 rounded-lg md:mt-5 ">
      {/* Tab Buttons Row */}
      <div className="grid md:grid-cols-6 grid-cols-2 gap-2 dark:bg-zinc-800/60 bg-gray-100 p-1.5 rounded-lg mb-4 flex-shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center justify-center space-x-1.5 px-2 md:px-3 py-2 text-xs md:text-sm rounded-md font-medium cursor-pointer duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 hover:scale-[1.1] transform hover:shadow-md  hover:shadow-green-300 hover:-translate-y-1
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

      {/* Content Area */}
      <div className="flex-grow mt-0 flex flex-col h-full overflow-y-auto rounded-lg scrollbar-hide w-full min-h-0 relative">
        {activeTab === "summary" && <SummaryTab />}
        {activeTab === "memes" && <Memetab />}
        {activeTab === "note" && <UserNotes />}
        {activeTab === "chat" && <ChatTab />}
        {activeTab === "flashcards" && <Flashcards />}
        {activeTab === "quiz" && <QuizTab />}
        {activeTab === "exxpre" && (<ExamPrepFlowchart />)}
      </div>
    </div>
  );
}