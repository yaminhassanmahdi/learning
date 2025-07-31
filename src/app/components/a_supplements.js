"use client"; // Keep this if it's a client component
import React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileQuestion, StickyNote, Layers } from 'lucide-react'; // Using more specific icons

// Array of features to display
const features = [
  { name: "Summaries", icon: FileText, color: "text-blue-500 dark:text-blue-400" },
  { name: "Notes", icon: StickyNote, color: "text-yellow-500 dark:text-yellow-400" },
  { name: "Quizzes", icon: FileQuestion, color: "text-green-500 dark:text-green-400" },
  { name: "Flashcards", icon: Layers, color: "text-purple-500 dark:text-purple-400" },
  // Add more features if your app supports them
];

export default function NoDocumentPlaceholder() { // Renamed for clarity, adjust if needed
  const [featureIndex, setFeatureIndex] = useState(0);

  // Effect to cycle through features every 3 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setFeatureIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 3000); // Change feature every 3 seconds

    return () => clearInterval(intervalId); // Cleanup timer on component unmount
  }, []); // Run only once on mount

  // Check if 'fid' exists (assuming 'fid' is passed as a prop or from context/atom)
  // const fid = useAtomValue(file_id_supabase); // Example if using Jotai
  // For this example, let's assume 'fid' is checked *before* rendering this component.
  // The parent component would conditionally render this placeholder if !fid.

  return (
    // Main container with gradient background and rounded corners
    <div className="flex flex-col dark:bg-zinc-900 bg-slate-50 mt-5 h-[97%] w-[91%] md:w-[98%] md:mx-auto p-6 justify-center items-center rounded-lg">
      <div className="flex flex-col min-h-full justify-center items-center relative w-11/12 text-center">

        {/* Animated main icon - subtle pulse */}
        <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
            {/* You can use a generic File icon or cycle through feature icons here too */}
            <FileText size={56} className="text-gray-400 dark:text-gray-500 mb-6" strokeWidth={1.5} />
        </motion.div>

        {/* Main Heading */}
        <h1 className="text-xl md:text-2xl font-semibold dark:text-zinc-100 text-slate-800 mb-3">
          No Document Selected
        </h1>

        {/* Instructional Text (Static Part 1) */}
        <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-4 max-w-md">
          Upload a document to this chat session to unlock powerful tools like:
        </p>

        {/* Animated Feature Section */}
        <div className="h-20 overflow-hidden relative w-full max-w-md mx-auto mb-4"> {/* Container for rolling animation */}
          <AnimatePresence mode="wait"> {/* Use mode="wait" for smoother transitions */}
            <motion.div
              key={featureIndex} // Key change triggers the animation
              className={`absolute inset-0 flex items-center justify-center gap-2 ${features[featureIndex].color}`}
              initial={{ y: 30, opacity: 0 }} // Start below and faded out
              animate={{ y: 0, opacity: 1 }} // Animate to center and fully visible
              exit={{ y: -30, opacity: 0 }} // Exit upwards and faded out
              transition={{ duration: 0.5, ease: "easeInOut" }} // Animation timing
            >
              {/* Render the icon for the current feature */}
             
              {/* Render the name of the current feature */}
              <span className="font-medium text-lg md:text-[60px]">
                {features[featureIndex].name}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Instructional Text (Static Part 2 - Optional) */}
        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
          and much more!
        </p>

      </div>
    </div>
  );
}