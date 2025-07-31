'use client'
import { useState, useEffect } from "react";

import MainContent from "../components/MainContent";
import SideBar from "../components/SideBar";
export default function QuizApp() {

    return (
        <div className='flex min-h-screen relative w-full bg-slate-200'>
            <SideBar />
            <MainContent reading='false' />
        </div>
    );
}
