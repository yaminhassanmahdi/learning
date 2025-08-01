'use client'
import Image from "next/image";
import SideBar from "./components/SideBar";
import Supplements from './components/Supplements'
import SearchBar from './components/Searhbar'
import MainContent from './components/MainContent'
import { useAtom, useAtomValue } from "jotai";
import { Sun, Moon, Link, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import EWTPage from './ewt/page'
import { useRouter } from 'next/navigation';
import {
  sideBar_state,
  centralTab,
  user_id_supabase
} from "../store/uploadAtoms";
import { Menu, LogOutIcon } from "lucide-react";
import useIsMobile from "./components/useIsMobile";
import {
  FileTextIcon,
  FileEdit,
  LibraryBig,
  FileQuestionIcon,
  FileIcon,
  AlertCircle,
  ListChecks,
  SmileIcon,
  BrainCircuit,
  BookOpenText,
  Layers,
  MessageCircleQuestionIcon,
  // Link
} from "lucide-react";
import ExamPrepCreator from './exm_prep/page'
import CalendarPage from './cal/page'
import WeeklyLeaderboard from "./components/LeaderBoardForHome";
import ScienceChat from './sci_chat/page.jsx'
import CentralTab from './components/CentralTab'
import { useRef, useEffect, useState, useCallback } from 'react'
import { BackgroundBeams } from "@/components/ui/background-beams";
import { Vortex } from '@/components/ui/vortex'
import Marquee from "react-fast-marquee";
import { AuroraText } from "@/components/magicui/aurora-text";
import { BorderBeam } from "@/components/magicui/border-beam";
import { supabase } from "./lib/supabaseClient";
import { useUserActivityAPI } from './lib/getUsage'
import ProButton from "@/components/PaymentButton";
import GemCloneChatPage from './chatg/page'
import { isUserPremium } from "@/lib/isPremium";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RainbowButton } from "@/components/magicui/rainbow-button";
import ProtectedRoute from './components/ProtectedRoute';

