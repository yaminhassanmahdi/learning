"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { AuroraText } from "@/components/magicui/aurora-text";

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
  create_ChatGlow, // Kept in case used elsewhere, but glow effect removed from input
} from "../../store/uploadAtoms"; // Adjust path if needed
import Link from "next/link";
import { useRouter } from 'next/navigation';

import {
  DeleteIcon, PlusCircleIcon, LogOutIcon, LogInIcon,
  Edit3Icon, BookOpenIcon, XIcon, CheckIcon,
  BarChartIcon, RefreshCwIcon, BarChart2Icon,
  ChevronDownIcon,
  AlertTriangleIcon,
  PlusIcon // Added PlusIcon for new buttons
} from "lucide-react";
import { IoSend, IoWarningOutline, IoCloseCircleOutline, IoTimerOutline } from 'react-icons/io5'; // Keep icons
import { supabase } from "../lib/supabaseClient"; // Adjust path if needed
import useIsMobile from "./useIsMobile";       // Adjust path if needed
import LoadingSpinner from './LoadingSpinner.jsx'; // Adjust path if needed

// --- Constants ---
const CHAT_TYPE = {
  READING: 'chats',
  WRITING: 'writing_chats',
};
const MAX_READING_CHATS = 100;
const MAX_WRITING_CHATS = 20;
const USAGE_RESET_INTERVAL_DAYS = 7;
const DEFAULT_USAGE_LIMIT = 10;
const NEW_CHAT_DEFAULT_TITLE = "New chat"; // Constant for the new chat title

