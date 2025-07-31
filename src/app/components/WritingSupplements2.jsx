"use client";
import { useState } from "react";
import Flashcards from "./Flashcards";
import UserNotes from "./UserNote";
import QuizTab from "./QuizTab";
import SummaryTab from "./SummaryTab";
export default function WritingSupplements2() {
  const [activeTab, setActiveTab] = useState("summary");

  const tabs = [
    // { name: "Chat", id: "chat" },
    { name: "Summary", id: "summary" },
    { name: "Note", id: "note" },
    { name: "Flash cards", id: "flashcards" },
    { name: "Quiz", id: "quiz" },
  ];

  return (
    <div className=" flex flex-col bg-slate-50 mt-5 h-[34rem] w-[47%] ml-auto mr-5 p-6 rounded-lg">
      {/* Tab Buttons */}
      <div className="flex flex-row  bg-gray-100 p-2 rounded-lg text-center justify-evenly">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 rounded-full font-extralight cursor-pointer ${
              activeTab === tab.id
                ? "bg-white shadow-md font-medium text-slate-700"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mt-6 flex flex-col h-full  rounded-lg">
        {activeTab === "summary" && <SummaryTab />}
        {activeTab === "chat" && <p>Chat content here...</p>}
        {activeTab === "note" && <UserNotes />}
        {activeTab === "flashcards" && <Flashcards />}
        {activeTab === "quiz" && <QuizTab />}
      </div>
    </div>
  );
}
