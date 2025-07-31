'use client'
import Image from "next/image"; // Keep if used by child components implicitly
import Supplements from "./Supplements"; // Reading mode component
import Supplements2 from "./Supplements2"; // Reading mode component
import WritingSupplements from "./WritingSupplements"; // Writing mode component
// Corrected: Removed duplicate import WritingSupplements2
import { useAtom, useAtomValue } from "jotai";
import Link from "next/link";
import {
  user_id_supabase,
  chat_id_supabase, // Reading chat ID atom
  sideBar_state,
  reading_State,
  writing_chat_id_supabase, // Writing chat ID atom
  create_ChatGlow,
  chats_supabase_state
} from "../../store/uploadAtoms";
import { LogInIcon, PlusCircleIcon } from "lucide-react"; // Added PlusCircleIcon
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { supabase } from "../lib/supabaseClient"; // Fixed import path

import useIsMobile from "./useIsMobile";
import { useState, useEffect, useRef, useCallback } from "react"; // Added useEffect for potential cleanup

export default function MainContent() { // Removed unused 'reading' prop
  // --- State and Atoms ---
  const uid = useAtomValue(user_id_supabase); // Read uid value directly
  const [chatID, setChatID] = useAtom(chat_id_supabase); // Reading Chat ID state
  const [wChatID, setWChatID] = useAtom(writing_chat_id_supabase); // Writing Chat ID state
  const [isOpen, setIsOpen] = useAtom(sideBar_state); // Sidebar state
  const [buttonGlow, setButtonGlow] = useAtom(create_ChatGlow); // Glow effect state for sidebar button
  const readingState = useAtomValue(reading_State); // Determines Reading vs Writing mode
  const isMobile = useIsMobile(); // Hook to check for mobile viewport
  const [isGlowActive, setIsGlowActive] = useState(false); // Local state to manage glow effect interval
  const [chats, setChats] = useAtom(chats_supabase_state);

  // --- Glow Effect Logic ---
  // Function to trigger sidebar opening and button glow effect
  const glowChatCreation = async () => {
    if (!uid) return;

    try {
      // Create new chat in Supabase
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert([{ user_id: uid, title: 'New chat' }])
        .select()
        .single();

      if (error) throw error;

      // Update the chat list in the sidebar
      setChats(prevChats => [newChat, ...prevChats]);

      // Set the new chat as active
      setChatID(newChat.id);
      setIsOpen(true);

      // Glow effect logic
      if (!isGlowActive) {
        setIsGlowActive(true);
        let count = 0;
        const interval = setInterval(() => {
          count++;
          if (count >= 10) {
            clearInterval(interval);
            setIsGlowActive(false);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to create chat. Please try again.');
    }
  };

  // Optional: Cleanup interval if component unmounts unexpectedly during glow
  useEffect(() => {
    // This cleanup only matters if the component could unmount *while* the glow is active
    // The internal count limit usually handles cleanup sufficiently.
    let intervalId = null; // Placeholder for interval ID if stored externally
    return () => {
      if (intervalId) { // Check if an interval ID was stored
        clearInterval(intervalId);
      }
      // Reset glow states on unmount if needed
      // setIsGlowActive(false);
      // setButtonGlow(false);
    };
  }, []); // Empty dependency array means this runs only on mount/unmount

  // --- Conditional Rendering Logic ---

  // 1. Check for User Login Status
  if (!uid) {
    return (
      // Login Prompt - Existing classes maintained
      <div className="flex flex-row w-full md:h-screen h-[200vh] bg-lue-300 relative bg--400">
        {/* Mobile Overlay - kept for consistency, though not visible on login screen */}
        <div className={`flex flex-col absolute top-0 w-full h-full opacity-50 bg-[#7F7F7F] ${isMobile ? (isOpen ? "visible" : "hidden") : 'hidden'}`}></div>
        {/* Login Content */}
        <div className="flex flex-col w-full h-full">
          <h1 className="mx-auto font-bold text-3xl dark:text-zinc-100 text-indigo-500 my-auto text-center px-4">
            Please log in to access the platform! {/* Slightly rephrased */}
          </h1>
          <Link href="/login" className="bg-indigo-500 text-white dark:bg-zinc-200 dark:text-zinc-900 hover:dark:bg-zinc-900 hover:dark:text-zinc-200 transform duration-300 font-semibold p-5 mb-auto mx-auto w-[10rem] rounded-lg justify-between items-center flex flex-row">
            {/* Button text inside Link */}
            Log In
            <LogInIcon />
          </Link>
        </div>
      </div>
    );
  }

  // 2. Logged In User - Determine Content based on Reading/Writing State and Chat IDs
  let content = null;

  if (readingState) {
    // --- Reading Mode ---
    if (chatID) {
      // Reading chat exists - Show Reading Supplements
      content = (
        <div className="w-full h-full overflow-hidden">
          {/* Mobile Layout (stacked vertically) */}
          <div className="flex flex-col-reverse items-center justify-center h-full w-full gap-4 md:hidden bg-amber-20">
            <div className="h-1/2 w-full  overflow-hidden bg-transparent mx-auto flex items-center justify-center">
              <Supplements2 />
            </div>
            <div className="h-1/2 w-full  overflow-hidden bg-transparent mx-auto flex items-center justify-center">
              <Supplements />
            </div>
          </div>


          {/* Desktop Layout (side-by-side panes with Allotment) */}
          <div className="hidden md:flex w-full h-[99%]">
            <Allotment defaultSizes={[300, 700]}>
              <Allotment.Pane minSize={150}>
                <div className="h-full overflow-auto bg-transparent">
                  <Supplements2 />
                </div>
              </Allotment.Pane>
              <Allotment.Pane minSize={200}>
                <div className="h-full overflow-auto bg-transparent">
                  <Supplements />
                </div>
              </Allotment.Pane>
            </Allotment>
          </div>
        </div>

      );
    } else {
      // No Reading chat - Show prompt to create one
      content = (
        <div className="flex flex-col w-full h-full">
          <h1 className="mx-auto font-bold text-3xl dark:text-zinc-100 text-indigo-500 my-auto text-center px-4">
            Create a reading chat to get started!
          </h1>
          <button
            className="bg-indigo-500 text-white dark:bg-zinc-300 dark:text-zinc-900 hover:dark:bg-zinc-900 transform duration-300 hover:dark:text-zinc-200 p-5 mb-auto mx-auto w-[12rem] rounded-lg font-semibold flex items-center justify-center space-x-2" // Increased width slightly for icon
            onClick={glowChatCreation}
          >
            <PlusCircleIcon size={20} />
            <span>Create chat</span>
          </button>
        </div>
      );
    }
  } else {
    // --- Writing Mode --- (implicitly !readingState)
    if (wChatID) {
      // Writing chat exists - Show Writing Supplements
      content = (
        // Assuming WritingSupplements handles its own layout
        <WritingSupplements />
      );
    } else {
      // No Writing chat - Show prompt to create one
      content = (
        <div className="flex flex-col w-full h-full">
          <h1 className="mx-auto font-bold text-3xl dark:text-zinc-100 text-indigo-500 my-auto text-center px-4">
            Create a writing chat to get started!
          </h1>
          <button
            className="bg-indigo-500 text-white dark:bg-zinc-200 dark:text-zinc-900 hover:dark:bg-zinc-800 hover:dark:text-zinc-200 transform duration-300 font-semibold p-5 mb-auto mx-auto w-[12rem] rounded-lg flex items-center justify-center space-x-2" // Increased width slightly for icon
            onClick={glowChatCreation}
          >
            <PlusCircleIcon size={20} />
            <span>Create chat</span>
          </button>
        </div>
      );
    }
  }

  // Render the main structure with the determined content
  return (
    // Main Container - Existing classes maintained
    <div className="flex flex-row w-full md:h-screen h-[200vh] bg-lue-300 relative bg--400">
      {/* Mobile Overlay - Logic maintained */}
      <div className={`flex flex-col absolute top-0 w-full h-full opacity-50 bg-[#7F7F7F] transition-opacity duration-300 ${isMobile ? (isOpen ? "visible opacity-50" : "invisible opacity-0") : 'hidden'}`}></div>

      {/* Render the determined content */}
      {content}
    </div>
  );
}