"use client";
import { atom, useAtom, useAtomValue } from "jotai";

import { useState } from "react";
import {
  fileAtom,
  textAtom,
  fileNameAtom,
  file_url_supabase,
} from "../../store/uploadAtoms";
import { Document, Page } from "react-pdf"; // For rendering PDFs
import UploadComponent from "./uploadComponent";
export default function Supplements2() {
  const file = useAtomValue(fileAtom);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const textContent = useAtomValue(textAtom);
  const fileName = useAtomValue(fileNameAtom);
  const fileURLSupabase = useAtomValue(file_url_supabase);


  return (
    <div className=" flex flex-col dark:bg-zinc-900 bg-slate-50 mt-5 h-[97%] w-[91%] 
  md:w-[98%]
    md:mx-auto   p-6 rounded-lg">

      <UploadComponent />
    </div>
  );
}
