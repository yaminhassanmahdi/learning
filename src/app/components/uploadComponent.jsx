"use client";

import { useState, useEffect } from "react"; // Removed useMemo as it wasn't used
import { useDropzone } from "react-dropzone";
// import mammoth from "mammoth"; // Keep if needed elsewhere, but not for direct upload logic here
// import JSZip from "jszip"; // Keep if needed elsewhere
import pdfToText from "react-pdftotext";
import { YoutubeTranscript } from 'youtube-transcript';
import ConvertApi from 'convertapi-js';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  fileAtom,
  // textAtom, // Text is stored directly in DB via uploadToSupabase
  fileNameAtom,
  chat_id_supabase,
  file_url_supabase,
  quizQuestions,
  flashCardsState,
  summaryState,
  file_id_supabase,
  file_contents_supabase
  // file_contents_supabase, // Not used in upload flow
} from "../../store/uploadAtoms";
import { supabase } from "../lib/supabaseClient";
import useIsMobile from "./useIsMobile";

// --- ConvertAPI Configuration ---
// !!! IMPORTANT: Replace with your actual secret for testing ONLY. Hide in production!
// Consider moving this to environment variables for security.
// const CONVERTAPI_SECRET = 'ySlMqqfnyYW3Te98F2qqDZKyhxhY9Lfk'; // <--- YOUR ConvertAPI Secret
const CONVERTAPI_SECRET = 'TU3I1MNCTf0TpyA6tJfbFub3b0pDXLMd'; // <--- YOUR ConvertAPI Secret
let convertApi = ConvertApi.auth(CONVERTAPI_SECRET);
// --- Helper Function: Base64 to Blob ---
function base64ToBlob(base64, contentType = '', sliceSize = 512) {
  const base64Data = base64.split(',')[1] || base64;
  try {
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  } catch (error) {
    console.error("Error converting base64 to Blob:", error);
    // Add more context to the error if possible
    if (base64Data.length < 100) {
      console.error("Invalid Base64 string (short):", base64Data);
    } else {
      console.error("Invalid Base64 string (truncated):", base64Data.substring(0, 100) + "...");
    }
    throw new Error("Invalid Base64 string received from API. Conversion failed.");
  }
}

