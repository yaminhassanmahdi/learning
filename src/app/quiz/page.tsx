'use client';
import { useState, useEffect, useMemo } from 'react';
// --- NEW IMPORTS ---
import { useAtomValue, useSetAtom, useAtom } from 'jotai'; // Import useSetAtom
import { quizQuestions, userIsFirstTryAtom, file_id_supabase } from '../../store/uploadAtoms'; // Adjust import path & ADD your first try atom 'userIsFirstTryAtom'
import { supabase } from '../lib/supabaseClient'; // Adjust path for your Supabase client instance
// --- END NEW IMPORTS ---
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner'; // Adjust import path if necessary
import {
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiChevronRight,
  FiZap, // Example for Easy
  FiActivity, // Example for Medium
  FiAlertTriangle, // Example for Hard
  FiMinusCircle
} from 'react-icons/fi'; // Using Feather Icons - choose any you like!

// Helper map for difficulty icons and colors (example) - NO CHANGES HERE
const difficultyStyles = {
  Easy: { icon: FiZap, color: 'text-green-400', ring: 'focus:ring-green-500' },
  Medium: { icon: FiActivity, color: 'text-yellow-400', ring: 'focus:ring-yellow-500' },
  Hard: { icon: FiAlertTriangle, color: 'text-red-400', ring: 'focus:ring-red-500' },
};
function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day; // Subtract day number to get Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0); // Reset time to midnight
  // Format as YYYY-MM-DD for Supabase date column
  return d.toISOString().split('T')[0];
}
export default function QuizApp() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null); // Added type annotation for clarity
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [selectedDifficulty, setDifficulty] = useState('Easy');
  const [filteredQuestions, setFilteredQuestions] = useState([]); // Added type annotation for clarity
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false); // This state will now cover submission loading too
  const questions = useAtomValue(quizQuestions);
  const [fid, setFile_id_s] = useAtom(file_id_supabase);

  // --- NEW HOOKS ---
  const isFirstTry = useAtomValue(userIsFirstTryAtom); // Get the flag value from Jotai atom
  const setIsFirstTry = useSetAtom(userIsFirstTryAtom); // Get the setter function for the Jotai atom
  // --- END NEW HOOKS ---

  // Memoize difficulty map for slight optimization - NO CHANGES HERE
  const difficultyMap = useMemo(() => ({
    Easy: 'e',
    Medium: 'm',
    Hard: 'h',
  }), []);

  // Get question count based on difficulty - NO CHANGES HERE
  const getQuestionCount = (difficulty: keyof typeof difficultyStyles): number => {
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

  // Timer effect - NO CHANGES HERE (but note dependency on handleSubmit potentially becoming async)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (quizStarted && timeLeft !== null && timeLeft > 0 && !submitted) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (quizStarted && timeLeft === 0 && !submitted) {
      // Auto-submit when time runs out
      handleSubmit(); // If handleSubmit is async, this call doesn't need await here
    }
    // Cleanup function
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, timeLeft, submitted]); // Dependencies include handleSubmit implicitly via the timeout call

  // Start quiz with user-defined timer - NO CHANGES HERE (except maybe adding atom reset logic)
  const startQuiz = () => {
    // --- POTENTIAL NEW LOGIC ---
    // Reset the 'first try' flag whenever a new quiz is started
    // Note: Ensure this is the correct place based on your app's flow
    // If 'first try' means first attempt EVER vs first attempt on THIS set of questions, adjust accordingly.
    // --- END POTENTIAL NEW LOGIC ---

    const totalSeconds = parseInt(minutes || '0') * 60 + parseInt(seconds || '0');
    if (totalSeconds > 0) {
      setLoading(true);

      // Simulate loading and filtering - NO CHANGES HERE
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
        setTimeLeft(totalSeconds);
        setSelectedAnswers({}); // Reset answers
        setScore(0);          // Reset score
        setSubmitted(false);  // Reset submission state
        setLoading(false);    // Finish loading
      }, 800); // Simulate network/processing delay
    } else {
      alert('Please enter a valid duration (e.g., 1 minute or 30 seconds).');
    }
  };

  // Handle answer selection - NO CHANGES HERE
  const handleSelect = (questionIndex: number, option: string) => {
    if (!submitted) { // Prevent changing answers after submission
      setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: option }));
    }
  };

  // --- MODIFIED handleSubmit FUNCTION ---
  // Submit quiz, calculate score, AND conditionally save to leaderboard
  const handleSubmit = async () => { // Make handleSubmit async
    if (submitted || loading) return; // Prevent double submission or submitting while already processing

    setLoading(true); // Start loading indicator for the entire submission process
    setTimeLeft(null); // Stop the timer visually

    // --- Calculate score locally first ---
    let newScore = 0;
    filteredQuestions.forEach((q, index) => {
      if (selectedAnswers[index] && selectedAnswers[index] === q.opt[q.ans]) {
        newScore += 1;
      }
    });
    setScore(newScore); // Update score state
    setSubmitted(true); // Mark quiz as submitted visually (can happen before DB insert)

    // --- Leaderboard Submission Logic ---
    try {
      // Check if this attempt qualifies for the leaderboard

      const { data: firstUserAttempt, error: fetchError } = await supabase
        .from("file_data")
        .select("isQuizFirstAttempt")
        .eq("file_id", fid)
        .maybeSingle<{ isQuizFirstAttempt: boolean }>();

      setIsFirstTry(firstUserAttempt.isQuizFirstAttempt);
      // console.log("FIRSt user attempt ---> ", isFirstTry, firstUserAttempt)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (firstUserAttempt.isQuizFirstAttempt) {
        // Get current authenticated user

        // console.log("IN firstuser attemp, value--->", firstUserAttempt)
        if (userError) {
          console.error('Error fetching user for leaderboard:', userError.message);
          // Optional: Show a non-blocking error to the user
        } else if (user) {
          // User found, proceed to save score
          const weekStartDate = getWeekStartDate(); // Calculate the week start date

          // Prepare the data payload for Supabase
          const scoreData = {
            user_id: user.id,
            // Attempt to get a display name, fallback to email if not available
            user_name: user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || 'Anonymous',
            score: newScore, // The score calculated above
            week_start_date: weekStartDate, // The calculated Sunday date
          };

          // Insert the score record into the Supabase table
          const { error: insertError } = await supabase
            .from('leaderboard_scores') // Your table name
            .insert(scoreData);

          if (insertError) {
            console.error('Error saving score to leaderboard:', insertError.message);
            // Optional: Show a non-blocking error
          } else {
            console.log('Score saved to leaderboard successfully!');
            // IMPORTANT: Update the atom state to mark that the 'first try' for this session/topic is used up
            const { data: updatedUserAttempt, error: updateError } = await supabase
              .from("file_data")
              .update({ isQuizFirstAttempt: false }) // or false, depending on what you want
              .eq("file_id", fid)
              .select()
              .maybeSingle<{ isQuizFirstAttempt: boolean }>();
            setIsFirstTry(false);
          }
        } else {

          console.warn('User not logged in when trying to submit score to leaderboard.');
        }
      } else {
        // If it's not the first try, just log it and don't save to DB
        console.log('Not the first try, score not added to leaderboard.');
      }
    } catch (error: any) {
      // Catch any unexpected errors during the leaderboard submission process
      console.error("An unexpected error occurred during leaderboard score submission:", error.message);
    } finally {
      // IMPORTANT: Ensure loading is set to false regardless of success or failure
      setLoading(false);
    }
    // --- End Leaderboard Submission Logic ---
  };
  // --- END MODIFIED handleSubmit FUNCTION ---

  // Format time utility - NO CHANGES HERE
  const formatTime = (timeInSeconds: number | null): string => {
    if (timeInSeconds === null || timeInSeconds < 0) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = timeInSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate progress percentage - NO CHANGES HERE
  const progressPercent = filteredQuestions.length > 0
    ? Math.round((Object.keys(selectedAnswers).length / filteredQuestions.length) * 100)
    : 0;

  // Determine feedback message - NO CHANGES HERE
  const getFeedbackMessage = (): string => {
    if (filteredQuestions.length === 0) return "No questions attempted.";
    // Ensure score is calculated based on the state after potential update in handleSubmit
    const currentScore = score;
    const percentage = filteredQuestions.length > 0 ? (currentScore / filteredQuestions.length) * 100 : 0;
    if (percentage === 100) return "Flawless Victory! Perfect score!";
    if (percentage >= 80) return "Excellent Work! You really know your stuff.";
    if (percentage >= 60) return "Good Job! Solid performance.";
    if (percentage >= 40) return "Not Bad! Keep practicing to improve.";
    return "Keep Trying! Review the answers and learn.";
  };

  // --- JSX Rendering - NO CHANGES to structure or styling ---
  return (
    <div className="flex flex-col dark:bg-zinc-800 bg-slate-200  w-full min-h-screen justify-center items-center p-4 selection:bg-blue-200 selection:text-blue-900">
      {/* Loading Overlay - NO CHANGES HERE (now used for initial load AND submission) */}
      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300">
          <LoadingSpinner />
          {/* Optional: Could show different text based on state, but sticking to no design changes */}
          {/* <p className="text-white mt-2">{submitted ? 'Submitting Score...' : 'Loading...'}</p> */}
        </div>
      )}

      <div className="flex flex-col p-6 sm:p-8 md:w-[45rem] w-full bg-white dark:bg-zinc-900/80 dark:backdrop-blur-md shadow-2xl dark:shadow-blue-900/10 rounded-xl justify-center my-8 transition-all duration-300 border border-slate-200 dark:border-zinc-800">

        {/* ====== Configuration Screen ====== - NO CHANGES HERE */}
        {!quizStarted && !submitted && (
          <div className="flex flex-col w-full gap-6 dark:text-zinc-200 text-slate-800 items-center animate-fade-in">
            <h1 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-200 bg-clip-text mb-4">
              Setup Your Quiz Challenge
            </h1>

            {/* Duration Input */}
            <div className="w-full max-w-xs">
              <label className="flex items-center text-sm font-medium mb-2 dark:text-zinc-400 text-slate-600">
                <FiClock className="mr-2 text-lg" /> Quiz Duration
              </label>
              <div className="flex items-center justify-center gap-2 p-3 border dark:border-zinc-700 border-slate-300 rounded-lg bg-slate-50 dark:bg-zinc-800 shadow-inner dark:shadow-zinc-950/30">
                <input
                  type="text"
                  placeholder="MM"
                  maxLength={3} // Allow slightly more for easier input
                  className="p-2 bg-white dark:bg-zinc-700 border dark:border-zinc-600 border-slate-300 rounded text-center w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800 focus:ring-offset-1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} // Limit length
                  disabled={loading} // Disable input while loading
                />
                <span className="text-2xl font-light text-slate-400 dark:text-zinc-500">:</span>
                <input
                  type="text"
                  placeholder="SS"
                  maxLength={2}
                  className="p-2 bg-white dark:bg-zinc-700 border dark:border-zinc-600 border-slate-300 rounded text-center w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800 focus:ring-offset-1"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))} // Limit length, max 59
                  onBlur={(e) => { // Optional: cap seconds at 59
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 59) setSeconds('59');
                  }}
                  disabled={loading} // Disable input while loading
                />
              </div>
            </div>

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
                    onClick={() => !loading && setDifficulty(level as keyof typeof difficultyStyles)} // Prevent changing during load
                    disabled={loading}
                  >
                    <Icon className={`text-2xl mb-1 ${selectedDifficulty === level ? 'text-white' : color}`} />
                    <span className="text-sm font-medium">{level}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
                {getQuestionCount(selectedDifficulty as keyof typeof difficultyStyles)} questions available
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={startQuiz}
              // Disable if no questions OR if currently loading
              disabled={getQuestionCount(selectedDifficulty as keyof typeof difficultyStyles) === 0 || loading}
              className="mt-6 w-full max-w-xs py-3 px-6 bg-gradient-to-r  text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2  disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-md bg-blue-500  hover:bg-blue-400 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 "
            >
              {loading ? 'Preparing...' : 'Start Challenge'}
            </button>

          </div>
        )}

        {/* ====== Quiz In Progress Screen ====== - NO CHANGES HERE */}
        {quizStarted && !submitted && (
          <div className="flex flex-col w-full gap-5 dark:text-zinc-200 text-slate-800 animate-fade-in">
            {/* Header: Title & Timer */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-2 pb-4 border-b border-slate-200 dark:border-zinc-700/50">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-200 mb-2 sm:mb-0">
                {selectedDifficulty} Level
              </h2>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                {/* Logic for pulsing icon if low time */}
                <FiClock className={`mr-1 ${timeLeft !== null && timeLeft < 30 && timeLeft > 0 ? 'text-red-500 animate-ping absolute opacity-75' : 'text-blue-500 dark:text-blue-400'}`} />
                <FiClock className={`mr-1 relative ${timeLeft !== null && timeLeft < 30 && timeLeft > 0 ? 'text-red-500' : 'text-blue-500 dark:text-blue-400'}`} />
                <span className="text-sm text-slate-500 dark:text-zinc-400">Time Left:</span>
                <span
                  className={`font-mono font-semibold text-lg tracking-wider ${timeLeft !== null && timeLeft < 30 && timeLeft > 0 ? 'text-red-500' : 'text-blue-500 dark:text-blue-400'
                    }`}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className='mb-4'>
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="text-slate-600 dark:text-zinc-400">Progress: {Object.keys(selectedAnswers).length} / {filteredQuestions.length}</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-purple-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>


            {/* Questions List */}
            {/* Added max-h-[60vh] or similar if needed, but sticking to no design change */}
            <div className="space-y-6 my-4 max-h-fit overflow-y-auto pr-2 styled-scrollbar"> {/* Ensure overflow works */}
              {filteredQuestions.map((q, index) => (
                <div key={index} className="p-5 border border-slate-200 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-zinc-800/50 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-200">
                  <h3 className="font-semibold text-lg mb-4 leading-snug">
                    <span className="text-blue-500 dark:text-blue-400 mr-2">Q{index + 1}:</span> {q.q}
                  </h3>
                  <div className="space-y-2.5">
                    {q.opt.map((option: string, optIndex: number) => ( // Added types
                      <label
                        key={optIndex}
                        className={`flex items-center p-3.5 rounded-md border dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors duration-150 group ${selectedAnswers[index] === option ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-400 dark:ring-blue-600' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                          }`}
                      >
                        <input
                          type="radio"
                          name={`question-${index}`}
                          value={option}
                          onChange={() => handleSelect(index, option)}
                          checked={selectedAnswers[index] === option}
                          disabled={submitted || loading} // Disable options once submitted or during submission loading
                          className="mr-3 w-4 h-4 accent-blue-500 dark:accent-blue-600 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-800 shrink-0 disabled:opacity-70" // Added disabled style
                        />
                        <span className={`text-sm sm:text-base group-hover:text-slate-900 dark:group-hover:text-zinc-100 transition-colors ${selectedAnswers[index] === option ? 'text-slate-900 dark:text-zinc-100 font-medium' : 'text-slate-700 dark:text-zinc-300'}`}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button - Updated disabled logic */}
            <button
              onClick={handleSubmit}
              // Disable if loading OR if already submitted
              disabled={loading || submitted}
              className="w-full py-3 px-6 mt-4 bg-gradient-to-r bg-blue-500  hover:bg-blue-400 dark:bg-zinc-700 dark:hover:text-zinc-800 dark:hover:bg-zinc-200 duration-300 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-md"
            >
              {/* Text changes based on loading state */}
              {loading ? 'Submitting...' : 'Submit & See Results'}
            </button>
          </div>
        )}

        {/* ====== Quiz Results Screen ====== - NO CHANGES HERE */}
        {submitted && !loading && ( // Only show results if NOT loading (prevents flash during submit)
          <div className="text-center dark:text-zinc-200 text-slate-800 animate-fade-in">
            {/* Header & Score */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-200 mb-3">
                Quiz Completed!
              </h2>
              <p className="text-slate-600 dark:text-zinc-400 mb-6">{getFeedbackMessage()}</p>

              {/* Score Display */}
              <div className="relative w-36 h-36 mx-auto my-8 flex items-center justify-center">
                <div className="absolute inset-0 border-8 border-slate-200 dark:border-zinc-700 rounded-full"></div>
                <div
                  className="absolute inset-0 border-8 border-blue-500 rounded-full"
                  style={{
                    clipPath: filteredQuestions.length > 0 ? `inset(0% ${100 - (score / filteredQuestions.length * 100)}% 0% 0%)` : 'inset(0% 100% 0% 0%)', // Handle division by zero
                    transform: 'rotate(-90deg)', // Start from top
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
            {/* Added max-h-[40vh] or similar if needed, but sticking to no design change */}
            <div className="mt-8 border-t border-slate-200 dark:border-zinc-700/50 pt-6">
              <h3 className="font-semibold text-xl mb-5 text-left dark:text-zinc-300 text-slate-700">Answer Review</h3>
              <div className="space-y-4 text-left max-h-fit overflow-y-auto pr-2 styled-scrollbar"> {/* Ensure overflow works */}
                {filteredQuestions.map((q, index) => {
                  const correctAnswer = q.opt[q.ans];
                  const userAnswer = selectedAnswers[index];
                  const isCorrect = userAnswer === correctAnswer;

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${isCorrect
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                        : userAnswer // Check if user actually answered
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
                        {!userAnswer && ( // Indicate if unanswered
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
                  setSelectedAnswers({});
                  setScore(0);
                  setTimeLeft(null);
                  setFilteredQuestions([]); // Clear filtered questions
                  // Optionally reset timer inputs
                  // setMinutes('');
                  // setSeconds('');
                  // Optionally reset difficulty
                  // setDifficulty('Easy');
                  // --- Ensure first try flag is reset IF taking another quiz means a fresh attempt ---
                }}
                className="w-full sm:w-auto py-2.5 px-6 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 font-medium rounded-lg shadow-sm transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
              >
                Take Another Quiz
              </button>
              <Link href='/'>
                <button
                  className="w-full sm:w-auto py-2.5 px-6 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 font-medium rounded-lg shadow-sm transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                  Return to chat
                </button></Link>

              {/* Example link to leaderboard page */}
              <Link href="/leaderboard" className="w-full sm:w-auto">
                <button className="w-full py-2.5 px-6 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900">
                  View Leaderboard <FiChevronRight className="inline ml-1" />
                </button>
              </Link>
              {/* Original Link back to chat */}
              {/* <Link href="/" className="w-full sm:w-auto">
                 <button className="w-full py-2.5 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900">
                   Return to Chat <FiChevronRight className="inline ml-1" />
                 </button>
               </Link> */}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}