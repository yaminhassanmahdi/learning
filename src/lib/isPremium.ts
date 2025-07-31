
import { supabase } from "../app/lib/supabaseClient";

/**
 * Checks if a given user is marked as premium in the user_usage table.
 * @param {string} userId - Supabase user ID
 * @returns {Promise<boolean>} - true if the user is premium, false otherwise
 */
export const isUserPremium = async (userId: string): Promise<boolean> => {
    if (!userId) {
        console.error("User ID is required to check premium status.");
        return false;
    }

    try {
        const { data, error } = await supabase
            .from('user_usage')
            .select('is_premium')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching premium status:", error);
            return false;
        }

        return data?.is_premium === true;
    } catch (err) {
        console.error("Unexpected error checking premium status:", err);
        return false;
    }
};
