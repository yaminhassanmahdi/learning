// c_supabaseData.js
// Functions for interacting with Supabase for SummaryTab data

/**
 * Fetches the current summary usage count for a user.
 * @param {object} supabase - The Supabase client instance.
 * @param {string} userUuid - The UUID of the user.
 * @param {function} setError - Function to set error state in the component.
 * @returns {Promise<number>} The user's remaining summary count, or 0 if error/not found.
 */
export const getSummaryUsage = async (supabase, userUuid, setError) => {
    if (!userUuid) {
        console.error("SupabaseData: Cannot check usage, User ID is missing.");
        setError("User information not available. Cannot check usage.");
        return 0;
    }
    try {
        const { data, error: fetchError } = await supabase
            .from('user_usage')
            .select('summary_count')
            .eq('user_id', userUuid)
            .maybeSingle(); // Use maybeSingle to handle null case gracefully

        if (fetchError) throw fetchError;

        if (!data) {
            console.warn("SupabaseData: No usage record found for user:", userUuid);
            // Don't set a component error here, allow generation logic to handle 0 credits
            return 0;
        }
        const count = data.summary_count ?? 0; // Use nullish coalescing for safety
        console.log("SupabaseData: Fetched summary count:", count);
        return count;
    } catch (err) {
        console.error("SupabaseData: Error fetching summary usage:", err);
        setError(`Failed to fetch usage data: ${err.message}`);
        return 0; // Block generation on error
    }
};
export const getExmPrepUsage = async (supabase, userUuid, setError) => {
    if (!userUuid) {
        console.error("SupabaseData: Cannot check usage, User ID is missing.");
        setError("User information not available. Cannot check usage.");
        return 0;
    }
    try {
        const { data, error: fetchError } = await supabase
            .from('user_usage')
            .select('exm_prep_count')
            .eq('user_id', userUuid)
            .maybeSingle(); // Use maybeSingle to handle null case gracefully

        if (fetchError) throw fetchError;

        if (!data) {
            console.warn("SupabaseData: No usage record found for user:", userUuid);
            // Don't set a component error here, allow generation logic to handle 0 credits
            return 0;
        }
        const count = data.exm_prep_count ?? 0; // Use nullish coalescing for safety
        console.log("SupabaseData: Fetched exm prep count:", count);
        return count;
    } catch (err) {
        console.error("SupabaseData: Error fetching exm prep usage:", err);
        setError(`Failed to fetch usage data: ${err.message}`);
        return 0; // Block generation on error
    }
};


/**
 * Decrements the summary usage count for a user by one.
 * @param {object} supabase - The Supabase client instance.
 * @param {string} userUuid - The UUID of the user.
 * @returns {Promise<void>}
 */
export const updateSummaryUsage = async (supabase, userUuid) => {
    if (!userUuid) {
        console.error("SummaryTab: Cannot update usage, User ID is missing.");
        return;
    }
    console.log("SummaryTab: Attempting to decrement summary count for user:", userUuid);
    try {
        const { data: currentData, error: fetchError } = await supabase
            .from('user_usage')
            .select('summary_count')
            .eq('user_id', userUuid)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!currentData) {
            console.error("SummaryTab: Cannot decrement usage, user record not found during update attempt.");
            return; // Cannot decrement if record doesn't exist
        }

        const currentCount = currentData.summary_count || 0;
        if (currentCount <= 0) {
            console.warn("SummaryTab: Attempted to decrement usage, but count is already zero or negative.");
            return; // Don't update if already zero or less
        }

        const { data: updatedData, error: updateError } = await supabase
            .from('user_usage')
            .update({ summary_count: currentCount - 1 })
            .eq('user_id', userUuid)
            .select('summary_count') // Select the updated count to confirm
            .maybeSingle();

        if (updateError) throw updateError;

        console.log(`SummaryTab: Summary count successfully updated for user ${userUuid}. New count: ${updatedData?.summary_count}`);

    } catch (err) {
        console.error("SummaryTab: Error updating summary usage in DB:", err);
        // setError(`Failed to update usage count: ${err.message}`); // Optionally report
    }
};
export const updateExmPrepUsage = async (supabase, userUuid) => {
    if (!userUuid) {
        console.error("SummaryTab: Cannot update usage, User ID is missing.");
        return;
    }
    console.log("SummaryTab: Attempting to decrement exm_prep_count count for user:", userUuid);
    try {
        const { data: currentData, error: fetchError } = await supabase
            .from('user_usage')
            .select('exm_prep_count')
            .eq('user_id', userUuid)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!currentData) {
            console.error("SummaryTab: Cannot decrement usage, user record not found during update attempt.");
            return; // Cannot decrement if record doesn't exist
        }

        const currentCount = currentData.exm_prep_count || 0;
        if (currentCount <= 0) {
            console.warn("exm_prep_count: Attempted to decrement usage, but count is already zero or negative.");
            return; // Don't update if already zero or less
        }

        const { data: updatedData, error: updateError } = await supabase
            .from('user_usage')
            .update({ exm_prep_count: currentCount - 1 })
            .eq('user_id', userUuid)
            .select('exm_prep_count') // Select the updated count to confirm
            .maybeSingle();

        if (updateError) throw updateError;

        console.log(`exm_prep_count: exm_prep_count count successfully updated for user ${userUuid}. New count: ${updatedData?.summary_count}`);

    } catch (err) {
        console.error("exm_prep_count: Error updating summary usage in DB:", err);
        // setError(`Failed to update usage count: ${err.message}`); // Optionally report
    }
};

