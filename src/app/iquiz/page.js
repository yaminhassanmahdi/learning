'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { quizQuestions } from '../../store/uploadAtoms'; // Adjust import path if necessary
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner'; // Adjust import path if necessary
import {
    FiCheckCircle,
    FiXCircle,
    FiChevronRight,
    FiZap, // Example for Easy
    FiActivity, // Example for Medium
    FiAlertTriangle, // Example for Hard
    FiMinusCircle,
    FiChevronsRight, // Icon for Next
    FiFlag, // Icon for Finish
} from 'react-icons/fi'; // Using Feather Icons - choose any you like!

// Helper map for difficulty icons and colors (example)
const difficultyStyles = {
    Easy: { icon: FiZap, color: 'text-green-400', ring: 'focus:ring-green-500' },
    Medium: { icon: FiActivity, color: 'text-yellow-400', ring: 'focus:ring-yellow-500' },
    Hard: { icon: FiAlertTriangle, color: 'text-red-400', ring: 'focus:ring-red-500' },
};

export default function RapidRoundQuiz() {
    const [quizStarted, setQuizStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({}); // Stores answers for final review
    const [selectedOption, setSelectedOption] = useState(null); // Currently selected option for feedback
    const [answerStatus, setAnswerStatus] = useState(null); // 'correct', 'incorrect', or null
    const [score, setScore] = useState(0);
    const [selectedDifficulty, setDifficulty] = useState('Easy');
    const [filteredQuestions, setFilteredQuestions] = useState([]);
    const [submitted, setSubmitted] = useState(false); // True when the entire quiz is finished
    const [loading, setLoading] = useState(false);
    const questions = useAtomValue(quizQuestions);

    // Memoize difficulty map
    const difficultyMap = useMemo(() => ({
        Easy: 'e',
        Medium: 'm',
        Hard: 'h',
    }), []);

    // Get question count based on difficulty
    const getQuestionCount = (difficulty) => {
        const selectedDiff = difficultyMap[difficulty];
        if (!questions || questions.length === 0) return 0;

        if (selectedDiff === 'e') {
            return questions.filter((q) => q.lvl === 'e').length;
        } else if (selectedDiff === 'm') {
            return questions.filter((q) => q.lvl === 'e' || q.lvl === 'm').length;
        } else { // 'h' or default
            return questions.length;
        }
    };

    // Start quiz
    const startQuiz = () => {
        setLoading(true);

        // Simulate loading and filtering
        setTimeout(() => {
            const selectedDiff = difficultyMap[selectedDifficulty];
            let filtered;
            if (selectedDiff === 'e') {
                filtered = questions.filter((q) => q.lvl === 'e');
            } else if (selectedDiff === 'm') {
                filtered = questions.filter((q) => q.lvl === 'e' || q.lvl === 'm');
            } else {
                filtered = questions;
            }

            if (filtered.length === 0) {
                alert(`No questions available for ${selectedDifficulty} difficulty.`);
                setLoading(false);
                return;
            }

            setFilteredQuestions(filtered);
            setQuizStarted(true);
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setSelectedOption(null);
            setAnswerStatus(null);
            setScore(0);
            setSubmitted(false);
            setLoading(false);
        }, 500); // Simulate delay
    };

    // Handle answer selection for the CURRENT question
    const handleSelect = (option) => {
        if (answerStatus !== null) return; // Don't allow changing answer after feedback

        const currentQuestion = filteredQuestions[currentQuestionIndex];
        const correctAnswer = currentQuestion.opt[currentQuestion.ans];
        const isCorrect = option === correctAnswer;

        setSelectedOption(option); // Store selected option for immediate feedback
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: option })); // Store for final review

        if (isCorrect) {
            setScore((prevScore) => prevScore + 1);
            setAnswerStatus('correct');
        } else {
            setAnswerStatus('incorrect');
        }
    };

    // Move to the next question or finish the quiz
    const handleNext = () => {
        // Reset feedback for the next question
        setAnswerStatus(null);
        setSelectedOption(null);

        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < filteredQuestions.length) {
            setCurrentQuestionIndex(nextIndex);
        } else {
            // Last question answered, show results
            setSubmitted(true);
        }
    };


    // Calculate progress percentage
    const progressPercent = filteredQuestions.length > 0
        ? Math.round(((currentQuestionIndex + 1) / filteredQuestions.length) * 100)
        : 0;

    // Determine feedback message for results screen
    const getFeedbackMessage = () => {
        if (!filteredQuestions || filteredQuestions.length === 0) return "No questions attempted.";
        const percentage = (score / filteredQuestions.length) * 100;
        if (percentage === 100) return "Flawless Victory! Perfect score!";
        if (percentage >= 80) return "Excellent Work! You really know your stuff.";
        if (percentage >= 60) return "Good Job! Solid performance.";
        if (percentage >= 40) return "Not Bad! Keep practicing to improve.";
        return "Keep Trying! Review the answers and learn.";
    };

    // Get the current question object safely
    const currentQuestion = quizStarted && !submitted ? filteredQuestions[currentQuestionIndex] : null;

    return (
        <div className="flex flex-col dark:bg-zinc-800 bg-slate-200 w-full min-h-screen justify-center items-center p-4 selection:bg-blue-200 selection:text-blue-900">
            {loading && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300">
                    <LoadingSpinner />
                </div>
            )}

            <div className="flex flex-col p-6 sm:p-8 md:w-[45rem] w-full bg-white dark:bg-zinc-900/80 dark:backdrop-blur-md shadow-2xl dark:shadow-blue-900/10 rounded-xl justify-center my-8 transition-all duration-300 border border-slate-200 dark:border-zinc-800">

                {/* ====== Configuration Screen ====== */}
                {!quizStarted && !submitted && (
                    <div className="flex flex-col w-full gap-6 dark:text-zinc-200 text-slate-800 items-center animate-fade-in">
                        <h1 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-200 bg-clip-text mb-4">
                            Start Rapid Round Quiz
                        </h1>

                        {/* Difficulty Selection */}
                        <div className="w-full max-w-xs">
                            <h2 className="text-lg font-semibold mb-3 text-center dark:text-zinc-300 text-slate-700">Select Difficulty</h2>
                            <div className="grid grid-cols-3 gap-3">
                                {Object.entries(difficultyStyles).map(([level, { icon: Icon, color, ring }]) => (
                                    <button
                                        key={level}
                                        className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-all duration-200 border-2 ${selectedDifficulty === level
                                            ? 'bg-blue-400 dark:bg-zinc-950 border-blue-500 dark:border-blue-600 text-white shadow-lg scale-105'
                                            : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700/70 hover:border-slate-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 dark:focus:ring-offset-zinc-900 focus:ring-offset-1 ' + ring
                                            }`}
                                        onClick={() => setDifficulty(level)}
                                    >
                                        <Icon className={`text-2xl mb-1 ${selectedDifficulty === level ? 'text-white' : color}`} />
                                        <span className="text-sm font-medium">{level}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
                                {getQuestionCount(selectedDifficulty)} questions available
                            </p>
                        </div>

                        {/* Start Button */}
                        <button
                            onClick={startQuiz}
                            disabled={getQuestionCount(selectedDifficulty) === 0 || loading}
                            className="mt-6 w-full max-w-xs py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-md"
                        >
                            {loading ? 'Preparing...' : 'Start Rapid Round'}
                        </button>
                    </div>
                )}

                {/* ====== Quiz In Progress Screen ====== */}
                {quizStarted && !submitted && currentQuestion && (
                    <div className="flex flex-col w-full gap-5 dark:text-zinc-200 text-slate-800 animate-fade-in">
                        {/* Header: Title & Question Count */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-2 pb-4 border-b border-slate-200 dark:border-zinc-700/50">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-200 mb-2 sm:mb-0">
                                Rapid Round: {selectedDifficulty}
                            </h2>
                            <div className="text-sm font-semibold text-slate-500 dark:text-zinc-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 border dark:border-zinc-700 border-slate-200">
                                Question {currentQuestionIndex + 1} of {filteredQuestions.length}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className='mb-4'>
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="text-slate-600 dark:text-zinc-400">Progress</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-400 to-purple-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>


                        {/* Current Question */}
                        <div className="p-5 border border-slate-200 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-zinc-800/50 shadow-sm transition-all duration-200">
                            <h3 className="font-semibold text-lg mb-4 leading-snug">
                                <span className="text-blue-500 dark:text-blue-400 mr-2">Q{currentQuestionIndex + 1}:</span> {currentQuestion.q}
                            </h3>
                            <div className="space-y-2.5">
                                {currentQuestion.opt.map((option, optIndex) => {
                                    const isSelected = selectedOption === option;
                                    const correctAnswer = currentQuestion.opt[currentQuestion.ans];
                                    const isCorrectAnswer = option === correctAnswer;
                                    let optionStyle = 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-700/60'; // Default
                                    let icon = null;

                                    if (answerStatus !== null) { // Feedback is active
                                        if (isSelected) {
                                            if (answerStatus === 'correct') {
                                                optionStyle = 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 ring-1 ring-green-500';
                                                icon = <FiCheckCircle className="text-green-500 ml-auto" />;
                                            } else { // incorrect selection
                                                optionStyle = 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 ring-1 ring-red-500';
                                                icon = <FiXCircle className="text-red-500 ml-auto" />;
                                            }
                                        } else if (isCorrectAnswer) {
                                            // Highlight the correct answer if the user was wrong
                                            optionStyle = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                                            icon = <FiCheckCircle className="text-green-600 dark:text-green-400 ml-auto opacity-70" />;
                                        } else {
                                            // Non-selected, non-correct options when feedback is shown
                                            optionStyle = 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 opacity-60';
                                        }
                                    } else if (isSelected) { // Selected but feedback not yet active (shouldn't happen with immediate feedback)
                                        optionStyle = 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-400 dark:ring-blue-600';
                                    }

                                    return (
                                        <label
                                            key={optIndex}
                                            className={`flex items-center p-3.5 rounded-md border transition-all duration-200 group ${optionStyle} ${answerStatus !== null ? 'cursor-default' : 'cursor-pointer'}`}
                                        >
                                            <input
                                                type="radio"
                                                name={`question-${currentQuestionIndex}`}
                                                value={option}
                                                onChange={() => handleSelect(option)}
                                                checked={isSelected} // Check if this is the currently selected option
                                                disabled={answerStatus !== null} // Disable after answering
                                                className="mr-3 w-4 h-4 accent-blue-500 dark:accent-blue-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-800 shrink-0"
                                            />
                                            <span className={`text-sm sm:text-base flex-grow ${answerStatus !== null && !isSelected && !isCorrectAnswer ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-zinc-100'} ${isSelected ? 'font-medium' : ''}`}>
                                                {option}
                                            </span>
                                            {icon}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Next/Finish Button - Show only after an answer is selected */}
                        {answerStatus !== null && (
                            <button
                                onClick={handleNext}
                                className="w-full py-3 px-6 mt-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 flex items-center justify-center gap-2"
                            >
                                {currentQuestionIndex < filteredQuestions.length - 1 ? (
                                    <>Next Question <FiChevronsRight /></>
                                ) : (
                                    <>Finish Quiz <FiFlag /></>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* ====== Quiz Results Screen ====== */}
                {submitted && (
                    <div className="text-center dark:text-zinc-200 text-slate-800 animate-fade-in">
                        {/* Header & Score */}
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-200 mb-3">
                                Rapid Round Complete!
                            </h2>
                            <p className="text-slate-600 dark:text-zinc-400 mb-6">{getFeedbackMessage()}</p>

                            {/* Score Display */}
                            <div className="relative w-36 h-36 mx-auto my-8 flex items-center justify-center">
                                <div className="absolute inset-0 border-8 border-slate-200 dark:border-zinc-700 rounded-full"></div>
                                <div
                                    className="absolute inset-0 border-8 border-blue-500 rounded-full"
                                    style={{
                                        clipPath: `inset(0% ${filteredQuestions.length > 0 ? 100 - (score / filteredQuestions.length * 100) : 100}% 0% 0%)`,
                                        transform: 'rotate(-90deg)',
                                        transition: 'clip-path 1s ease-out'
                                    }}
                                ></div>
                                <div className="relative text-center z-10">
                                    <p className="text-4xl font-bold text-blue-500 dark:text-blue-400">{score}</p>
                                    <p className="text-lg text-slate-500 dark:text-zinc-400">/ {filteredQuestions.length}</p>
                                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-500 mt-1">
                                        {filteredQuestions.length > 0 ? Math.round((score / filteredQuestions.length) * 100) : 0}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Answer Key Section */}
                        <div className="mt-8 border-t border-slate-200 dark:border-zinc-700/50 pt-6">
                            <h3 className="font-semibold text-xl mb-5 text-left dark:text-zinc-300 text-slate-700">Answer Review</h3>
                            <div className="space-y-4 text-left max-h-[40vh] overflow-y-auto pr-2 styled-scrollbar">
                                {filteredQuestions.map((q, index) => {
                                    const correctAnswer = q.opt[q.ans];
                                    const userAnswer = selectedAnswers[index]; // Use the stored answers
                                    const isCorrect = userAnswer === correctAnswer;

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-lg border ${isCorrect
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                                                : userAnswer
                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                                                    : 'bg-slate-50 dark:bg-zinc-800/30 border-slate-300 dark:border-zinc-700' // Unanswered
                                                }`}
                                        >
                                            <p className="font-medium text-base dark:text-zinc-200 text-slate-800 flex items-start">
                                                <span className={`mr-2 mt-1 shrink-0 ${isCorrect ? 'text-green-500' : userAnswer ? 'text-red-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                                                    {isCorrect ? <FiCheckCircle /> : userAnswer ? <FiXCircle /> : <FiMinusCircle />}
                                                </span>
                                                <span><strong className="mr-1">Q{index + 1}:</strong> {q.q}</span>
                                            </p>
                                            <div className="mt-2 pl-6 text-sm space-y-1">
                                                <p>
                                                    <span className="font-medium text-green-600 dark:text-green-400">Correct answer: </span>
                                                    <span className="text-slate-700 dark:text-zinc-300">{correctAnswer}</span>
                                                </p>
                                                {!isCorrect && userAnswer && (
                                                    <p>
                                                        <span className="font-medium text-red-500 dark:text-red-400">Your answer: </span>
                                                        <span className="text-slate-700 dark:text-zinc-300">{userAnswer}</span>
                                                    </p>
                                                )}
                                                {!userAnswer && (
                                                    <p>
                                                        <span className="font-medium text-slate-500 dark:text-zinc-500">Your answer: </span>
                                                        <span className="text-slate-500 dark:text-zinc-400 italic">Not answered</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-8 pt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button
                                onClick={() => {
                                    // Reset state to go back to config screen
                                    setQuizStarted(false);
                                    setSubmitted(false);
                                    // Keep difficulty or reset as desired
                                }}
                                className="w-full sm:w-auto py-2.5 px-6 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 font-medium rounded-lg shadow-sm transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                            >
                                Take Another Round
                            </button>
                            <Link href="/" className="w-full sm:w-auto">
                                <button className="w-full py-2.5 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 flex items-center justify-center gap-1">
                                    Return to Chat <FiChevronRight className="inline" />
                                </button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Scrollbar styles */}
            <style jsx>{`
        .styled-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .styled-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc; /* Lighter for light mode */
          border-radius: 4px;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
        /* Dark mode scrollbar */
        .dark .styled-scrollbar::-webkit-scrollbar-thumb {
          background: #555; /* Darker scrollbar for dark mode */
        }
        .dark .styled-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #777;
        }

        /* Simple fade-in animation */
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
          }
      `}</style>
        </div>
    );
}