// --- Helper Functions ---
const categorizeDate = (dateString) => {
  // (Keep existing categorizeDate function as is)
  const now = new Date();
  const cardDate = new Date(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - USAGE_RESET_INTERVAL_DAYS);

  cardDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  lastWeek.setHours(0, 0, 0, 0);

  if (cardDate.getTime() === today.getTime()) return "Today";
  if (cardDate.getTime() === yesterday.getTime()) return "Yesterday";
  if (cardDate > lastWeek && cardDate < today) return `Previous ${USAGE_RESET_INTERVAL_DAYS} Days`;
  if (cardDate <= lastWeek) return "Older";

  return "Older";
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

// --- Component ---
const SideBar = () => {
  // --- State and Atoms ---
  const [readingChatID, setReadingChatID] = useAtom(chat_id_supabase);
  const [readingChats, setReadingChats] = useAtom(chats_supabase_state);
  const [writingChatID, setWritingChatID] = useAtom(writing_chat_id_supabase);
  const [writingChats, setWritingChats] = useState([]); // Keep separate state for writing chats
  const [uid, setUID] = useAtom(user_id_supabase);
  const [activeReadingChatId, setActiveReadingChatId] = useAtom(activeChat);
  const [activeWritingChatId, setActiveWritingChatId] = useAtom(activeWritingChat);
  const [userEmail, setUserEmail] = useAtom(userEmail_state);
  const [readingState, setReadingState] = useAtom(reading_State);
  const [isOpen, setIsOpen] = useAtom(sideBar_state);
  // Removed unused Jotai setters if only needed for logout previously
  const [, setQuizQuestions] = useAtom(quizQuestions);
  const [, setFlashCards] = useAtom(flashCardsState);
  const [, setSummaryS] = useAtom(summaryState);
  const [, setFile_id_s] = useAtom(file_id_supabase);
  const [, setFileContentsS] = useAtom(file_contents_supabase);
  const [, setFileURLSupabase] = useAtom(file_url_supabase);
  // Removed buttonGlow usage as input is removed
  const router = useRouter();

  // REMOVED: newChatName state
  // REMOVED: showCreateOptions state

  // Loading states
  const [isLoading, setIsLoading] = useState(false); // For initial data load
  const [isCreatingChat, setIsCreatingChat] = useState(false); // For the new unified create process
  const [isDeletingChat, setIsDeletingChat] = useState(null); // { id: string, type: string } | null

  // State for Editing
  const [editingChat, setEditingChat] = useState(null); // { id: string, type: string, originalTitle: string } | null
  const [editedName, setEditedName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef(null);

  // State for Usage
  const [userUsage, setUserUsage] = useState(null);
  const [isResettingUsage, setIsResettingUsage] = useState(false);

  const isMobile = useIsMobile();

  // --- Usage Reset Logic (Keep as is) ---
  const handleUsageReset = useCallback(async (userId) => {
    console.log("SideBar: Attempting usage reset for user:", userId);
    setIsResettingUsage(true);
    try {
      const columnsToReset = {
        summary_count: DEFAULT_USAGE_LIMIT, ai_notes_count: DEFAULT_USAGE_LIMIT, flashcard_count: DEFAULT_USAGE_LIMIT,
        quiz_count: DEFAULT_USAGE_LIMIT, paraphrase_count: DEFAULT_USAGE_LIMIT, ai_check_count: DEFAULT_USAGE_LIMIT,
        humanizer_count: DEFAULT_USAGE_LIMIT, grammer_check_count: DEFAULT_USAGE_LIMIT, chat_request_count: DEFAULT_USAGE_LIMIT,
        last_reset: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('user_usage').update(columnsToReset).eq('user_id', userId);
      if (error) throw error;
      console.log("SideBar: Usage reset successful for user:", userId, data);
      setUserUsage(prev => ({ ...prev, ...columnsToReset }));
    } catch (error) {
      console.error("SideBar: Error resetting user usage:", error);
    } finally {
      setIsResettingUsage(false);
    }
  }, []);

  // --- Data Fetching (Keep mostly as is) ---
  const fetchAllData = useCallback(async () => {
    if (!uid) {
      setReadingChats([]); setWritingChats([]); setUserUsage(null); setIsLoading(false);
      return;
    };
    setIsLoading(true);
    setEditingChat(null);
    try {
      const [readingRes, writingRes, usageRes] = await Promise.all([
        supabase.from(CHAT_TYPE.READING).select("*").eq("user_id", uid).order('created_at', { ascending: false }),
        supabase.from(CHAT_TYPE.WRITING).select("*").eq("user_id", uid).order('created_at', { ascending: false }),
        supabase.from('user_usage').select('summary_count, ai_notes_count, flashcard_count, quiz_count, paraphrase_count, ai_check_count, humanizer_count, grammer_check_count, chat_request_count, last_reset, is_premium, exm_prep_count').eq('user_id', uid).maybeSingle()
      ]);

      // Process Chats
      const readingData = readingRes.data || [];
      const writingData = writingRes.data || [];
      setReadingChats(readingData);
      setWritingChats(writingData);

      // Set Initial Active Chat Logic
      const currentReadingActiveValid = readingData.some(c => c.id === activeReadingChatId);
      const currentWritingActiveValid = writingData.some(c => c.id === activeWritingChatId);
      let effectiveActiveReadingId = currentReadingActiveValid ? activeReadingChatId : null;
      let effectiveActiveWritingId = currentWritingActiveValid ? activeWritingChatId : null;
      if (!effectiveActiveReadingId && !effectiveActiveWritingId) {
        if (readingData.length > 0) { effectiveActiveReadingId = readingData[0].id; setReadingState(true); }
        else if (writingData.length > 0) { effectiveActiveWritingId = writingData[0].id; setReadingState(false); }
        else { setReadingState(true); }
      } else {
        if (effectiveActiveReadingId) { setReadingState(true); effectiveActiveWritingId = null; }
        else if (effectiveActiveWritingId) { setReadingState(false); effectiveActiveReadingId = null; }
      }
      setActiveReadingChatId(effectiveActiveReadingId); setReadingChatID(effectiveActiveReadingId);
      setActiveWritingChatId(effectiveActiveWritingId); setWritingChatID(effectiveActiveWritingId);

      // Process Usage Data and Check for Reset
      if (usageRes.error) { console.error("Error fetching user usage:", usageRes.error); setUserUsage(null); }
      else {
        const usageData = usageRes.data;
        setUserUsage(usageData);
        if (usageData && !usageData.is_premium && usageData.last_reset) {
          const lastResetDate = new Date(usageData.last_reset);
          const now = new Date();
          const resetIntervalMs = USAGE_RESET_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
          if (now.getTime() - lastResetDate.getTime() >= resetIntervalMs) {
            console.log("SideBar: Usage reset interval reached. Triggering reset...");
            handleUsageReset(uid);
          } else { console.log("SideBar: Usage reset interval not yet reached."); }
        } else if (usageData && !usageData.last_reset && !usageData.is_premium) {
          console.log("SideBar: First time check or last_reset is null. Setting initial reset.");
          handleUsageReset(uid);
        }
      }
    } catch (err) {
      console.error("Unexpected error in fetchAllData:", err);
      setReadingChats([]); setWritingChats([]); setUserUsage(null); setActiveReadingChatId(null); setReadingChatID(null); setActiveWritingChatId(null); setWritingChatID(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    uid, setReadingChats, setWritingChats, setUserUsage, handleUsageReset,
    setReadingChatID, setActiveReadingChatId,
    setWritingChatID, setActiveWritingChatId,
    setReadingState, activeReadingChatId, activeWritingChatId
  ]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Chat Categorization (Keep as is) ---
  const categorizeChats = useCallback((chats) => {
    const categorized = { Today: [], Yesterday: [], [`Previous ${USAGE_RESET_INTERVAL_DAYS} Days`]: [], Older: [] };
    if (!chats) return categorized;
    chats.forEach((card) => {
      const category = categorizeDate(card.created_at);
      if (categorized[category]) categorized[category].push(card);
      else categorized['Older'].push(card);
    });
    return categorized;
  }, []);

  const categorizedReadingChats = useMemo(() => categorizeChats(readingChats), [readingChats, categorizeChats]);
  const categorizedWritingChats = useMemo(() => categorizeChats(writingChats), [writingChats, categorizeChats]);

  // --- Chat Actions ---

  // REMOVED: handleInitiateCreateChat
  const handleCancelEdit = useCallback(() => {
    setEditingChat(null);
    setEditedName("");
  }, []);
  // *** NEW Unified Chat Creation Function ***
  const handleCreateNewChat = useCallback(async (chatType) => {
    if (isCreatingChat || !uid) return;

    // Check limits before proceeding
    if (chatType === CHAT_TYPE.READING && readingChats.length >= MAX_READING_CHATS) {
      alert(`Limit of ${MAX_READING_CHATS} Reading chats reached.`);
      return;
    }
    if (chatType === CHAT_TYPE.WRITING && writingChats.length >= MAX_WRITING_CHATS) {
      alert(`Limit of ${MAX_WRITING_CHATS} Writing chats reached.`);
      return;
    }

    handleCancelEdit(); // Cancel edit if ongoing
    setIsCreatingChat(true);
    const title = NEW_CHAT_DEFAULT_TITLE;

    try {
      const { data: newChat, error } = await supabase.from(chatType).insert({ user_id: uid, title: title }).select().single();
      if (error) { throw error; }

      if (newChat) {
        if (chatType === CHAT_TYPE.READING) {
          setReadingChats((prev) => [newChat, ...prev]);
          setActiveReadingChatId(newChat.id); setReadingChatID(newChat.id);
          setReadingState(true);
          setActiveWritingChatId(null); setWritingChatID(null); // Deactivate other type
        } else { // WRITING
          setWritingChats((prev) => [newChat, ...prev]);
          setActiveWritingChatId(newChat.id); setWritingChatID(newChat.id);
          setReadingState(false);
          setActiveReadingChatId(null); setReadingChatID(null); // Deactivate other type
        }
        if (isMobile) setIsOpen(false); // Close sidebar on mobile after creation
      } else {
        console.warn('Chat created but no data returned.');
        alert('Chat created, but there was an issue displaying it immediately.');
      }
    } catch (error) {
      console.error(`Error creating ${chatType} chat:`, error.message);
      alert(`Failed to create chat: ${error.message}`);
    } finally {
      setIsCreatingChat(false);
    }
  }, [
    isCreatingChat, uid, readingChats.length, writingChats.length, // Use lengths for limit check
    setReadingChats, setActiveReadingChatId, setReadingChatID,
    setWritingChats, setActiveWritingChatId, setWritingChatID,
    setReadingState, isMobile, setIsOpen, handleCancelEdit // Added handleCancelEdit dependency
  ]);

  // --- Deletion, Selection, Editing Functions (Keep mostly as is) ---
  const handleDeleteChat = useCallback(async (chatIdToDelete, chatType) => {
    if (!chatIdToDelete || isDeletingChat || isSavingEdit) return;
    if (editingChat?.id === chatIdToDelete && editingChat?.type === chatType) handleCancelEdit();
    if (!window.confirm(`Delete this ${chatType === CHAT_TYPE.READING ? 'Reading' : 'Writing'} chat? This is permanent.`)) return;

    setIsDeletingChat({ id: chatIdToDelete, type: chatType });
    try {
      const { error } = await supabase.from(chatType).delete().eq("id", chatIdToDelete);
      if (error) { throw error; }

      let nextActiveId = null;
      let switchToOtherType = false;
      let newReadingState = readingState;

      if (chatType === CHAT_TYPE.READING) {
        const remainingChats = readingChats.filter((chat) => chat.id !== chatIdToDelete);
        setReadingChats(remainingChats);
        if (activeReadingChatId === chatIdToDelete) {
          if (remainingChats.length > 0) { nextActiveId = remainingChats[0].id; newReadingState = true; }
          else if (writingChats.length > 0) { switchToOtherType = true; nextActiveId = writingChats[0].id; newReadingState = false; }
          else { nextActiveId = null; newReadingState = true; }
          setActiveReadingChatId(switchToOtherType ? null : nextActiveId); setReadingChatID(switchToOtherType ? null : nextActiveId);
        }
      } else { // WRITING
        const remainingChats = writingChats.filter((chat) => chat.id !== chatIdToDelete);
        setWritingChats(remainingChats);
        if (activeWritingChatId === chatIdToDelete) {
          if (remainingChats.length > 0) { nextActiveId = remainingChats[0].id; newReadingState = false; }
          else if (readingChats.length > 0) { switchToOtherType = true; nextActiveId = readingChats[0].id; newReadingState = true; }
          else { nextActiveId = null; newReadingState = true; } // Default to reading state if both empty
          setActiveWritingChatId(switchToOtherType ? null : nextActiveId); setWritingChatID(switchToOtherType ? null : nextActiveId);
        }
      }

      if (switchToOtherType) {
        if (newReadingState) {
          setActiveReadingChatId(nextActiveId); setReadingChatID(nextActiveId); setActiveWritingChatId(null); setWritingChatID(null);
        } else {
          setActiveWritingChatId(nextActiveId); setWritingChatID(nextActiveId); setActiveReadingChatId(null); setReadingChatID(null);
        }
      }
      setReadingState(newReadingState);

    } catch (error) {
      console.error(`Error deleting ${chatType} chat:`, error.message); alert(`Failed to delete chat: ${error.message}`);
    } finally { setIsDeletingChat(null); }
  }, [
    isDeletingChat, isSavingEdit, editingChat, readingChats, writingChats, activeReadingChatId, activeWritingChatId,
    setReadingChats, setWritingChats, setActiveReadingChatId, setReadingChatID,
    setActiveWritingChatId, setWritingChatID, setReadingState, readingState, handleCancelEdit // Added handleCancelEdit
  ]);

  const handleSelectChat = useCallback((card, chatType) => {
    if (isSavingEdit) return;
    handleCancelEdit();
    if (chatType === CHAT_TYPE.READING) {
      setReadingChatID(card.id); setActiveReadingChatId(card.id); setReadingState(true); setActiveWritingChatId(null); setWritingChatID(null);
    } else {
      setWritingChatID(card.id); setActiveWritingChatId(card.id); setReadingState(false); setActiveReadingChatId(null); setReadingChatID(null);
    }
    if (isMobile) setIsOpen(false);
  }, [
    setReadingChatID, setActiveReadingChatId, setWritingChatID, setActiveWritingChatId,
    setReadingState, isMobile, setIsOpen, isSavingEdit, handleCancelEdit // Added handleCancelEdit
  ]);

  const handleStartEdit = useCallback((chat, chatType) => {
    if (isSavingEdit || isCreatingChat || isDeletingChat) return;
    handleCancelEdit();
    setEditingChat({ id: chat.id, type: chatType, originalTitle: chat.title });
    setEditedName(chat.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, [isSavingEdit, isCreatingChat, isDeletingChat, handleCancelEdit]); // Added handleCancelEdit



  const handleSaveEdit = useCallback(async () => {
    if (!editingChat || !editedName.trim() || isSavingEdit) return;
    const { id, type, originalTitle } = editingChat;
    const newTitle = editedName.trim();
    if (newTitle === originalTitle) { handleCancelEdit(); return; }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase.from(type).update({ title: newTitle }).eq('id', id);
      if (error) { throw error; }
      if (type === CHAT_TYPE.READING) { setReadingChats(prev => prev.map(chat => chat.id === id ? { ...chat, title: newTitle } : chat)); }
      else { setWritingChats(prev => prev.map(chat => chat.id === id ? { ...chat, title: newTitle } : chat)); }
      console.log(`Chat ${id} title updated successfully.`);
      handleCancelEdit();
    } catch (error) {
      console.error(`Error updating chat ${id} title:`, error); alert(`Failed to update chat title: ${error.message}`);
    } finally { setIsSavingEdit(false); }
  }, [editingChat, editedName, isSavingEdit, setReadingChats, setWritingChats, handleCancelEdit]);

  // --- Logout Function (Keep as is, ensure usage state cleared) ---
  const handleLogout = useCallback(async () => {
    handleCancelEdit(); // Cancel any edit on logout
    setUID(null); setUserEmail(null); setReadingChats([]); setWritingChats([]); setReadingChatID(null); setWritingChatID(null); setActiveReadingChatId(null); setActiveWritingChatId(null); setReadingState(true); setFileURLSupabase(null); setQuizQuestions(null); setSummaryS(null); setFlashCards(null); setFile_id_s(null); setFileContentsS(null); setIsOpen(false);
    setUserUsage(null); // Clear usage data
  }, [
    handleCancelEdit, setUID, setUserEmail, setReadingChats, setWritingChats, setReadingChatID,
    setWritingChatID, setActiveReadingChatId, setActiveWritingChatId, setReadingState,
    setFileURLSupabase, setQuizQuestions, setSummaryS, setFlashCards, setFile_id_s,
    setFileContentsS, setIsOpen, setUserUsage
  ]);

  // --- Render Helper for Chat Lists (Modified for Edit UI + New "+" Button Integration) ---
  const renderChatSection = useCallback((chatList, chatType, categorizedChats) => {
    if (!chatList) return null;
    const currentActiveId = chatType === CHAT_TYPE.READING ? activeReadingChatId : activeWritingChatId;
    const categoriesWithChats = Object.entries(categorizedChats).filter(([_, chats]) => chats.length > 0);

    if (categoriesWithChats.length === 0 && chatList.length > 0) {
      console.warn("Categorization mismatch or empty categories with non-empty list.");
      return <div className="text-xs text-gray-500 dark:text-zinc-400 px-1">Error displaying chats.</div>;
    }

    return categoriesWithChats.map(([category, chatsInCategory]) => (
      <div key={`${chatType}-${category}`}>
        <div className="text-xs font-semibold dark:text-zinc-400 text-gray-400 mt-3 px-1 uppercase tracking-wide">
          {category}
        </div>
        <div className="flex flex-col space-y-1 mt-1">
          {chatsInCategory.map((card) => {
            const isCurrentlyDeleting = isDeletingChat?.id === card.id && isDeletingChat?.type === chatType;
            const isAnyDeleteActive = !!isDeletingChat;
            const isCurrentlyEditing = editingChat?.id === card.id && editingChat?.type === chatType;
            const isAnyEditActive = !!editingChat;
            const isThisChatActive = currentActiveId === card.id;

            if (isCurrentlyEditing) {
              // --- Render Edit Mode ---
              return (
                <div key={`${card.id}-edit`} className="p-1.5 w-full rounded-md bg-slate-100 dark:bg-zinc-700 flex flex-row items-center space-x-1.5">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                    className="flex p-1.5 w-full border rounded text-sm bg-white dark:bg-zinc-800 dark:text-zinc-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-slate-300 dark:border-zinc-600"
                    disabled={isSavingEdit}
                    aria-label="Edit chat name"
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editedName.trim() || editedName.trim() === editingChat?.originalTitle}
                    className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save changes"
                  >
                    {isSavingEdit ? <LoadingSpinner size={16} /> : <CheckIcon size={16} />}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSavingEdit}
                    className="p-1 rounded bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                    aria-label="Cancel edit"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              );
            } else {
              // --- Render Normal/View Mode ---
              return (
                <div
                  key={card.id}
                  className={`p-2 w-full rounded-md text-sm dark:text-zinc-200 text-gray-800 flex items-center justify-between cursor-pointer group transition-colors duration-150 relative ${isThisChatActive
                    ? "bg-slate-200 dark:bg-zinc-700/70 font-medium"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800"
                    } ${isAnyEditActive ? 'opacity-50 pointer-events-none' : ''} `} // Dim non-editing items more
                  onClick={isAnyEditActive ? undefined : () => handleSelectChat(card, chatType)}
                >
                  <span className="truncate flex-grow mr-2">{card.title}</span>
                  <div className={`flex items-center space-x-1 transition-opacity duration-150 ${isThisChatActive ? 'opacity-100' : 'md:opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                    {/* Edit Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(card, chatType); }}
                      disabled={isAnyEditActive || isAnyDeleteActive || isCreatingChat} // Also disable if creating chat
                      className={`p-1 rounded text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed`}
                      aria-label={`Edit chat ${card.title}`}
                    >
                      <Edit3Icon size={15} />
                    </button>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(card.id, chatType); }}
                      disabled={isAnyEditActive || isAnyDeleteActive || isCreatingChat} // Also disable if creating chat
                      className={`p-1 rounded text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed ${isCurrentlyDeleting ? 'opacity-100' : ''}`}
                      aria-label={`Delete chat ${card.title}`}
                    >
                      {isCurrentlyDeleting ? <LoadingSpinner size={15} /> : <DeleteIcon size={15} />}
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    )).filter(Boolean);
  }, [
    activeReadingChatId, activeWritingChatId, isDeletingChat, editingChat, editedName, isSavingEdit, isCreatingChat, // Added isCreatingChat
    handleSelectChat, handleDeleteChat, handleStartEdit, handleSaveEdit, handleCancelEdit
  ]);

  // --- Render Helper for Usage Display (Keep mostly as is) ---
  const renderUsageDisplay = () => {
    const [isUsageExpanded, setIsUsageExpanded] = useState(false);

    const hasLowUsage = useMemo(() => {
      if (!userUsage || userUsage.is_premium) return false;
      const counts = [
        userUsage.chat_request_count, userUsage.summary_count, userUsage.ai_notes_count,
        userUsage.flashcard_count, userUsage.quiz_count, userUsage.paraphrase_count,
        userUsage.ai_check_count, userUsage.humanizer_count, userUsage.grammer_check_count,
      ];
      return counts.some(count => count != null && count <= 3);
    }, [userUsage]);

    if (!uid) return null;

    if (isLoading && !userUsage) {
      return <div className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 border-t border-slate-200 dark:border-zinc-700"><LoadingSpinner size={12} /> Loading usage...</div>;
    }
    if (!userUsage && !isLoading) {
      return <div className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-700">Usage data unavailable.</div>;
    }
    if (userUsage.is_premium) {
      return <div className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium border-t border-slate-200 dark:border-zinc-700 bg-emerald-50 dark:bg-emerald-900/30 rounded-b-md mx-2 my-2 shadow-inner">✨ Premium Plan: Unlimited Usage</div>;
    }

    // Non-Premium Collapsible Display
    const usageItems = [
      { label: "Chats", count: userUsage.chat_request_count }, { label: "Summaries", count: userUsage.summary_count }, { label: "AI Notes", count: userUsage.ai_notes_count },
      { label: "Flashcards", count: userUsage.flashcard_count }, { label: "Quizzes", count: userUsage.quiz_count }, { label: "Paraphrase", count: userUsage.paraphrase_count },
      { label: "AI Check", count: userUsage.ai_check_count }, { label: "Humanizer", count: userUsage.humanizer_count }, { label: "Grammar", count: userUsage.grammer_check_count }, { label: "Exam prep", count: userUsage.exm_prep_count },
    ];
    const nextResetDate = new Date(userUsage.last_reset || Date.now());
    nextResetDate.setDate(nextResetDate.getDate() + USAGE_RESET_INTERVAL_DAYS);

    return (
      <div className="px-2 pt-2 pb-1 border-t border-slate-200 dark:border-zinc-700">
        <button
          onClick={() => setIsUsageExpanded(!isUsageExpanded)}
          className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-left hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-zinc-900"
          aria-expanded={isUsageExpanded} aria-controls="usage-details"
        >
          <div className="flex items-center gap-2">
            <IoTimerOutline className="text-indigo-600 dark:text-indigo-400 h-5 w-5" />
            <span className="font-medium text-sm text-slate-700 dark:text-zinc-200">Usage Details</span>
            {hasLowUsage && !isUsageExpanded && (<AlertTriangleIcon size={14} className="text-orange-500 animate-pulse" title="Some limits are low!" />)}
          </div>
          <div className="flex items-center gap-1">
            {isResettingUsage && <LoadingSpinner size={12} />}
            <ChevronDownIcon size={18} className={`text-slate-500 dark:text-zinc-400 transition-transform duration-300 ${isUsageExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        <div
          id="usage-details"
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isUsageExpanded ? 'max-h-[300px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}
        >
          <div className="px-2 py-2 space-y-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50 rounded-md border dark:border-zinc-700/50">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-3 gap-y-1.5">
              {usageItems.map(item => (
                <div key={item.label} className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-200 dark:border-zinc-700/60 pb-0.5">
                  <span className="opacity-80">{item.label}: </span>
                  <span className={`font-semibold ${item.count <= 2 ? 'text-red-600 dark:text-red-500' : item.count <= 5 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-zinc-200'}`}>
                    {item.count ?? 'N/A'}
                  </span>
                </div>
              ))}
            </div>
            {/* <div className="text-[10px] opacity-80 pt-1 flex items-center gap-1 justify-start">
              <Link href="/one" className="text-[15px] text-blue-300 underline">Upgrade for just 4.99$</Link>
            </div> */}
            <div className="text-[10px] opacity-80 pt-1 flex items-center gap-1 justify-end">
              <RefreshCwIcon size={10} /> Resets on: {formatDate(nextResetDate)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Component Render ---
  return (
    <div
      className={`fixed top-0 left-0 z-50 flex h-screen w-[16rem] flex-col bg-white shadow-lg dark:bg-zinc-900 dark:shadow-zinc-800/50 transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Sidebar"
    >
      {/* Header */}
      <div className="flex items-center mt- justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
        <AuroraText colors={["#FF0080", "#7928CA", "#0070F3", "#38bdf8"]} speed={2} className='text-[2rem]'>Learningly</AuroraText>
      </div>

      {/* Support Link */}
      <a
        className="italic underline text-blue-400 text-[13px] mt-2 mx-4"
        href="https://mail.google.com/mail/?view=cm&fs=1&to=arefinanwar112@gmail.com&su=Help%20Needed&body=Hi,%20I%20need%20help%20with..."
        target="_blank" rel="noopener noreferrer"
      >
        Have suggestions? Need support?
      </a>

      {/* User Email */}
      {userEmail && (
        <div className="px-4 py-2 text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700 truncate flex-shrink-0">
          Logged in as: {userEmail}
        </div>
      )}

      {/* Usage Display Section */}
      {renderUsageDisplay()}

      {/* Chat List Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-zinc-600 scrollbar-track-gray-200 dark:scrollbar-track-zinc-800">
        {isLoading ? (
          <div className="flex justify-center items-center h-full pt-10"> <LoadingSpinner size={24} /> </div>
        ) : (
          <>
            {/* Reading Chats Section */}
            <section className="mb-4" aria-labelledby="reading-chats-heading">
              <div className="flex items-center justify-between  bg-white dark:bg-zinc-900 py-1 z-10 px-1">
                <h3 id="reading-chats-heading" className="text-base font-semibold dark:text-zinc-300 text-gray-700 flex items-center gap-2">
                  <BookOpenIcon size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" /> Reading Chats
                </h3>
                {/* Add New Reading Chat Button */}
                <button
                  onClick={() => handleCreateNewChat(CHAT_TYPE.READING)}
                  disabled={isCreatingChat || isLoading || !!editingChat || readingChats.length >= MAX_READING_CHATS}
                  className="p-1 rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={readingChats.length >= MAX_READING_CHATS ? `Limit of ${MAX_READING_CHATS} reached` : "Create new Reading chat"}
                  aria-label="Create new Reading chat"
                >
                  {isCreatingChat ? <LoadingSpinner size={16} /> : <PlusIcon size={18} />}
                </button>
              </div>
              {renderChatSection(readingChats, CHAT_TYPE.READING, categorizedReadingChats)}
              {!isLoading && readingChats.length === 0 && uid && (<p className="text-center text-xs text-slate-400 dark:text-zinc-500 mt-2 px-1 italic">No reading chats.</p>)}
            </section>

            <hr className="border-slate-200 dark:border-zinc-700 my-3" />

            {/* Writing Chats Section */}
            {/* <section className="mb-4" aria-labelledby="writing-chats-heading">
              <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 py-1 z-10 px-1">
                <h3 id="writing-chats-heading" className="text-base font-semibold dark:text-zinc-300 text-gray-700 flex items-center gap-2">
                  <Edit3Icon size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" /> Writing Chats
                </h3>
                <button
                  onClick={() => handleCreateNewChat(CHAT_TYPE.WRITING)}
                  disabled={isCreatingChat || isLoading || !!editingChat || writingChats.length >= MAX_WRITING_CHATS}
                  className="p-1 rounded-md text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={writingChats.length >= MAX_WRITING_CHATS ? `Limit of ${MAX_WRITING_CHATS} reached` : "Create new Writing chat"}
                  aria-label="Create new Writing chat"
                >
                  {isCreatingChat ? <LoadingSpinner size={16} /> : <PlusIcon size={18} />}
                </button>
              </div>
              {renderChatSection(writingChats, CHAT_TYPE.WRITING, categorizedWritingChats)}
              {!isLoading && writingChats.length === 0 && uid && (<p className="text-center text-xs text-slate-400 dark:text-zinc-500 mt-2 px-1 italic">No writing chats.</p>)}
            </section> */}

            {/* Overall empty state */}
            {!isLoading && readingChats.length === 0 && writingChats.length === 0 && uid && (
              <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mt-6 px-2">
                Click '+' above to create a chat.
              </p>
            )}
          </>
        )}
      </div>

      {/* Bottom Controls Area - Only Logout/Login */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-700 flex-shrink-0">
        {uid ? (
          // Logout Button
          <button
            onClick={handleLogout}
            disabled={isCreatingChat || isLoading || !!isDeletingChat || !!editingChat} // Disable during any operation
            className="w-full px-4 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:dark:bg-red-900 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOutIcon size={16} />
            Logout
          </button>
        ) : (
          // Login Button
          <Link href="/login" className="block">
            <button className="w-full px-4 py-2 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors duration-200">
              <LogInIcon size={16} />
              Sign In
            </button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default SideBar;