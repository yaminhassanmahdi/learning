import pdfToText from 'react-pdftotext'; // Import the library
import { NOVITA_BASE_URL } from '../components/urls'
import { supabase } from "../lib/supabaseClient";


// --- ConvertAPI Configuration ---
const CONVERTAPI_SECRET = "secret_r96tnJTPdz8W2FV7"

// --- Text & File Helpers ---

export const countWords = (text = '') => {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
};
export const fetchPrepContentById = async (prepId, userId) => {
    if (!prepId || !userId) {
        console.error("Prep ID and User ID are required to fetch content.");
        return null;
    }
    try {
        const { data, error } = await supabase
            .from('exam_prep_data') // Ensure this matches your table name
            .select('id, prep_name, model_response') // Select needed fields
            .eq('id', prepId)
            .eq('user_id', userId)
            .single(); // Expect only one result

        if (error) {
            console.error("Error fetching prep content:", error);
            throw error; // Re-throw to be caught by the caller
        }

        if (!data) {
            console.warn(`Prep with ID ${prepId} not found for user.`);
            return null;
        }

        return data;
    } catch (err) {
        console.error("Exception in fetchPrepContentById:", err);
        // Consider specific error handling or re-throwing
        return null; // Return null on failure
    }
};
// Updated to use react-pdftotext
export const extractTextFromPdf = async (fileOrBlob) => {
    if (!fileOrBlob) throw new Error("No file provided for PDF text extraction.");
    try {
        console.log("Extracting text using react-pdftotext...");
        // Ensure we pass a File object if it's a Blob
        const fileObject = (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File))
            ? new File([fileOrBlob], "converted.pdf", { type: fileOrBlob.type })
            : fileOrBlob;

        const text = await pdfToText(fileObject);
        console.log(`Extracted text length: ${text?.length ?? 0}`);
        return text || ""; // Return empty string if extraction yields null/undefined
    } catch (error) {
        console.error("react-pdftotext extraction error:", error);
        throw new Error(`PDF text extraction failed: ${error.message || 'Unknown error'}`);
    }
};

// Helper to convert Base64 to Blob (needed for ConvertAPI response)
export const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};


// --- API Interaction ---

// Convert DOCX to PDF using ConvertAPI (Client-Side - requires public key)
export const convertDocxToPdfAPI = async (docxFile) => {
    if (!CONVERTAPI_SECRET || CONVERTAPI_SECRET === 'YOUR_CONVERTAPI_SECRET') {
        throw new Error("ConvertAPI Secret is not configured in environment variables (NEXT_PUBLIC_CONVERTAPI_SECRET). Cannot process DOCX files.");
    }
    if (!(docxFile instanceof File)) {
        throw new Error("Invalid input: Expected a File object for DOCX conversion.");
    }

    const formData = new FormData();
    formData.append('file', docxFile);

    const apiUrl = `https://v2.convertapi.com/convert/docx/to/pdf?secret=${CONVERTAPI_SECRET}`;
    console.log(`Calling ConvertAPI: ${apiUrl.split('?')[0]}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (e) { /* Ignore */ }
            const errorMsg = errorData?.message || errorData?.Error || `HTTP error! Status: ${response.status} ${response.statusText || ''}`;
            console.error("ConvertAPI Error Response:", errorData || await response.text());
            throw new Error(`API Conversion Error (DOCX -> PDF): ${errorMsg}`);
        }

        const result = await response.json();

        if (result.Files && result.Files.length > 0 && result.Files[0].FileData) {
            const pdfFileName = result.Files[0].FileName;
            const pdfBase64 = result.Files[0].FileData;
            const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');
            console.log(`DOCX converted to PDF: ${pdfFileName}, Size: ${(pdfBlob.size / 1024).toFixed(2)} KB`);
            // Return Blob and original filename (or converted filename if preferred)
            return { pdfBlob, originalFileName: docxFile.name };
        } else {
            console.error("Unexpected ConvertAPI response structure:", result);
            throw new Error("Conversion succeeded, but PDF data was not found.");
        }
    } catch (error) {
        console.error(`ConvertAPI request failed (DOCX -> PDF):`, error);
        // Re-throw specific or generic error
        throw new Error(`ConvertAPI failed: ${error.message}`);
    }
};


// Placeholder for your backend quiz generation API call
export const generateQuizApiCall = async (combinedText, instructionText) => {
    console.log("API CALL: Sending text (truncated length):", countWords(combinedText), "Instruction:", instructionText.substring(0, 100) + "...");
    // Simulate API call
    // await new Promise(resolve => setTimeout(resolve, 1500));

    // --- REALISTIC BACKEND CALL ---
    try {
        const response = await fetch('/api/generate-quiz', { // Your backend endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: combinedText,
                instruction: instructionText,
                // Include other params your backend expects, e.g., model type
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Quiz generation API error:", response.status, errorBody);
            throw new Error(`Quiz generation failed: ${response.statusText} - ${errorBody.substring(0, 100)}`);
        }
        const data = await response.json();
        // Assuming your backend returns { quizMarkdown: "..." } or similar
        if (!data.quizMarkdown) {
            console.warn("API response missing 'quizMarkdown' field:", data);
            throw new Error("Received unexpected response format from quiz generator.");
        }
        return data.quizMarkdown;
    } catch (error) {
        console.error("Error calling quiz generation API:", error);
        // Propagate a user-friendly error message
        throw new Error(`Failed to generate quiz: ${error.message}`);
    }
    // --- END REALISTIC BACKEND CALL ---

    // Placeholder response:
    // return `# Generated Quiz\n\n**Q1:** What was in the text?\n * A) Option A\n * B) Option B\n * C) Option C\n\n**Answer:** C`;
};

// --- Supabase Data Access ---

export const fetchUserPrepsFromDB = async (userId) => {
    if (!userId || !supabase) return [];
    console.log("DB CALL: Fetching preps for user:", userId);
    const { data, error } = await supabase
        .from('exam_prep_data')
        .select('id, prep_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching user preps:", error);
        return []; // Return empty array on error
    }
    return data || [];
};

export const savePrepToDB = async (prepData) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    console.log("DB CALL: Saving prep:", prepData.prep_name);
    const { data, error } = await supabase
        .from('exam_prep_data')
        .insert([prepData])
        .select() // Return the inserted data

    if (error) {
        console.error("Error saving prep:", error);
        throw new Error(`Failed to save preparation: ${error.message}`);
    }
    return data ? data[0] : null; // Return the newly created prep record
};

export const deletePrepFromDB = async (prepId, userId) => {
    if (!userId || !supabase) throw new Error("User ID/Supabase is required for deletion.");
    console.log("DB CALL: Deleting prep:", prepId, "for user:", userId);
    const { error } = await supabase
        .from('exam_prep_data')
        .delete()
        .match({ id: prepId, user_id: userId }); // Ensure user owns the prep

    if (error) {
        console.error("Error deleting prep:", error);
        throw new Error(`Failed to delete preparation: ${error.message}`);
    }
    console.log("Prep deleted successfully");
};