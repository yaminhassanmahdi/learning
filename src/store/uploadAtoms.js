import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { supabase } from "../app/lib/supabaseClient";
export const fileAtom = atomWithStorage("fileAtom", null);
export const textAtom = atom("textAtom");
export const fileNameAtom = atomWithStorage("fileNameAtom", "");
export const quizQuestions = atomWithStorage("quizQuestions", []);
export const flashCardsState = atomWithStorage("flashCardsState", "");
export const summaryState = atomWithStorage("summaryState", "");
export const userAtom = atom(null);
export const chats_supabase_state = atomWithStorage("chas", "");
export const files_supabase_state = atomWithStorage("files", "");
export const user_id_supabase = atomWithStorage("uid", "");
export const file_id_supabase = atomWithStorage("fid", "");
export const file_contents_supabase = atom("d");
export const chat_id_supabase = atomWithStorage("cid", "");
export const writing_chat_id_supabase = atomWithStorage("wcid", "");
export const file_url_supabase = atomWithStorage("file_url", "");
export const showSupplements = atomWithStorage("show_supplements", "");
export const notes_supabase = atomWithStorage("user_notes", "");
export const activeChat = atomWithStorage("activeChatName", "");
export const activeWritingChat = atomWithStorage("activeWritingChat", "");
export const userEmail_state = atomWithStorage("user_email", "");
export const sideBar_state = atomWithStorage("sidebar", false);
export const reading_State = atomWithStorage("rs", true);
export const create_ChatGlow = atomWithStorage("createChatGlow", "");
export const ai_notes_state = atomWithStorage("ai_notes", "");
export const said_doesnt_have_credit_state = atomWithStorage("said_doesnt_have_credit_state", false);
export const quizDifficultyAtom = atom("all");
export const userIsFirstTryAtom = atomWithStorage("is_quiz-1st", true);
export const centralTab = atomWithStorage("cebtralTab", "summary");
export const smcomplx = atomWithStorage("fallll", "fal");
export const memesState = atom([]);