async function getYouTubeData(videoUrlOrId) {
  if (!videoUrlOrId || typeof videoUrlOrId !== 'string' || videoUrlOrId.trim() === '') {
    throw new Error("Invalid video URL or ID provided.");
  }
  try {
    // Attempt to fetch transcript
    const transcriptItems = await YoutubeTranscript.fetchTranscript('https://cors-for-techi.onrender.com/' + videoUrlOrId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return { transcript: "No captions found for this video.", videoTitle: videoUrlOrId }; // Return URL as fallback title
    }

    const fullTranscript = transcriptItems.map(item => item.text).join(' ');

    // Note: youtube-transcript doesn't directly give the video title.
    // For a real title, you'd typically use the YouTube Data API,
    // or a library like 'ytdl-core' to get video info.
    // For simplicity here, we'll just use the URL or a placeholder.
    // A more advanced implementation might try to extract it.
    let videoTitle = videoUrlOrId; // Placeholder
    // Basic title extraction if it's a full URL (very naive)
    try {
      const url = new URL(videoUrlOrId);
      if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
        // This doesn't get the actual title, just a marker.
        // Real title fetching is more involved.
        videoTitle = `YouTube Video: ${url.pathname.split('/').pop() || 'Unknown ID'}`;
      }
    } catch (e) { /* ignore if not a valid URL for this basic parsing */ }


    return { transcript: fullTranscript, videoTitle: videoTitle };

  } catch (error) {
    if (error.message && (error.message.toLowerCase().includes('no captions') || error.message.toLowerCase().includes('could not find captions'))) {
      return { transcript: "No captions found for this video.", videoTitle: videoUrlOrId };
    }
    console.error("Error in getYouTubeData (server-side):", error);
    // Sanitize error message for client
    const clientErrorMessage = error.message.includes("permission") ? "Failed to fetch transcript due to video permissions or settings." : "Failed to fetch transcript from video.";
    throw new Error(clientErrorMessage);
  }
}
export default function UploadComponent() {
  const [file, setFile] = useAtom(fileAtom); // Original uploaded file (PDF, DOCX, PPTX)
  // At the top with other useState hooks
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fileURLSupabase, setFileURLSupabase] = useAtom(file_url_supabase); // URL of the uploaded PDF
  const [fileName, setFileName] = useAtom(fileNameAtom); // Original OR converted filename (set after successful upload)
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing file...");
  const [error, setError] = useState("");
  const [quizQues, setQuizQuestions] = useAtom(quizQuestions);
  const [flashCards, setFlashCards] = useAtom(flashCardsState);
  const [summaryS, setSummaryS] = useAtom(summaryState);
  const [file_id_s, setFile_id_s] = useAtom(file_id_supabase);
  const chatId = useAtomValue(chat_id_supabase);
  const isMobile = useIsMobile()
  const [fileContent, setFileContent] = useAtom(file_contents_supabase);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      // --- ADDED PPTX ---
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      // --- ADDED TXT ---
      'text/plain': ['.txt'],
      // --- ADDED PPT (legacy) ---
      'application/vnd.ms-powerpoint': ['.ppt'],
    },
    onDrop: (acceptedFiles) => handleFileUpload(acceptedFiles[0]),
  });

  // --- Fetch Existing File URL Effect (No changes needed) ---
  useEffect(() => {
    console.log("Chat ID changed or component mounted:", chatId);
    const fetchFileURL = async () => {
      if (!chatId) {
        console.log("No Chat ID, resetting file URL.");
        setFileURLSupabase(null);
        setFile_id_s(null);
        setFileName(null); // Clear filename if no chat
        setQuizQuestions([]);
        setFlashCards([]);
        setSummaryS("");
        return;
      }
      setIsLoading(true);
      setLoadingMessage("Checking for existing file...");
      setError(null); // Clear previous errors
      console.log("Checking for existing file for chat ID:", chatId);
      try {
        const { data: fileData, error: fileError } = await supabase
          .from("files")
          .select("id, file_url, file_name")
          .eq("chat_id", chatId)
          .single();

        if (fileError) {
          if (fileError.code === "PGRST116") { // No rows found
            console.log("No file found for this chat ID.");
            setFileURLSupabase(null);
            setFile_id_s(null);
            setFileName(null);
            setQuizQuestions([]);
            setFlashCards([]);
            setSummaryS("");
          } else {
            throw fileError;
          }
        } else {
          console.log("Existing File URL found:", fileData.file_url);
          console.log("Existing File ID:", fileData.id)
          setFileURLSupabase(fileData.file_url);
          setFile_id_s(fileData.id);
          setFileName(fileData.file_name); // Set filename from DB

        }
      } catch (error) {
        console.error("Error fetching file data:", error);
        setError(`Error checking for existing file: ${error.message}`);
        setFileURLSupabase(null);
        setFile_id_s(null);
        setFileName(null);
        // Also reset generated content on error
        setQuizQuestions([]);
        setFlashCards([]);
        setSummaryS("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, setFileURLSupabase, setFile_id_s, setFileName, setQuizQuestions, setFlashCards, setSummaryS]); // Dependencies seem correct


  // --- Handle File Upload (Main Dispatcher) ---
  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;

    // Basic validation before starting
    if (!CONVERTAPI_SECRET || CONVERTAPI_SECRET === 'YOUR_CONVERTAPI_SECRET') {
      const fileTypeCheck = uploadedFile.name.split(".").pop()?.toLowerCase();
      if (['docx', 'pptx', 'txt', 'ppt'].includes(fileTypeCheck)) {
        setError("Error: Conversion API is not configured. Cannot process DOCX or PPTX.");
        setIsLoading(false); // Ensure loading stops
        return; // Stop processing
      }
      // Allow PDF upload even if API key is missing
    }


    setIsLoading(true);
    setLoadingMessage("Preparing upload...");
    setError(""); // Clear previous errors
    setFile(uploadedFile); // Store original file reference
    setFileName(uploadedFile.name); // Display original filename initially

    const fileType = uploadedFile.name.split(".").pop()?.toLowerCase();
    console.log(`Processing file type: ${fileType}`);

    try {
      if (fileType === "pdf") {
        await processPdfUpload(uploadedFile);
      } else if (fileType === "docx" || fileType === "pptx" || fileType === "txt" || fileType === "ppt") {
        await processDocxOrPptxUpload(uploadedFile, fileType); // Use generic processor
      } else if (fileType === "pptsx") {
        // --- ADDED PPTX ---
        await processDocxOrPptxUpload(uploadedFile, 'pptx'); // Use generic processor
      } else {
        throw new Error("Unsupported file format. Please upload a PDF, DOCX, or PPTX file.");
      }
      // Success state is implicitly handled by uploadToSupabase setting the URL etc.
    } catch (error) {
      console.error("Error processing file:", error);
      setError(`Error: ${error.message}`);
      // Reset states on error (keep original file/name if needed for retry?)
      setFileURLSupabase(null);
      setFile_id_s(null);
      // Optionally clear the original file state too:
      // setFile(null);
      // setFileName(null); // Or keep original name to show what failed
    } finally {
      setIsLoading(false); // Ensure loading indicator stops
    }
  };

  // --- Process PDF Upload ---
  const processPdfUpload = async (pdfFile) => {
    setLoadingMessage("Extracting text from PDF...");
    let extractedText = "";
    try {
      // Pass the File object directly to pdfToText
      extractedText = await extractTextFromPDF(pdfFile);
    } catch (textError) {
      console.warn("Could not extract text from PDF:", textError);
      // Decide if upload should proceed without text
      // extractedText = ""; // Option 1: Proceed without text
      throw new Error(`Failed to extract text from PDF: ${textError.message}. Upload cancelled.`); // Option 2: Block upload
    }

    setLoadingMessage("Uploading PDF to storage...");
    // Convert original File object to Blob ONLY IF NEEDED by uploadToSupabase
    // If uploadToSupabase can handle File directly, you might not need this Blob conversion.
    // However, converting here ensures consistency with the conversion flow.
    const pdfBlob = new Blob([pdfFile], { type: pdfFile.type });
    await uploadToSupabase(pdfBlob, extractedText, pdfFile.name); // Upload original PDF Blob
  }

  // --- Process DOCX or PPTX Upload (Combined Logic) ---
  const processDocxOrPptxUpload = async (inputFile, sourceType) => {
    // Redundant check, but good for safety if called directly
    if (!CONVERTAPI_SECRET || CONVERTAPI_SECRET === 'YOUR_CONVERTAPI_SECRET') {
      throw new Error("ConvertAPI Secret is not configured.");
    }

    const fileExtension = sourceType.toUpperCase(); // For messages
    setLoadingMessage(`Converting ${fileExtension} to PDF via API...`);

    let pdfBlob, pdfFileName;
    try {
      const conversionResult = await convertFileToPdfAPI(inputFile, sourceType);
      pdfBlob = conversionResult.pdfBlob;
      pdfFileName = conversionResult.pdfFileName;
    } catch (conversionError) {
      // Let the error propagate up, handleFileUpload will catch it
      throw conversionError; // Re-throw the specific conversion error
    }


    setLoadingMessage("Extracting text from converted PDF...");
    let extractedText = "";
    try {
      // Extract text from the *converted* PDF blob
      extractedText = await extractTextFromPDF(pdfBlob);
    } catch (textError) {
      console.warn(`Could not extract text from converted PDF (from ${fileExtension}):`, textError);
      // Decide if upload should proceed without text
      // extractedText = ""; // Option 1: Proceed without text
      throw new Error(`Failed to extract text from converted PDF: ${textError.message}. Upload cancelled.`); // Option 2: Block upload
    }

    setLoadingMessage(`Uploading converted PDF (from ${fileExtension}) to storage...`);
    // Upload the *converted* PDF blob, using the new PDF filename
    await uploadToSupabase(pdfBlob, extractedText, pdfFileName);
  }


  // --- Generic Convert File (DOCX, PPTX) using ConvertAPI ---
  const convertFileToPdfAPI = async (sourceFile, sourceFormat) => {
    if (!['docx', 'pptx', 'txt', 'ppt'].includes(sourceFormat)) {
      throw new Error(`Unsupported source format for conversion: ${sourceFormat}`);
    }

    // Check if CONVERTAPI_SECRET is available and not the placeholder
    if (!CONVERTAPI_SECRET) { // Added your specific placeholder for the check
      console.error("ConvertAPI Secret is not configured or is still the placeholder.");
      throw new Error("ConvertAPI Secret is not properly configured.");
    }
    // Ensure convertApi is initialized (it should be by the global declaration)
    if (!convertApi) {
      console.error("ConvertApi not initialized. Check CONVERTAPI_SECRET and initialization.");
      throw new Error("ConvertAPI service is not initialized.");
    }


    console.log(`Calling ConvertAPI SDK to convert ${sourceFormat} to PDF...`);

    try {
      const params = convertApi.createParams();
      params.add('File', sourceFile);
      // The first argument is the source format, the second is the target format.
      const result = await convertApi.convert(sourceFormat, 'pdf', params);

      if (result.files && result.files.length > 0 && result.files[0].Url) {
        const pdfFileUrl = result.files[0].Url;
        const pdfFileName = result.files[0].FileName;

        console.log(`${sourceFormat.toUpperCase()} converted to PDF. URL: ${pdfFileUrl}, Filename: ${pdfFileName}`);
        setLoadingMessage(`Fetching converted PDF: ${pdfFileName}...`);

        // Fetch the converted PDF from the URL to get a Blob
        const response = await fetch(pdfFileUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch converted PDF from URL:", response.status, errorText);
          throw new Error(`Failed to fetch converted PDF from ${pdfFileUrl}. Status: ${response.status}`);
        }
        const pdfBlob = await response.blob();

        console.log(`Converted PDF fetched as Blob. Size: ${(pdfBlob.size / 1024).toFixed(2)} KB`);
        return { pdfBlob, pdfFileName };
      } else {
        console.error("Unexpected ConvertAPI SDK response structure:", result);
        throw new Error("Conversion succeeded according to API SDK, but PDF URL was not found in the response.");
      }
    } catch (error) {
      console.error(`ConvertAPI SDK request failed (${sourceFormat} -> PDF):`, error);
      // Check if it's an error from the SDK or our fetch
      if (error.message && (error.message.includes('ConvertAPI') || error.message.includes('fetch converted PDF'))) {
        throw error; // Re-throw specific errors
      }
      // Assume other errors
      throw new Error(`Failed to convert file using ConvertAPI SDK: ${error.message || 'Unknown error'}`);
    }
  };


  // --- Extract Text from PDF ---
  const extractTextFromPDF = async (fileOrBlob) => {
    // pdfToText expects a File or Blob object
    if (!(fileOrBlob instanceof File) && !(fileOrBlob instanceof Blob)) {
      console.error("Invalid input for text extraction: Expected File or Blob, got", typeof fileOrBlob);
      throw new Error("Invalid data type provided for PDF text extraction.");
    }
    try {
      console.log("Extracting text from PDF/Blob...");
      const text = await pdfToText(fileOrBlob);
      console.log(`Extracted text length: ${text?.length ?? 0}`);
      // Handle cases where extraction might yield null/undefined, return empty string
      return text || "";
    } catch (error) {
      console.error("PDF text extraction error:", error);
      // Re-throw the error to be handled by the calling process
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  };


  // --- Upload File & Metadata to Supabase ---
  // Accepts Blob and target filename explicitly. Handles cleanup of old files.
  const uploadToSupabase = async (fileBlob, extractedText, targetFileName) => {
    if (!chatId) {
      throw new Error("Chat ID is missing, cannot upload file.");
    }
    if (!fileBlob || !(fileBlob instanceof Blob)) {
      throw new Error("Invalid file data (Blob) provided for upload.");
    }
    if (!targetFileName) {
      throw new Error("Target filename is missing for upload.");
    }

    console.log(`Starting Supabase upload process for: ${targetFileName}`);
    setLoadingMessage("Checking for existing file record...");

    // --- Define Bucket and Path Segment ONCE ---
    try {
      await cleanupExistingFileRecords(chatId);
    } catch (cleanupError) {
      // Decide how to handle cleanup failure: stop or continue?
      // For now, we'll throw, as failing to clean up can lead to orphaned data or errors.
      throw cleanupError;
    }
    const BUCKET_NAME = "file-uploads"; // ** YOUR SUPABASE BUCKET NAME **
    const BUCKET_PUBLIC_URL_PREFIX = `/storage/v1/object/public/${BUCKET_NAME}/`;

    // Step 1 & 2: Check for and delete existing file for this chat ID
    try {
      const { data: existingFile, error: fetchError } = await supabase
        .from("files")
        .select("id, file_url")
        .eq("chat_id", chatId)
        .maybeSingle(); // Handles 0 or 1 result gracefully

      if (fetchError) throw fetchError; // Throw DB query errors

      if (existingFile) {
        setLoadingMessage("Deleting existing file...");
        console.log("Existing file found (ID:", existingFile.id, "). Deleting...");
        const existingFileId = existingFile.id;

        // --- Robust File Path Extraction ---
        let filePath = null;
        try {
          if (existingFile.file_url && existingFile.file_url.includes(BUCKET_PUBLIC_URL_PREFIX)) {
            // Decode URL in case filename has special chars, then split
            filePath = decodeURIComponent(existingFile.file_url).split(BUCKET_PUBLIC_URL_PREFIX)[1];
          }
        } catch (urlError) {
          console.error("Error parsing existing file URL:", urlError, existingFile.file_url);
        }


        if (filePath) {
          console.log("Deleting from storage path:", filePath);
          const { error: deleteStorageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]); // Pass path in an array
          if (deleteStorageError) {
            // Log error but continue to clean up DB records, as storage might be out of sync
            console.error("Error deleting old file from storage (continuing DB cleanup):", deleteStorageError);
          }
        } else {
          console.warn("Could not determine file path from URL for storage deletion:", existingFile.file_url);
        }

        // --- Delete DB Records ---
        // Delete associated data first (using the fetched existingFileId)
        if (existingFileId) {
          const { error: deleteFileDataError } = await supabase
            .from("file_data")
            .delete()
            .eq("file_id", existingFileId);
          if (deleteFileDataError) {
            console.error("Error deleting old 'file_data' record:", deleteFileDataError);
            // Consider if this is fatal - maybe the file record deletion will fail anyway
          }
        }

        // Delete main file record (using chat_id for safety in case ID was wrong)
        const { error: deleteFileError } = await supabase
          .from("files")
          .delete()
          .eq("chat_id", chatId); // Use chat_id for reliable targeting
        if (deleteFileError) {
          console.error("Error deleting old 'files' record:", deleteFileError);
          // This might be more critical, decide if you should throw
          throw new Error(`Failed to delete existing file record: ${deleteFileError.message}`);
        }

        console.log("Old file records deleted (or attempted).");
        // Clear potentially stale states immediately after deletion logic
        setFileURLSupabase(null);
        setFile_id_s(null);
        setFileName(null); // Clear the filename state too
        // Also clear generated content as the old file is gone
        setQuizQuestions([]);
        setFlashCards([]);
        setSummaryS("");
      }
    } catch (error) {
      console.error("Error during file existence check or deletion:", error);
      throw new Error(`Failed during pre-upload cleanup: ${error.message}`);
    }


    // Step 3: Upload the new file Blob
    // Use a consistent naming convention, incorporating chat_id and timestamp
    // Sanitize targetFileName to prevent issues in the path
    const sanitizedFileName = targetFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newFilePath = `uploads/${chatId}/${Date.now()}_${sanitizedFileName}`;
    setLoadingMessage(`Uploading ${targetFileName}...`);
    console.log("Uploading new file to path:", newFilePath);

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(newFilePath, fileBlob, {
          contentType: fileBlob.type, // Pass content type for storage
          // cacheControl: '3600', // Optional: Set caching headers if needed
          upsert: false // Crucial: We explicitly deleted, so don't upsert
        });

      if (uploadError) throw uploadError; // Throw storage upload errors

      // Step 4: Get public URL of the *successfully* uploaded file
      setLoadingMessage("Getting file URL...");
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(newFilePath);

      if (!urlData || !urlData.publicUrl) {
        // This shouldn't happen if upload succeeded, but handle defensively
        console.error("Upload succeeded but failed to get public URL for path:", newFilePath);
        throw new Error("Could not get public URL for the uploaded file.");
      }
      const fileUrl = urlData.publicUrl;
      console.log("New file URL:", fileUrl);


      // Step 5: Insert new file metadata into `files` table
      setLoadingMessage("Saving file information...");
      const { data: fileRecord, error: insertError } = await supabase
        .from("files")
        .insert({
          chat_id: chatId,
          file_name: targetFileName, // Store the actual PDF filename (original or converted)
          file_url: fileUrl,
        })
        .select("id") // Select the newly created ID
        .single(); // Expect exactly one record

      if (insertError) throw insertError; // Throw DB insert errors

      const newFileId = fileRecord.id;
      console.log("New file record created with ID:", newFileId);


      // Step 6: Insert extracted text (and reset other fields) into `file_data` table
      setLoadingMessage("Saving extracted text...");
      // Ensure extractedText is not undefined, use null if empty or truly null
      // const textToInsert = (extractedText && typeof extractedText === 'string' && extractedText.trim()) ? extractedText.trim() : null;

      const textToInsert = (extractedText && typeof extractedText === 'string' && extractedText.trim())
        ? extractedText.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\\/g, '\\\\') // Escape backslashes
          .replace(/'/g, "''")   // Escape single quotes (if you're not using parameterized queries)
        : null;
      // --- Insert or Update file_data ---
      // It's generally safer to insert, assuming the pre-upload cleanup worked.
      // If cleanup might fail silently, an upsert could be considered, but requires careful handling.
      const { error: fileDataError } = await supabase
        .from("file_data")
        .insert({
          file_id: newFileId, // Link to the new file record
          summary: null,      // Reset generated content fields
          flashcards: null,
          quiz: null,
          raw_text: textToInsert, // Store the extracted text (or null)
        });
      setFileContent([{ raw_text: textToInsert }])

      if (fileDataError) throw fileDataError; // Throw DB insert errors for file_data

      // Step 7: Update the chat title in the chats table
      setLoadingMessage("Updating chat title...");
      // Use the filename (without extension) as the chat title
      const fileNameWithoutExtension = targetFileName.split('.').slice(0, -1).join('.') || targetFileName;
      const { error: updateChatError } = await supabase
        .from("chats")
        .update({ title: fileNameWithoutExtension })
        .eq("id", chatId);

      if (updateChatError) {
        console.error("Error updating chat title:", updateChatError);
        // Log the error but don't throw - we still want the file upload to be considered successful
      } else {
        console.log("Chat title updated to:", fileNameWithoutExtension);
      }

      // --- Final State Updates on SUCCESS ---
      setFileURLSupabase(fileUrl);  // Update state with the final PDF URL
      setFile_id_s(newFileId);      // Update state with the new file ID
      setFileName(targetFileName);  // Update state with the final PDF filename
      // Clear any generated content from previous file (if not already cleared)
      setQuizQuestions([]);
      setFlashCards([]);
      setSummaryS("");

      console.log("New file uploaded and database updated successfully!");
      setLoadingMessage("Processing complete!"); // Final success message
      // Optionally: Trigger fetching of quiz/summary data here if the backend generates it automatically after text upload

    } catch (error) {
      console.error("Error during Supabase upload or metadata insertion:", error);
      // Attempt to clean up the newly uploaded storage file if DB inserts failed?
      // This adds complexity. For now, just report the error.
      setLoadingMessage(`Upload failed: ${error.message}`); // Show error in loading area briefly
      // Reset states on failure to reflect that the upload didn't complete successfully
      setFileURLSupabase(null); // Clear URL
      setFile_id_s(null);       // Clear ID
      setFileName(file?.name || null); // Reset to original maybe? Or clear?
      // Throw the error to be caught by the main handler, which sets the 'error' state
      throw new Error(`Upload/Save failed: ${error.message}`);
    }
  };

  // --- Delete File Function ---
  // Added robustness for URL parsing and bucket name variable
  const DeleteFileFromSupabase = async (file_id_to_delete) => {
    if (!file_id_to_delete) {
      console.warn("No file ID provided for deletion.");
      setError("Cannot delete: File ID is missing."); // Provide feedback
      return;
    }
    console.log("Attempting to delete file with ID:", file_id_to_delete);
    setIsLoading(true); // Indicate activity
    setLoadingMessage("Deleting file...");
    setError(""); // Clear previous errors

    const BUCKET_NAME = "file-uploads"; // ** YOUR SUPABASE BUCKET NAME **
    const BUCKET_PUBLIC_URL_PREFIX = `/storage/v1/object/public/${BUCKET_NAME}/`;

    try {
      // 1. Get the file URL to find the storage path
      const { data: fileToDelete, error: fetchError } = await supabase
        .from("files")
        .select("file_url")
        .eq("id", file_id_to_delete)
        .single(); // Expect one or error

      let storagePathToDelete = null;
      if (fetchError || !fileToDelete) {
        console.warn("Error fetching file URL for deletion or file not found:", fetchError);
        // File might already be deleted from 'files', but try deleting 'file_data' just in case
      } else {
        // Attempt to parse storage path
        try {
          if (fileToDelete.file_url && fileToDelete.file_url.includes(BUCKET_PUBLIC_URL_PREFIX)) {
            storagePathToDelete = decodeURIComponent(fileToDelete.file_url).split(BUCKET_PUBLIC_URL_PREFIX)[1];
          }
        } catch (urlError) {
          console.error("Error parsing file URL for deletion:", urlError, fileToDelete.file_url);
        }
      }


      // 2. Delete from Storage (if path was determined)
      if (storagePathToDelete) {
        console.log("Deleting from storage path:", storagePathToDelete);
        const { error: deleteStorageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePathToDelete]); // Path in an array
        if (deleteStorageError) {
          // Log but continue, maybe record was already gone or permissions issue
          console.error("Error deleting file from storage (continuing with DB deletion):", deleteStorageError);
        }
      } else if (fileToDelete) { // Only warn if we expected to find a path
        console.warn("Could not determine file path from URL for storage deletion:", fileToDelete?.file_url);
      }

      // 3. Delete from `file_data` table (associated data)
      // Use file_id_to_delete directly, as it's the primary key relation
      const { error: deleteFileDataError } = await supabase
        .from("file_data")
        .delete()
        .eq("file_id", file_id_to_delete);
      if (deleteFileDataError && deleteFileDataError.code !== 'PGRST116') { // Ignore 'not found' error
        console.error("Error deleting from 'file_data':", deleteFileDataError);
        // Log error but continue to delete the main file record
      }

      // 4. Delete from `files` table (main record)
      const { error: deleteFileError } = await supabase
        .from("files")
        .delete()
        .eq("id", file_id_to_delete);
      if (deleteFileError && deleteFileError.code !== 'PGRST116') { // Ignore 'not found' error
        // If deleting the main record fails (and it wasn't already gone), it's a bigger issue
        throw deleteFileError;
      }

      console.log("File deleted successfully from database and storage (if found).");
      // --- Reset all related states on successful deletion ---
      setFileURLSupabase(null);
      setQuizQuestions([]);
      setFlashCards([]);
      setSummaryS("");
      setFile_id_s(null);
      setFile(null); // Clear the original file reference
      setFileName(null); // Clear the filename

    } catch (error) {
      console.error("Error deleting file:", error);
      setError(`Failed to delete file: ${error.message}`);
      // Keep loading state? Maybe set back to false here.
    } finally {
      setIsLoading(false); // Ensure loading stops regardless of outcome
    }
  };
  // --- Handle YouTube URL Submission ---
  const handleYouTubeUrlSubmit = async () => {
    if (!youtubeUrl.trim()) {
      setError("Please enter a valid YouTube video URL.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Preparing to fetch transcript...");
    setError("");
    setFileName(youtubeUrl); // Set initial filename to URL, will be updated

    try {
      await processYouTubeTranscript(youtubeUrl);
      setYoutubeUrl(""); // Clear input on success
    } catch (err) {
      console.error("Error processing YouTube URL:", err);
      setError(`Error: ${err.message}`);
      // Do not clear youtubeUrl here, so user can see what failed or retry
    } finally {
      setIsLoading(false);
    }
  };

  // --- Process YouTube Transcript ---
  // --- Helper: Cleanup Existing File Records for a Chat ID ---
  const cleanupExistingFileRecords = async (currentChatId) => {
    if (!currentChatId) { // Added safety check
      console.warn("Cleanup skipped: No Chat ID provided.");
      return;
    }
    setLoadingMessage("Checking for existing file data...");

    const BUCKET_NAME = "file-uploads"; // ** YOUR SUPABASE BUCKET NAME **
    const BUCKET_PUBLIC_URL_PREFIX = `/storage/v1/object/public/${BUCKET_NAME}/`;

    try {
      const { data: existingFile, error: fetchError } = await supabase
        .from("files")
        .select("id, file_url") // Consider selecting a 'file_type' if you add one
        .eq("chat_id", currentChatId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingFile) {
        setLoadingMessage("Deleting existing file data...");
        console.log("Existing file found (ID:", existingFile.id, "). Preparing to delete...");
        const existingFileId = existingFile.id;

        // Check if file_url is a Supabase storage URL before trying to delete from storage
        if (existingFile.file_url && existingFile.file_url.startsWith(BUCKET_PUBLIC_URL_PREFIX)) {
          let filePath = null;
          try {
            filePath = decodeURIComponent(existingFile.file_url).split(BUCKET_PUBLIC_URL_PREFIX)[1];
          } catch (urlError) {
            console.error("Error parsing existing file URL for storage deletion:", urlError, existingFile.file_url);
          }
          if (filePath) {
            console.log("Deleting from storage path:", filePath);
            const { error: deleteStorageError } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
            if (deleteStorageError) {
              console.error("Error deleting old file from storage (continuing DB cleanup):", deleteStorageError);
            }
          }
        } else {
          console.log("Existing file_url is not a Supabase storage object or missing, skipping storage deletion:", existingFile.file_url);
        }

        // Delete DB Records
        const { error: deleteFileDataError } = await supabase.from("file_data").delete().eq("file_id", existingFileId);
        if (deleteFileDataError) console.error("Error deleting old 'file_data' record:", deleteFileDataError);

        const { error: deleteFileError } = await supabase.from("files").delete().eq("id", existingFileId);
        if (deleteFileError) throw new Error(`Failed to delete existing 'files' record: ${deleteFileError.message}`);

        console.log("Old file records deleted (or attempted).");
        // Clear related states - these will be reset by the new upload/save process,
        // but clearing here can be a safeguard if the calling function doesn't.
        // setFileURLSupabase(null);
        // setFile_id_s(null);
        // setFileName(null);
        // setQuizQuestions([]);
        // setFlashCards([]);
        // setSummaryS("");
      }
    } catch (error) {
      console.error("Error during file existence check or deletion:", error);
      throw new Error(`Failed during pre-upload cleanup: ${error.message}`);
    }
  };
  // --- Upload TEXT-ONLY Data & Metadata to Supabase ---
  const uploadTextToSupabase = async (extractedText, targetFileName, sourceUrl) => {
    if (!chatId) {
      throw new Error("Chat ID is missing, cannot save text data.");
    }
    if (!targetFileName) {
      throw new Error("Target filename is missing for text data.");
    }
    if (!extractedText) { // Check for empty or null transcript text specifically
      throw new Error("Extracted text is empty, cannot save.")
    }


    console.log(`Starting Supabase text data save for: ${targetFileName}`);

    // Use the new cleanup helper
    try {
      await cleanupExistingFileRecords(chatId);
    } catch (cleanupError) {
      throw cleanupError;
    }

    // For text-only sources, the `fileUrl` stored in the `files` table
    // will be the `sourceUrl` (e.g., the YouTube video URL).
    // No file is uploaded to Supabase Storage.
    const fileUrlForDB = sourceUrl;
    console.log(`Source URL for text data (to be stored in DB): ${fileUrlForDB}`);
    setLoadingMessage("Saving file information...");

    try {
      // Insert new file metadata into `files` table
      const { data: fileRecord, error: insertError } = await supabase
        .from("files")
        .insert({
          chat_id: chatId,
          file_name: targetFileName, // e.g., "Video Title Cleaned.txt"
          file_url: fileUrlForDB,    // The YouTube URL itself
          // You might add a 'type' column to your 'files' table, e.g., type: 'youtube_transcript'
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const newFileId = fileRecord.id;
      console.log("New file record created for text data with ID:", newFileId);

      // Insert extracted text into `file_data` table
      setLoadingMessage("Saving extracted text...");
      const textToInsert = (extractedText && typeof extractedText === 'string' && extractedText.trim())
        ? extractedText.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\\/g, '\\\\').replace(/'/g, "''")
        : null;

      if (!textToInsert) { // Double check after sanitization
        throw new Error("Sanitized text is empty, cannot save.");
      }

      const { error: fileDataError } = await supabase
        .from("file_data")
        .insert({
          file_id: newFileId,
          raw_text: textToInsert,
          summary: null, flashcards: null, quiz: null, // Reset generated content
        });

      if (fileDataError) throw fileDataError;
      setFileContent([{ raw_text: textToInsert }]); // Update local state for immediate use

      // Update chat title
      setLoadingMessage("Updating chat title...");
      const fileNameWithoutExtension = targetFileName.endsWith('.txt')
        ? targetFileName.slice(0, -4)
        : targetFileName;
      const { error: updateChatError } = await supabase
        .from("chats")
        .update({ title: fileNameWithoutExtension })
        .eq("id", chatId);
      if (updateChatError) console.error("Error updating chat title:", updateChatError);


      // --- Final State Updates on SUCCESS ---
      setFileURLSupabase(fileUrlForDB); // Store the YouTube URL as the main URL
      setFile_id_s(newFileId);
      setFileName(targetFileName);
      setQuizQuestions([]);
      setFlashCards([]);
      setSummaryS("");

      console.log("Text data saved and database updated successfully!");
      setLoadingMessage("Processing complete!");

    } catch (error) {
      console.error("Error during Supabase text data save or metadata insertion:", error);
      setLoadingMessage(`Save failed: ${error.message}`);
      // Reset relevant states on failure
      // setFileURLSupabase(null); // Potentially keep the old one if this failed mid-way
      // setFile_id_s(null);
      throw new Error(`Save text data failed: ${error.message}`);
    }
  };
  async function getYouTubeDataNew(videoUrlOrId) {
    const res = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: videoUrlOrId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Transcript fetch failed.');
    }

    const data = await res.json();
    return {
      transcript: data.transcript,
      videoTitle: data.videoTitle,
    };
  }
  const processYouTubeTranscript = async (videoUrl) => {
    setLoadingMessage("Fetching transcript from YouTube video...");

    let s = await getYouTubeDataNew(videoUrl);
    console.log(s)
    const { transcript, videoTitle } = await getYouTubeDataNew(videoUrl);

    if (!transcript || transcript === "No captions found for this video.") {
      // Handle the case where API call was successful but no captions.
      // This is treated as an error by the frontend process here.
      throw new Error("No captions found for this video or failed to extract transcript.");
    }

    // Use the videoTitle from API (if provided) or a default.
    // Append .txt to make it look like a text file for consistency if needed.
    const targetFileName = videoTitle ? `${videoTitle.replace(/[^a-zA-Z0-9\s_-]/g, '').trim()}.txt` : `youtube_transcript_${Date.now()}.txt`;

    // The `sourceUrl` will be the YouTube video URL itself.
    // This new function will handle saving text-only data.
    await uploadTextToSupabase(transcript, targetFileName, videoUrl);
  };
  function extractYouTubeVideoId(url) {
    try {
      const parsedUrl = new URL(url);

      // Handle short URLs like https://youtu.be/VIDEO_ID
      if (parsedUrl.hostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1); // Remove the leading '/'
      }

      // Handle full URLs like https://www.youtube.com/watch?v=VIDEO_ID
      if (parsedUrl.hostname.includes('youtube.com')) {
        const videoId = parsedUrl.searchParams.get('v');
        return videoId;
      }
    } catch (error) {
      console.error('Invalid URL provided to extractYouTubeVideoId:', error);
    }

    return null; // Return null if not a valid YouTube URL
  }

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-h-full bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 p-2 md:p-2 overflow-hidden"> {/* Ensure parent has height */}

      {/* Top Section with Remove Button or Placeholder */}
      <div className="w-full mb-2 flex  min-h-[44px] px-2"> {/* Fixed height to prevent layout shift */}
        {fileURLSupabase && !isLoading && file_id_s && ( // Show remove button only if file exists, not loading, and ID is known
          <button
            className="py-3 px-6 text-sm rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors mx-auto"
            onClick={() => DeleteFileFromSupabase(file_id_s)} // Pass the ID directly
            disabled={isLoading} // Already checked isLoading above, but good practice
          >
            Remove File
          </button>
        )}

        {(!fileURLSupabase || isLoading || !file_id_s) && (
          <div className="h-[44px]"></div> // Placeholder to maintain height
        )}
      </div>

      {/* Conditional Rendering Area */}
      <div className="flex-grow w-full flex flex-col items-center justify-center overflow-hidden"> {/* Takes remaining space */}

        {/* Dropzone */}
        {!fileURLSupabase && !isLoading && (
          <div
            {...getRootProps()}
            className={`flex flex-col w-full max-w-xl min-h-[200px] md:min-h-[300px] p-4 text-center border-4 border-dashed dark:border-zinc-600 border-blue-400 rounded-lg cursor-pointer hover:bg-slate-200 hover:dark:bg-zinc-800 transition-all duration-300 items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} // Use cursor-not-allowed when loading
            aria-disabled={isLoading}
          >
            <input {...getInputProps()} className="hidden" disabled={isLoading} />
            <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="dark:text-zinc-200 text-slate-800 font-medium">
              Drag & Drop your file here, or click to select
            </p>
            {/* --- UPDATED ACCEPTED FORMATS TEXT --- */}
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">Accepted formats: .pdf, .docx, .pptx</p>
          </div>
        )}
        {!fileURLSupabase && !isLoading && (
          <div className="mt-6 w-full max-w-xl">
            <p className="text-center dark:text-zinc-300 text-slate-700 mb-2">Or transcribe a YouTube video:</p>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Enter YouTube Video URL"
                className="flex-grow p-2 border dark:border-zinc-600 border-gray-300 rounded-md dark:bg-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleYouTubeUrlSubmit}
                disabled={isLoading || !youtubeUrl.trim()}
                className="py-2 px-4 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                Transcribe Video
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mb-4"></div>
            {/* Show filename being processed if available */}
            {fileName && <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">Processing: {fileName}</p>}
            <p className="text-yellow-600 dark:text-yellow-400 font-medium">{loadingMessage}</p>
          </div>
        )}

        {/* Error Display */}
        {error && !isLoading && ( // Show error only when not loading
          <div className="mt-4 p-3 w-full max-w-xl text-center bg-red-100 dark:bg-red-900 dark:bg-opacity-40 text-red-700 dark:text-red-300 rounded-md border border-red-300 dark:border-red-700">
            <p>{error}</p>

          </div>
        )}


        {/* File Viewer (iFrame) */}
        {fileURLSupabase && (() => {
          const videoId = extractYouTubeVideoId(fileURLSupabase);
          const containsYout = fileURLSupabase.toLowerCase().includes("https://yout");

          if (containsYout && videoId) {
            return (
              <iframe
                className="w-full aspect-video"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube Video Preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            );
          }
          else {

            return (
              <div className="w-full h-full flex-grow mt-2 rounded-lg overflow-hidden border dark:border-zinc-700 border-gray-300">

                {fileName && <p className="text-xs text-center p-1 bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 truncate">Viewing: {fileName}</p>}
                {isMobile ? (

                  <iframe
                    key={fileURLSupabase} // Force remount on URL change
                    src={`https://docs.google.com/gview?url=${encodeURIComponent(fileURLSupabase)}&embedded=true`}
                    className="w-full h-full block border-0"
                    title={fileName || "File Preview (Mobile)"}

                    onError={(e) => {
                      console.error("Mobile iframe error loading:", e.target.src, e);

                    }}
                    aria-label={`Preview of ${fileName || 'file'}`}
                  >
                    {/* Fallback content if iframe fails spectacularly */}
                    <p className="p-4">Loading preview... If it doesn't appear, the browser might not support inline PDF viewing.</p>
                  </iframe>
                ) : (
                  <iframe
                    src={fileURLSupabase}
                    className="w-full h-full block" // Use block display for iframe
                    title={fileName || "File Preview"} // Use dynamic title
                    sandbox
                    onError={(e) => console.error("Desktop iframe error:", e)}
                  ></iframe>
                )}
              </div>
            )

          }
        })()}



      </div> {/* End Conditional Rendering Area */}
    </div> // End Main Container
  );
}