export default function Home() {
  const [isOpen, setIsOpen] = useAtom(sideBar_state);
  const [uid, setUid] = useAtom(user_id_supabase); // Read uid value directly
  const { getUserActivityUsage, decrementUserActivityUsage } = useUserActivityAPI();
  const { user, loading } = useAuth();
  const router = useRouter();

  const isMobile = useIsMobile();
  const sidebarRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user_premium, set_user_premium] = useState(false);

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (!loading && !user) {
      router.push('/landing');
    }
  }, [user, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 23 || hour < 5) {
      return "Night Owl";
    } else if (hour >= 20 && hour < 23) {
      return "Grinding Before Sleep";
    } else if (hour >= 16 && hour < 20) {
      return "Good Evening";
    } else if (hour >= 12 && hour < 16) {
      return "Good Afternoon";
    } else if (hour >= 5 && hour < 9) {
      return "Good Morning";
    } else if (hour >= 9 && hour < 12) {
      return "Early Worker";
    }
  };

  useEffect(() => {
    console.log("theme changing useeffect")
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
      console.log("Dark mode turned true")
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
      console.log("Dark mode turned false")

    }
  }, [isDarkMode]); // This runs once on component mount to check localStorage
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark'); // Remove dark mode class
      localStorage.setItem('darkMode', 'disabled'); // Update localStorage
    } else {
      document.documentElement.classList.add('dark'); // Add dark mode class
      localStorage.setItem('darkMode', 'enabled'); // Update localStorage
    }
    setIsDarkMode(!isDarkMode); // Toggle the state
  };

  const getUsername = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('id', uid)
      .single();
    return data?.name;
  };
  const [name, setName] = useState(null)

  useEffect(() => {
    async function fetchName() {
      const username = await getUsername()
      setName(username)
    }
    const checkPremium = async (USER_ID) => {
      const isPremium = await isUserPremium(USER_ID);
      set_user_premium(isPremium)
      if (isPremium) {
        console.log("User is premium!");
      } else {
        console.log("User is not premium.");
      }
    };
    if (uid) {
      fetchName()
      checkPremium(uid)
    }
  }, [uid])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setIsOpen(false); // Close sidebar
      }
    };

    // ✅ Add event listener
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside); // Mobile support

    return () => {
      // ✅ Remove event listener on cleanup
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);
  const [activeTab, setActiveTab] = useAtom(centralTab);



  const router = useRouter();
  const handleLogout = useCallback(async () => {
    setUid(null);;
  }, [setIsOpen, setUid]);
  function HomePage() {
    return (
      <div className="relative z-40">

        <h1 className="text-zinc-800  dark:text-zinc-200 mx-auto text-3xl md:text-7xl font-extralight text-center mt-8 z-40">
          {getTimeBasedGreeting()}, <AuroraText>{name}!</AuroraText>
        </h1>

        <div className="flex flex-col-reverse md:flex-row w-full bg-blue400 md:h-[32rem] md:gap-2 lg:gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 mx-auto w-[95%]  md:w-[60%]  gap-5 items-center z-40 bgblue-300 h-fit my-auto">
            {[
              {
                icon: <BookOpenText size={40} className="text-pink-500" />,
                title: "Flow is the Go",
                description: "AI-powered flowcharts, tables & 'Explain Like I'm 6' vibes—get it in one go",
              },
              {
                icon: <FileEdit size={40} className="text-yellow-400" />,
                title: "3-Min Spice Up",
                description: "Quick, crispy 3-min notes for last-minute wins. No fluff, just facts",
              },
              {
                icon: <Layers size={40} className="text-emerald-400" />,
                title: "Get Some Flashes",
                description: "Smarter flashcards, auto-made from your lessons. No more highlight hell",
              },
              {
                icon: <ListChecks size={40} className="text-indigo-400" />,
                title: "Test Your Skills",
                description: "Mock tests, speed rounds & XP-fueled quizzes. Learn. Compete. Win",
              },
              {
                icon: <SmileIcon size={40} className="text-violet-400" />,
                title: "Memes FTW!",
                description: "Get AI-made memes from your notes. Laugh, learn, and share the fun",
              }


            ].map((card, index) => (
              <div
                key={index}
                onClick={() => setActiveTab("note")}
                className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 w-[100%] text-lg rounded-lg px-4 py-3 flex flex-row items-center justify-center space-x-4 hover:scale-[1.05] transform duration-300 cursor-pointer hover:shadow-md  
              min-h-[4rem] dark:hover:shadow-sm dark:shadow-indigo-400 shadow-zinc-300"
              >
                {card.icon}
                <div className="w-[80%] ml-4">
                  <h1 className={card.icon.props.className}>{card.title}</h1>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}

            <div
              onClick={() => {
                setActiveTab("exmprep");
              }}
              className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 w-[100%] rounded-lg px-4 py-3 flex flex-row items-center justify-center space-x-4 hover:scale-[1.05] transform duration-300 cursor-pointer hover:shadow-md dark:hover:shadow-sm dark:shadow-indigo-400 shadow-zinc-300 min-h-[4rem]"
            >
              <BrainCircuit size={40} className="text-orange-300" />
              <div className="w-[80%] ml-4">
                <h1 className="text-orange-300">Generate Personalized Prep</h1>
                <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
                  Last-minute? Get crisp 3-min notes that stick—with max focus, zero stress
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col w-[20rem] my-5  md:w-[30rem] mx-auto md:my-auto h-fit bgamber-200">
            <CalendarPage />
          </div>
        </div>



      </div>
    );
  }

  function HomePageWithoutLogin() {
    return (
      <div className="relative z-40 min-h-screen ">
        {/* <BackgroundBeams /> */}
        <h1 className="w-[80%] leading-14 mt-20 mx-auto font-semibold text-3xl md:text-6xl text-center my-4 md:mt-20 z-40 text-zinc-900 dark:text-zinc-200">
          Embark on a Fast-Track Learning Adventure
          <span className="text-xl"> with </span>
          <AuroraText speed={2.5} className="text-6xl mt-5">Learningly</AuroraText>
        </h1>

        <h1 className="mx-auto text-lg w-[90%] md:text-xl text-center my-5 z-40 text-zinc-600 dark:text-zinc-400">
          • <span>9x</span> faster than traditional platforms • Multi-AI Power • Budget-friendly brilliance
        </h1>

        <button
          className="absolute left-1/2 top-1/2 cursor-pointer -translate-x-1/2 px-7 py-3 mt-8 relative rounded-lg bg-zinc-900 text-zinc-200 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200 transform duration-300 text-3xl mx-auto"
          onClick={() => router.push("/login")}
        >
          Try it now!
          <BorderBeam />
        </button>

        <div className="w-full gap-4 z-40 flex flex-row h-[10rem] mt-4 md:mt-10 relative">
          <div className="absolute left-0 top-0 h-full w-30 bg-gradient-to-r from-zinc-200 to-transparent 
          dark:from-[rgb(39,39,42)] z-50" />
          <div className="absolute right-0 top-0 h-full w-30 bg-gradient-to-l from-zinc-200 to-transparent dark:from-[rgb(39,39,42)] z-50" />



          <Marquee
            autoFill={true}
            className="gap-4"
            speed={100}
            style={{
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
            pauseOnHover={true}
            gradientWidth={isMobile ? 50 : 220}
          >
            {/* CARD ITEM TEMPLATE */}
            {[
              {
                icon: <BookOpenText size={40} className="text-pink-500" />,
                title: "Flow is the Go",
                desc: "Summaries that actually make sense... Explain With Vibes",
              },
              {
                icon: <FileEdit size={40} className="text-yellow-400" />,
                title: "3-Min Spice Up",
                desc: "Final notes that stick... maximum retention with minimum stress.",
              },
              {
                icon: <Layers size={40} className="text-emerald-400" />,
                title: "Get Some Flashes",
                desc: "Flashcards that don't suck... no need to highlight for hours.",
              },
              {
                icon: <ListChecks size={40} className="text-indigo-400" />,
                title: "Test Your Skills",
                desc: "Quiz like a boss... Earn XP, rise in the leaderboard.",
              },
              {
                icon: <SmileIcon size={40} className="text-violet-400" />,
                title: "Memes FTW!",
                desc: "Learningly generates hilarious, personalized memes from your lecture topics.",
              },
              {
                icon: <BrainCircuit size={40} className="text-orange-300" />,
                title: "Generate Personalized Prep",
                desc: "Final notes that stick... maximum retention with minimum stress.",
              },
            ].map((card, index) => (
              <div
                key={index}
                onClick={() => router.push("/login")}
                className="bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200 text-2xl rounded-lg px-4 py-3 flex flex-row items-center justify-center space-x-4 hover:scale-[1.05] transform duration-300 cursor-pointer hover:shadow-sm shadow-indigo-400 mx-2"
              >
                {card.icon}
                <div className="w-[80%] ml-4">
                  <h1 className={card.icon.props.className}>{card.title}</h1>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{card.desc}</p>
                </div>
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    );
  }




  return (
    <div className={`flex flex-col md:h-[100vh] relative ${(activeTab === "gemini_chat" || activeTab === 'sci_chat' || activeTab === 'exmprep') ? 'h-[100vh]' : 'h-[200vh]'} w-full  ${activeTab === "summary" ? 'bg-zinc-200 dark:bg-zinc-800 h-fit pb-10' : 'dark:bg-zinc-800'} bg-zinc-200 scrollbar-hide`}>
      {activeTab === "note" &&
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed menu-button p-2 rounded-md text-black dark:text-white hover:bg-gray-100 hover:text-gray-800 focus:outline-none outline-0 transition-all duration-300 ease-in-out mt-5 z-50
        ${isOpen ? "translate-x-[13rem]" : "translate-x-4"}`}
        >

          {isOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}

        </button>
      }
      {activeTab === "summary" && <BackgroundBeams />}
      {/* {activeTab === "summary" && uid && <button
        onClick={handleLogout}

        className="w-[8rem] px-4 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:dark:bg-red-900 rounded-lg md:flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed absolute top-5 left-5 z-50 hidden"
      >
        <LogOutIcon size={16} />
        Logout
      </button>} */}

      {["note", "gemini_chat", "sci_chat", "write", "summary", "exmprep"].includes(activeTab) && (
        <button
          onClick={toggleDarkMode}
          className="fixed top-5 right-3 md:right-6 w-9 h-9 flex items-center justify-center bg-gray-300/60 hover:bg-gray-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 rounded-full transition-colors duration-300 z-50"
        >
          <div className="w-6 h-6 bg-white dark:bg-gray-900 rounded-full shadow-md flex items-center justify-center">
            {isDarkMode ? (
              <Moon size={isMobile ? 10 : 16} className="text-white" />
            ) : (
              <Sun size={isMobile ? 10 : 16} className="text-yellow-500" />
            )}
          </div>

        </button>
      )}
      {/* {["note", "gemini_chat", "sci_chat", "write", "summary", "exmprep"].includes(activeTab) && uid && !user_premium && (
        <button
          className="fixed  top-5 md:top-5 scale-[.75] md:scale-[1] right-16 md:right-24 w-9 h-9 flex items-center justify-center bg-gray-300/60 hover:bg-gray-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 rounded-full transition-colors duration-300 z-50"
        >

          <ProButton />
        </button>
      )} */}
      {/* {user_premium && uid && (

        <button
          className="fixed top-5 md:top-5 scale-[.75] md:scale-[1] right-14 md:right-24 w-9 h-9 flex items-center justify-center  rounded-full  duration-300 z-50"
        >

          <Dialog >
            <DialogTrigger asChild>
              <Button type="submit" formMethod="post" className="rounded-lg" variant={"default"}>
                Pro
              </Button>
            </DialogTrigger>
            <DialogContent className="my-4  py-5 bg-black/60">
              <DialogTitle className="text-xl text-center text-white font-semibold">
                You are already a premium member!
              </DialogTitle>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </button>
      )} */}


      <div ref={sidebarRef}>
        <SideBar />
      </div>

      <div className={`flex-1 transition-all duration-300 ${isMobile ? ('ml-0') : (isOpen ? "ml-[16.5rem]" : "ml-0")} z-40`}>

        {uid && <CentralTab />}
        {/* <h1>Helloo</h1> */}


        {activeTab === "note" && <MainContent />}
        {activeTab === "summary" && uid && <HomePage />}
        {activeTab === "gemini_chat" && uid && <GemCloneChatPage />}
        {activeTab === "write" && uid && <EWTPage />}
        {activeTab === "exmprep" && uid && <ExamPrepCreator />}
        {activeTab === "sci_chat" && uid && <ScienceChat />}
        {activeTab === "summary" && !uid && <HomePageWithoutLogin />}

      </div >
    </div >
  );
}