/**
 * Updates the summary text for a specific file in the database.
 * @param {object} supabase - The Supabase client instance.
 * @param {string} fid - The file ID.
 * @param {string} summaryToSave - The summary content to save.
 * @param {function} setSummaryProgress - Function to update progress message.
 * @returns {Promise<void>}
 */
export const updateSummaryInDb = async (supabase, fid, summaryToSave, setSummaryProgress) => {
    if (!fid) {
        console.error("SupabaseData: Cannot update summary, File ID is missing.");
        throw new Error("File ID not available for saving summary.");
    }
    if (!summaryToSave || summaryToSave.trim() === "") {
        console.log("SupabaseData: Skipping DB update for empty summary.");
        return; // Don't save empty summaries
    }

    console.log(`SupabaseData: Updating summary in DB for fid: ${fid}`);
    if (setSummaryProgress) setSummaryProgress("Saving progress...");

    try {
        const { error: updateError } = await supabase
            .from("file_data")
            .update({ summary: summaryToSave })
            .eq("file_id", fid);

        if (updateError) throw updateError;

        console.log("SupabaseData: Summary successfully updated in DB.");
        if (setSummaryProgress) setSummaryProgress(""); // Clear saving message

    } catch (error) {
        console.error("SupabaseData: Error updating summary in DB:", error);
        // Re-throw the error so the calling function knows it failed
        throw new Error(`Failed to save summary to database: ${error.message}`);
    }
};

/**
 * Fetches raw text and existing summary for a file.
 * @param {object} supabase - The Supabase client instance.
 * @param {string} fid - The file ID.
 * @param {function} setFileContent - Jotai atom setter for file content.
 * @param {function} setFinalSummaryState - Jotai atom setter for final summary.
 * @param {function} setError - Function to set error state in the component.
 * @param {function} setIsFetchingData - Function to set data fetching state.
 * @param {function} setIntermediateSummaryContent - Function to set intermediate display state.
 * @returns {Promise<{raw_text: string, summary: string|null}|null>} The fetched data or null on error/no data.
 */
export const fetchFileData = async (
    supabase,
    fid,
    setFileContent,
    setFinalSummaryState,
    setError,
    setIsFetchingData,
    setIntermediateSummaryContent
) => {
    if (!fid) {
        // Clear states if fid is null
        setFileContent(null);
        setFinalSummaryState(null);
        setError(null);
        setIntermediateSummaryContent("");
        return null;
    }

    console.log(`SupabaseData: Fetching data for file ID: ${fid}`);
    setIsFetchingData(true);
    setError(null); // Clear previous errors

    try {
        const { data, error: dbError } = await supabase
            .from("file_data")
            .select("raw_text, summary")
            .eq("file_id", fid)
            .maybeSingle();

        if (dbError) throw dbError;

        const newRawText = data?.raw_text ?? ""; // Default to empty string if null/undefined
        const newSummary = data?.summary ?? null; // Keep null if no summary

        // Update Jotai atoms
        setFileContent([{ raw_text: newRawText, summary: newSummary }]);
        setFinalSummaryState(newSummary);

        // Update local intermediate display only if not actively generating
        // This check should ideally happen in the component's effect
        setIntermediateSummaryContent(newSummary || "");


        console.log("SupabaseData: File data fetched and states updated.");
        return { raw_text: newRawText, summary: newSummary }; // Return fetched data

    } catch (error) {
        console.error("SupabaseData: Error fetching file data:", error);
        setError(`Failed to load document data: ${error.message}`);
        // Clear states on error
        setFileContent(null);
        setFinalSummaryState(null);
        setIntermediateSummaryContent("");
        return null; // Indicate failure
    } finally {
        setIsFetchingData(false); // Ensure loading state is reset
    }
};