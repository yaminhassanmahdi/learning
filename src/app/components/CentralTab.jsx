import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    FileEdit,
    BrainCircuit,
    BookOpenText,
    MessageCircleQuestionIcon,
    PencilIcon,
    MicroscopeIcon,
    ChevronDown,
    Menu,
    LogOutIcon,
    User,
    Crown,
} from "lucide-react";
import {
    sideBar_state,
    centralTab,
    user_id_supabase
} from "../../store/uploadAtoms";
import { useAtom } from "jotai";
import ProButton from "@/components/PaymentButton";
import UserProfileModal from "./UserProfileModal";
import { isUserPremium } from "@/lib/isPremium";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

// Add the shine animation styles
const shineStyles = `
@keyframes shine {
    from {
        transform: translateX(-100%) skewX(-15deg);
    }
    to {
        transform: translateX(200%) skewX(-15deg);
    }
}

.shine-effect {
    position: relative;
    overflow: hidden;
}

.shine-effect::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 50%;
    height: 100%;
    background: linear-gradient(
        to right,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.3) 50%,
        rgba(255, 255, 255, 0) 100%
    );
    transform: skewX(-15deg);
    animation: shine 3s infinite;
}
`;

export default function CentralTab() {
    const [activeTab, setActiveTab] = useAtom(centralTab);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [previousTab, setPreviousTab] = useState(null);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const [uid, setUid] = useAtom(user_id_supabase);
    const [isPremium, setIsPremium] = useState(false);

    // Check premium status when uid changes
    useEffect(() => {
        const checkPremiumStatus = async () => {
            if (uid) {
                const premiumStatus = await isUserPremium(uid);
                setIsPremium(premiumStatus);
            }
        };
        checkPremiumStatus();
    }, [uid]);

    const tabs = [
        { name: "Home", id: "summary", icon: BookOpenText },
        { name: "Search", id: "gemini_chat", icon: MessageCircleQuestionIcon },
        { name: "Reading", id: "note", icon: FileEdit },
        { name: "Exam Prep", id: "exmprep", icon: BrainCircuit },
        { name: "Write", id: "write", icon: PencilIcon },
        { name: "Solver", id: "sci_chat", icon: MicroscopeIcon },
    ];

    // Find the active tab
    const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];
    const ActiveIcon = activeTabData.icon;

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsDropdownOpen(false);
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Handle tab selection
    const handleTabSelect = (tabId) => {
        setActiveTab(tabId);
        setIsDropdownOpen(false);
    };
    const handleLogout = useCallback(async () => {
        setUid(null);
        setActiveTab('summary'); // Set active tab to home page after logout
    }, [setUid, setActiveTab]);

    // Replace the ProButton component in both MobileView and DesktopView with this:
    const PremiumButton = () => {
        if (isPremium) {
            return (
                <>
                    <style>{shineStyles}</style>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                className="shine-effect bg-yellow-500/90 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                <Crown className="h-4 w-4" />
                                <span>Pro</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="my-4 py-5 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-yellow-500/20">
                            <DialogTitle className="text-xl text-center text-yellow-400 font-semibold flex items-center justify-center gap-2">
                                <Crown className="h-6 w-6" />
                                Premium Member
                            </DialogTitle>
                            <div className="text-center text-zinc-300 mt-4">
                                <p className="text-lg">You are already a premium member!</p>
                                <p className="text-sm text-zinc-400 mt-2">Enjoy unlimited access to all features.</p>
                            </div>
                            <DialogFooter className="mt-6">
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                                    >
                                        Close
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            );
        }
        return <ProButton />;
    };

    // Mobile view (screen width < 768px)
    const MobileView = () => (
        <div className="relative bgblue-200 mt-4 w-56 items-center justify-center flex flex-col">
            {/* Mobile Button */}
            <div className="flex items-center gap-2">
                <button
                    ref={buttonRef}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-zinc-800 shadow-lg rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                >
                    <ActiveIcon size={18} className="text-blue-600 dark:text-green-300" />
                    <span className="font-medium text-sm">{activeTabData.name}</span>
                    <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                <PremiumButton />
            </div>

            {/* Mobile Dropdown */}
            {isDropdownOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-2 z-50"
                >
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabSelect(tab.id)}
                                className={`w-full px-4 py-2 text-sm font-medium flex items-center space-x-2 ${isActive
                                    ? "bg-gray-100 dark:bg-zinc-700 text-blue-600 dark:text-green-300"
                                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                    }`}
                            >
                                <Icon size={16} className="flex-shrink-0" />
                                <span>{tab.name}</span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => {
                            setPreviousTab(activeTab);
                            setActiveTab('summary');
                            setIsProfileModalOpen(true);
                            setIsDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 flex items-center justify-center gap-2 transition-colors duration-200"
                    >
                        <User size={16} />
                        Profile
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-[8rem] px-4 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:dark:bg-red-900 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed mx-auto my-2"
                    >
                        <LogOutIcon size={16} />
                        Logout
                    </button>
                </div>
            )}
        </div>
    );

    // Desktop view (screen width >= 768px)
    const DesktopView = () => (
        <div className={`${activeTab === "summary" ? "" : "absolute"} z-[70] flex items-center gap-4 dark:bg-zinc-900 bg-gray-100 p-1.5 rounded-lg mb-4 w-[60rem] flex-shrink-0 mx-auto transform-cpu    
        ${activeTab === "summary" ? "mt-5" : "hover:border-2 dark:hover:border-green-300/50 hover:border-blue-400/50 -translate-x-1/2 left-1/2 -top-2 duration-300 hover:top-2 group scale-[.5] hover:scale-[1]"}`}>
            <div className="grid grid-cols-6 gap-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    const buttonClass = `flex items-center justify-center space-x-1.5 px-3 py-2 text-sm rounded-md font-medium cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 
                        ${activeTab === "summary" ? "px-3 py-2" : "group-hover:scale-[1]"}
                        ${isActive
                            ? "bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-green-300"
                            : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700/70 hover:text-gray-700 dark:hover:text-zinc-200"
                        }`;

                    return (
                        <button
                            key={tab.id}
                            className={buttonClass}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {Icon && <Icon size={16} className="flex-shrink-0" />}
                            <span className="truncate">{tab.name}</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
                >
                    <User size={16} />
                    Profile
                </button>
                <PremiumButton />
                <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/50 dark:text-red-300 hover:dark:bg-red-900 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
                >
                    <LogOutIcon size={16} />
                    Logout
                </button>
            </div>
        </div>
    );

    return (
        <div className={`w-full flex justify-center ${activeTab === "gemini_chat" || activeTab === "sci_chat"
            ? "md:sticky md:top-0 md:z-40 md:h-auto fixed z-40 h-[4.3rem] backdrop-blur-xs md:backdrop-blur-none"
            : ""
            } ${activeTab === "note" || activeTab === "exm-prep"
                ? "md:relative md:z-[99] md:h-auto fixed backdrop-blur-xs h-[4.3rem] z-[99] md:backdrop-blur-none"
                : ""
            }`}>
            {/* Show mobile view on small screens, desktop view on larger screens */}
            <div className="md:hidden">
                <MobileView />
            </div>
            <div className="hidden md:block">
                <DesktopView />
            </div>
            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => {
                    setIsProfileModalOpen(false);
                    if (previousTab && window.innerWidth < 768) {
                        setActiveTab(previousTab);
                        setPreviousTab(null);
                    }
                }}
            />
        </div>
    );
}