import React, { useState, useEffect } from 'react';

/**
 * An enhanced loading spinner component with rotating Gen Z-inspired messages.
 * Uses Tailwind CSS for styling with improved contrast for both light and dark modes.
 *
 * @param {object} props - Component props.
 * @param {string} [props.message] - Optional custom message (overrides random messages).
 * @param {string} [props.size="h-12 w-12"] - Tailwind size class for the spinner.
 * @param {string} [props.color="border-blue-500 dark:border-blue-400"] - Tailwind border color class.
 */
const LoadingSpinner = ({ message, size = "h-12 w-12", color = "border-blue-500 dark:border-blue-400" }) => {
    // Array of Gen Z-inspired loading messages with emojis
    const loadingMessages = [
        // Original vibe messages
        "Loading the vibes... ✨",
        "It's giving... patience 💅",
        "Cooking up something fire 🔥",
        "This is so mid... jk loading 😎",
        "No cap, almost ready 🧢",
        "Manifesting your content ✌️",
        "Low-key working on it 👀",
        "Making it extra... 💯",
        "Slaying this process 💁‍♂️",
        "Bestie, just a sec ⏱️",
        "Absolutely living while loading 💫",
        "Vibe check in progress 🌈",
        "Fr fr, almost done 🤙",
        "Rizzing up your data 💯",
        "Yeet-ing into existence 🚀",

        // Trump & political references
        "Making loading great again",
        "Building a wall around slow servers 🧱",
        "Tremendous loading, believe me 👐",
        "Tariff-free content coming through 📊",
        "Biden's probably still loading... 😴",
        "Loading bigly, so bigly you won't believe it 👌",
        "This load time is RIGGED! 🗣️",
        "Your data just got 10% faster 📈",
        "Infrastructure weeks actually work here 🏗️",
        "Executive order: Content must load NOW 📝",
        "The best loading, everyone says so 🌟",
        "We have the technology, the best technology 🖥️",
        "Securing the border of your content 🛡️",
        "Economy's booming, loading times shrinking 💰",

        // Social media & trending references
        "Passing the TikTok algorithm check ✅",
        "Sliding into your DMs with content 💬",
        "Adding BeReal authenticity to your wait time 📸",
        "Main character energy loading... 💅",
        "This wait is giving Elon Musk tweet energy ⚡",
        "Soft-launching your content 🤳",
        "Serving coquette loading realness 🎀",
        "Your Roman Empire thoughts loading 🏛️",
        "Brat summer loading in progress 💁‍♀️",
        "Doing it for the algorithm 🤖",
        "Quiet luxury loading experience 💎",
        "Demure while we procure 🧘‍♀️",
        "This loading isn't chronically online 🌿",
        "Espresso loading, not depresso ☕",
        "Core memory forming in 3...2...1... 🧠",

        // Pop culture & trends
        "Goblin mode activated while loading 👺",
        "In era, in my Reputation era of loading 🎵",
        "Clean girl aesthetic loading... 🧼",
        "Aligned with your Mercury retrograde 🪐",
        "AI overlords preparing your content 🤖",
        "Coastal grandmother approved loading time 👵",
        "Eras Tour ticket queue simulator 🎟️",
        "Barbieheimer levels of processing 💖🖤",
        "As seen on #LoadingTok 📱",
        "Not nepo baby loading - working hard 💼",
        "Serving Stanley Cup loading realness 🥤",
        "Taylor's Version of your content loading 🎸",
        "Rizz loading to maximum capacity 💯",
        "Introducing beef-free content 🥩❌",
        "Your villain origin story is loading 😈",

        // Crypto, AI & tech references
        "NFT of this loading screen minting now 🖼️",
        "To the moon with your content 🚀",
        "Mining your content (environmentally friendly) ♻️",
        "Web3 loading experience (still centralized tho) 🕸️",
        "AI hallucinating your perfect content 🤯",
        "Diamond hands holding your content 💎👐",
        "HODL, content incoming 📊",
        "Gas fees waived for this transaction ⛽",
        "Prompt engineering your perfect response 🧠",
        "Optimizing for engagement (respectfully) 📱",
        "Training our AI on exclusively rizz content 🧪",
        "Silicon Valley approved loading time 💻"
    ];

    // State to track current message index
    const [msgIndex, setMsgIndex] = useState(0);

    // Rotate through messages every 2 seconds
    useEffect(() => {
        if (!message) { // Only rotate if no custom message is provided
            const interval = setInterval(() => {
                setMsgIndex((current) => (current + 1) % loadingMessages.length);
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [message, loadingMessages.length]);

    // Determine which message to display
    const displayMessage = message || loadingMessages[msgIndex];

    return (
        <div className="flex flex-col z-40 items-center justify-center text-center p-4" aria-live="assertive" role="status">
            {/* Enhanced Spinner with better contrast for light mode */}
            <div className="relative">
                <div
                    className={`animate-spin rounded-full border-t-4 border-b-4 ${size} ${color} shadow-lg`}
                >
                    <span className="sr-only">Loading</span>
                </div>
                {/* Light mode visible pulse overlay */}
                <div className={`absolute top-0 left-0 ${size} rounded-full border-2 border-green-300 dark:border-green-500 opacity-40 animate-pulse`}></div>
            </div>

            {/* Message with bouncing dots animation and improved contrast */}
            <div className="mt-4 text-sm font-medium text-green-300 dark:text-green-300 flex items-center">
                <p className="mr-1">{displayMessage}</p>
                <span className="flex space-x-1">
                    <span className="animate-bounce delay-100 inline-block w-1 h-1 bg-green-600 dark:bg-green-300 rounded-full"></span>
                    <span className="animate-bounce delay-200 inline-block w-1 h-1 bg-green-600 dark:bg-green-300 rounded-full"></span>
                    <span className="animate-bounce delay-300 inline-block w-1 h-1 bg-green-600 dark:bg-green-300 rounded-full"></span>
                </span>
            </div>
        </div>
    );
};

export default LoadingSpinner;