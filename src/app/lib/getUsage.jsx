// FILE: src/app/lib/getUsage.jsx

import { supabase } from "@/app/lib/supabaseClient"; 
import { user_id_supabase } from "../../store/uploadAtoms";
import { useAtomValue } from 'jotai';
import { useCallback } from 'react';

// Ensure the 'export' keyword is present and it's 'const'
export const useUserActivityAPI = () => {
    const userId = useAtomValue(user_id_supabase);

    const getUserActivityUsage = useCallback(async (activityName, setError) => {
        // ... (your implementation from the previous example)
        if (!userId) {
            const msg = "User ID is missing. Cannot check usage. (From useUserActivityAPI)";
            console.error("UsageAPI:", msg);
            if (setError) setError("User information not available. Cannot check usage.");
            return null;
        }
        // ... rest of the function
        const activityToColumnMap = {
            "summary": "summary_count",
            "ai_notes": "ai_notes_count",
            "flashcard": "flashcard_count",
            "quiz": "quiz_count",
            "paraphrase": "paraphrase_count",
            "ai_check": "ai_check_count",
            "humanizer": "humanizer_count",
            "grammar_check": "grammer_check_count", 
            "chat_request": "chat_request_count",
            "exm_prep": "exm_prep_count",
            "per_w": "per_w_count",                 // Added
            "solver_chat": "solver_chat_count",     // Added
            "general_chat": "general_chat_count",   // Added
            "memes": "meme_count"                   // Added
        };
        const columnName = activityToColumnMap[activityName.toLowerCase()];

        if (!columnName) {
            const msg = `Activity name '${activityName}' is not mapped to a column. (From useUserActivityAPI)`;
            console.error("UsageAPI:", msg);
            if (setError) setError(`Invalid activity: ${activityName}.`);
            return null;
        }


        try {
            console.log(`UsageAPI: Fetching '${columnName}' for user: ${userId}`);
            const { data, error: fetchError } = await supabase
                .from('user_usage')
                .select(columnName)
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) {
                console.error(`UsageAPI: Error fetching '${columnName}' for user ${userId}:`, fetchError);
                if (setError) setError(`Failed to fetch usage for ${activityName}.`);
                return null;
            }
            if (!data) {
                console.log(`UsageAPI: No usage data found for '${columnName}', user ${userId}. Returning 0.`);
                return 0; // If no record, assume count is 0
            }
            const count = data[columnName] ?? 0;
            console.log(`UsageAPI: Fetched '${columnName}': ${count}`);
            return count;
        } catch (err) {
            console.error(`UsageAPI: Exception fetching '${columnName}' for user ${userId}:`, err);
            if (setError) setError(`An error occurred while fetching usage for ${activityName}.`);
            return null;
        }

    }, [userId, supabase]); // Added supabase to dependency array if it can change, or ensure it's stable

    const decrementUserActivityUsage = useCallback(async (activityName, setError) => {
        if (!userId) {
            const msg = "User ID is missing. Cannot decrement usage. (From useUserActivityAPI)";
            console.error("UsageAPI:", msg);
            if (setError) setError("User information not available. Cannot update usage.");
            return false;
        }

        const activityToColumnMap = {
            "summary": "summary_count",
            "ai_notes": "ai_notes_count",
            "flashcard": "flashcard_count",
            "quiz": "quiz_count",
            "paraphrase": "paraphrase_count",
            "ai_check": "ai_check_count",
            "humanizer": "humanizer_count",
            "grammar_check": "grammer_check_count", // Note: "grammer_check_count" was in your original, consider if it should be "grammar_check_count"
            "chat_request": "chat_request_count",
            "exm_prep": "exm_prep_count",
            "per_w": "per_w_count",                 // Added
            "solver_chat": "solver_chat_count",     // Added
            "general_chat": "general_chat_count",   // Added
            "memes": "meme_count"                   // Added
        };
        const columnName = activityToColumnMap[activityName.toLowerCase()];

        if (!columnName) {
            const msg = `Activity name '${activityName}' is not mapped to a column for decrement. (From useUserActivityAPI)`;
            console.error("UsageAPI:", msg);
            if (setError) setError(`Invalid activity for usage update: ${activityName}.`);
            return false;
        }

        try {
            console.log(`UsageAPI: Decrementing '${columnName}' for user: ${userId}`);
            // Fetch current count first
            const { data: currentData, error: fetchError } = await supabase
                .from('user_usage')
                .select(columnName)
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) {
                console.error(`UsageAPI: Error fetching current count for '${columnName}', user ${userId} before decrement:`, fetchError);
                if (setError) setError(`Failed to update usage for ${activityName} (fetch error).`);
                throw fetchError; // Propagate error
            }

            const currentCount = currentData ? (currentData[columnName] ?? 0) : 0;

            if (currentCount <= 0) {
                console.log(`UsageAPI: Cannot decrement '${columnName}' for user ${userId}, count is already ${currentCount}.`);
                // Optionally set an error if decrementing below zero is not allowed and should be messaged
                // if (setError) setError(`Usage for ${activityName} is already at its minimum.`);
                // Depending on desired behavior, you might return true or false here.
                // If it's not an "error" that it's already 0, but the operation can't proceed, false might be suitable.
                // Or, if the intention is that the state *after* the operation is "0 or less", and it is, then true.
                // For now, let's assume we can't decrement further and it's not a successful decrement.
                return false; // Or handle as per your application's logic for "cannot decrement further"
            }

            const { error: updateError } = await supabase
                .from('user_usage')
                .update({ [columnName]: currentCount - 1 })
                .eq('user_id', userId);

            if (updateError) {
                console.error(`UsageAPI: Error decrementing '${columnName}' for user ${userId}:`, updateError);
                if (setError) setError(`Failed to update usage for ${activityName} (update error).`);
                throw updateError; // Propagate error
            }

            console.log(`UsageAPI: Successfully decremented '${columnName}' for user ${userId}. New potential count: ${currentCount - 1}`);
            return true; // on success
        } catch (err) {
            console.error(`UsageAPI: Exception during decrement of '${columnName}' for user ${userId}:`, err);
            // setError might have already been called by the specific error handling blocks
            if (setError && !err.message.includes("Failed to update usage")) { // Avoid double messaging if already set
                setError(`An error occurred while updating usage for ${activityName}.`);
            }
            return false;
        }
    }, [userId, supabase]); // Added supabase to dependency array

    return { getUserActivityUsage, decrementUserActivityUsage };
};