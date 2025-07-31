'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import pdfToText from 'react-pdftotext';
import { useAtom, useAtomValue } from 'jotai';
import { fileAtom, textAtom, fileNameAtom, chat_id_supabase, file_url_supabase } from '../../store/uploadAtoms';
import { supabase } from '../lib/supabaseClient'; // Ensure you have Supabase client setup

export default function FileUpload() {
  const [file, setFile] = useAtom(fileAtom);
  const [fileURLSupabase, setFileURLSupabase] = useAtom(file_url_supabase)
  const [textContent, setTextContent] = useAtom(textAtom);
  const [fileName, setFileName] = useAtom(fileNameAtom);
  const [isLoading, setIsLoading] = useState(false);
  const chatId = useAtomValue(chat_id_supabase)
  const { getRootProps, getInputProps } = useDropzone({
    accept: '.pdf,.docx,.pptx',
    onDrop: (acceptedFiles) => handleFileUpload(acceptedFiles[0])
  });
  // const chatId = 'fc23d2c3-e73b-4392-8ca0-069fbd6246f1';
  // Handle File Upload
  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;

    setIsLoading(true);
    setFile(uploadedFile);
    setFileName(uploadedFile.name);

    const fileType = uploadedFile.name.split('.').pop().toLowerCase();
    let extractedText = "";

    try {
      // Extract text from the file
      if (fileType === 'pdf') extractedText = await extractTextFromPDF(uploadedFile);
      else if (fileType === 'docx') extractedText = await extractTextFromDOCX(uploadedFile);
      else if (fileType === 'pptx') extractedText = await extractTextFromPPTX(uploadedFile);
      else throw new Error("Unsupported file format");

      // Upload file to Supabase Storage and store metadata
      await uploadToSupabase(uploadedFile, extractedText);
    } catch (error) {
      console.error("Error processing file:", error);
      setTextContent("Error processing file");
    } finally {
      setIsLoading(false);
    }
  };

  // Extract Text from PDF
  const extractTextFromPDF = async (file) => {
    try {
      return await pdfToText(file);
    } catch (error) {
      console.error("PDF text extraction error:", error);
      return "";
    }
  };

  // Extract Text from DOCX
  const extractTextFromDOCX = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (error) {
          console.error("DOCX extraction error:", error);
          reject("");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Extract Text from PPTX
  const extractTextFromPPTX = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const zip = await JSZip.loadAsync(arrayBuffer);
          let extractedText = "";

          const slideFiles = Object.keys(zip.files).filter(
            (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
          );

          for (const slide of slideFiles) {
            const content = await zip.files[slide].async("text");
            extractedText += content.replace(/<.*?>/g, " ").trim() + " ";
          }

          resolve(extractedText);
        } catch (error) {
          console.error("PPTX extraction error:", error);
          reject("");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Upload file to Supabase Storage and store metadata
  const uploadToSupabase = async (file, extractedText) => {
    if (!chatId) {
      console.error("Chat ID is missing");
      return;
    }

    console.log("Checking existing file for chat ID:", chatId);

    // Step 1: Check if a file already exists for the given chat ID
    const { data: existingFile, error: fetchError } = await supabase
      .from("files")
      .select("id, file_url")
      .eq("chat_id", chatId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching existing file:", fetchError);
      return;
    }

    // Step 2: If a file exists, delete it from storage & database
    if (existingFile) {
      console.log("Existing file found. Deleting old file...");

      // Extract the file path from the URL
      const filePath = existingFile.file_url.split("/storage/v1/object/public/file-uploads/")[1];

      // Delete the file from storage
      const { error: deleteStorageError } = await supabase.storage
        .from("file-uploads")
        .remove([filePath]);

      if (deleteStorageError) {
        console.error("Error deleting old file from storage:", deleteStorageError);
        return;
      }

      // Delete file record from `files` and `file_data`
      const { error: deleteFileError } = await supabase.from("files").delete().eq("chat_id", chatId);
      const { error: deleteFileDataError } = await supabase.from("file_data").delete().eq("file_id", existingFile.id);

      if (deleteFileError || deleteFileDataError) {
        console.error("Error deleting old file data:", deleteFileError || deleteFileDataError);
        return;
      }

      console.log("Old file deleted successfully!");
    }

    // Step 3: Upload the new file
    const newFilePath = `uploads/${chatId}/${Date.now()}_${file.name}`;
    console.log("Uploading new file...");

    const response = await file.handle.getFile();
    const fileBlob = new Blob([response], { type: file.type });

    const { error: uploadError } = await supabase.storage
      .from("file-uploads")
      .upload(newFilePath, fileBlob);

    if (uploadError) {
      console.log("File upload error:", uploadError);
      return;
    }

    // Step 4: Get public URL of uploaded file
    const { data: urlData } = supabase.storage.from("file-uploads").getPublicUrl(newFilePath);
    const fileUrl = urlData.publicUrl;
    console.log("New file URL:", fileUrl);
    setFileURLSupabase(fileUrl);

    // Step 5: Insert new file into `files` table
    const { data: fileRecord, error: insertError } = await supabase
      .from("files")
      .insert({
        chat_id: chatId,
        file_name: file.name,
        file_url: fileUrl,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting new file into database:", insertError);
      return;
    }

    const fileId = fileRecord.id;

    // Step 6: Insert into `file_data` table
    const { error: fileDataError } = await supabase.from("file_data").insert({
      file_id: fileId,
      summary: null,
      flashcards: null,
      quiz: null,
      raw_text: extractedText || null,
    });

    if (fileDataError) {
      console.error("Error inserting into file_data table:", fileDataError);
    } else {
      console.log("New file uploaded and database updated successfully!");
    }
  };


  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-200 text-slate-900 p-6">
      <button className='p-5 rounded-lg mb-5 bg-blue-400' onClick={() => { setFile(""); setFileName("") }}>
        Remove file
      </button>

      {!file && (
        <div
          {...getRootProps()}
          className="flex flex-col w-full h-10/12 p-6 text-center border-4 border-dashed border-blue-600 rounded-lg cursor-pointer hover:bg-slate-300 transition-all duration-300 items-center justify-center"
        >
          <input {...getInputProps()} className="hidden" />
          <p className="text-slate-900">Drag & Drop your file here, or click to select</p>
          <p className="text-gray-700">Accepted formats: .pdf, .docx, .pptx</p>
        </div>
      )}

      {isLoading && <p className="text-yellow-400 mt-3">Processing file...</p>}
      {fileName && <p className="text-slate-900 mt-3">📄 {fileName}</p>}
      {fileURLSupabase && <iframe
        // https://gzubzmayzyvjmxqgympo.supabase.co/storage/v1/object/public/file_uploads/uploads/fc23d2c3-e73b-4392-8ca0-069fbd6246f1/1743152967255_7-1-5-1-2.pdf'
        src={fileURLSupabase}
        width="50%"
        height="600px">
      </iframe>}
    </div>
  );
}
