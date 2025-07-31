// components/WeeklyLeaderboard.js (or pages/leaderboard.js)
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust path to your Supabase client
import LoadingSpinner from '../components/LoadingSpinner'; // Adjust path to your LoadingSpinner component
import { FiAward, FiTrendingUp, FiUser, FiCalendar, FiAlertCircle } from 'react-icons/fi';

// Define the expected shape of leaderboard entries returned by the RPC function
interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number; // Matches the BIGINT return type from RPC
}
function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day; // Subtract day number to get Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0); // Reset time to midnight
  // Format as YYYY-MM-DD for Supabase date column
  return d.toISOString().split('T')[0];
}
export default function WeeklyLeaderboard() {
  // State for the leaderboard data itself
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true); // Loading state for leaderboard data
  const [error, setError] = useState<string | null>(null); // Error state for leaderboard data fetching

  // State for week selection dropdown
  const [selectedWeekStart, setSelectedWeekStart] = useState(''); // Stores 'YYYY-MM-DD'
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true); // Loading state specifically for the week dropdown
  const [weeksError, setWeeksError] = useState<string | null>(null); // Error state for fetching available weeks
  const [isDarkMode, setIsDarkMode] = useState(true);
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
  }, [isDarkMode]);
  // Effect 1: Fetch available weeks on component mount
  useEffect(() => {
    const fetchAvailableWeeks = async () => {
      setWeeksLoading(true);
      setWeeksError(null);
      // Get the start date of the actual current week (Sunday, April 20, 2025 based on current time)
      const currentActualWeek = getWeekStartDate(new Date());

      try {
        // Call the RPC function to get distinct week start dates
        const { data, error: fetchWeeksError } = await supabase.rpc('get_available_leaderboard_weeks');

        if (fetchWeeksError) {
          throw fetchWeeksError; // Propagate the error
        }

        // Extract the date strings from the returned objects
        let weeks = data?.map((w: { week_start_date: string }) => w.week_start_date) || [];

        // Ensure the current actual week is always present in the list, even if no scores exist yet.
        // Add it to the beginning since the RPC returns newest first.
        if (!weeks.includes(currentActualWeek)) {
          weeks.unshift(currentActualWeek);
        }

        // Optional: Limit the number of past weeks displayed in the dropdown
        // weeks = weeks.slice(0, 12); // Example: Show current week + last 11 weeks with scores

        setAvailableWeeks(weeks);

        // Set the initially selected week to be the *current* actual week
        setSelectedWeekStart(currentActualWeek);

      } catch (err: any) {
        console.error("Error fetching available weeks:", err);
        setWeeksError(err.message || 'Failed to load week options.');
        // Fallback: Only include the current week if fetching others failed
        setAvailableWeeks([currentActualWeek]);
        setSelectedWeekStart(currentActualWeek);
      } finally {
        setWeeksLoading(false); // Finish loading the week options
      }
    };

    fetchAvailableWeeks();
    // This effect runs only once on mount
  }, []);

  // Effect 2: Fetch leaderboard data when the selected week changes
  useEffect(() => {
    // Skip fetching if no week is selected yet (might happen briefly on initial load)
    if (!selectedWeekStart) {
      setLoading(false); // Ensure main loading is false if no week is ready
      return;
    }

    const fetchLeaderboard = async () => {
      setLoading(true); // Start loading leaderboard data for the chosen week
      setError(null);   // Clear previous leaderboard errors
      setLeaderboard([]); // Clear previous results immediately

      try {
        // Call the RPC function with the selected week and desired limit
        const { data, error: rpcError } = await supabase.rpc('get_weekly_leaderboard', {
          week_start: selectedWeekStart, // Pass the selected week state variable
          limit_count: 10               // Fetch top 10 scores (adjust as needed)
        });

        if (rpcError) {
          throw rpcError; // Propagate the error
        }

        // Update the leaderboard state with the data from the RPC call
        setLeaderboard(data || []);

      } catch (err: any) {
        console.error(`Error fetching leaderboard for week ${selectedWeekStart}:`, err);
        setError(err.message || `Failed to load leaderboard for the selected week.`);
        setLeaderboard([]); // Ensure leaderboard is empty on error
      } finally {
        setLoading(false); // Finish loading leaderboard data
      }
    };

    fetchLeaderboard();
    // This effect depends only on the selected week changing
  }, [selectedWeekStart]);

  // Helper function to format 'YYYY-MM-DD' for display in the dropdown
  const formatWeekForDisplay = (dateString: string): string => {
    try {
      // Add time and UTC timezone indicator to parse consistently across environments
      const date = new Date(dateString + 'T00:00:00Z');
      // Check if date is valid after parsing
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      return date.toLocaleDateString(undefined, { // Use locale default format
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC', // Display the date corresponding to UTC midnight start
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString; // Fallback to original string
    }
  };

  // Helper function to determine rank color
  const getRankColor = (rank: number): string => {
    if (rank === 0) return 'text-yellow-400'; // 1st
    if (rank === 1) return 'text-gray-400';  // 2nd
    if (rank === 2) return 'text-yellow-600';// 3rd
    return 'text-slate-500 dark:text-zinc-400'; // Others
  }

  // --- Render Logic ---
  return (
    <div className="flex flex-col md:h-[100vh]  justify-center items-center  relative w-full dark:bg-zinc-800 bg-slate-200 scrollbar-hide">
      <div className="w-full max-w-lg h-[90%] p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-slate-200 dark:border-zinc-700 backdrop-blur-sm">
        {/* Header */}
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 text-zinc-900 dark:text-zinc-200">
          <FiTrendingUp className="inline mr-2 mb-1" /> Weekly Top Scorers
        </h2>

        {/* Week Selector Dropdown */}
        <div className="mb-5 sm:mb-6 text-center">
          <label htmlFor="week-select" className="text-sm font-medium text-slate-600 dark:text-zinc-400 mr-2 inline-flex items-center">
            <FiCalendar className="mr-1.5" /> Select Week:
          </label>
          <select
            id="week-select"
            value={selectedWeekStart}
            onChange={(e) => setSelectedWeekStart(e.target.value)}
            // Disable while fetching weeks OR while fetching data for a selected week
            disabled={weeksLoading || loading}
            className="p-2 border border-slate-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm appearance-none min-w-[190px] sm:min-w-[210px] transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {weeksLoading ? (
              <option>Loading weeks...</option>
            ) : weeksError ? (
              <option>Error loading weeks</option>
            ) : (
              availableWeeks.length > 0 ? (
                availableWeeks.map((week) => (
                  <option key={week} value={week}>
                    {`Week of ${formatWeekForDisplay(week)}`}
                    {/* Add '(Current)' marker for the actual current week */}
                    {week === getWeekStartDate(new Date()) ? ' (Current)' : ''}
                  </option>
                ))
              ) : (
                // Should ideally not happen if fallback works, but good practice
                <option>No weeks available</option>
              )
            )}
          </select>
          {/* Display error if fetching weeks failed */}
          {weeksError && <p className="text-xs text-red-500 mt-1">{weeksError}</p>}
        </div>

        {/* Leaderboard Content Area */}
        <div className="min-h-[200px]"> {/* Give minimum height to avoid layout shifts */}
          {loading ? (
            // Show loading spinner when fetching leaderboard data
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner />
            </div>
          ) : error ? (
            // Show error message if fetching leaderboard data failed
            <div className="flex flex-col items-center justify-center text-center text-red-500 dark:text-red-400 py-10">
              <FiAlertCircle className="text-3xl mb-2" />
              <p className="font-medium">Error loading leaderboard:</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : leaderboard.length === 0 ? (
            // Show message if no scores found for the selected week
            <p className="text-center text-slate-500 dark:text-zinc-400 py-10 px-4">
              No scores recorded for this week yet. Be the first!
            </p>
          ) : (
            // Render the actual leaderboard list
            <ul className="space-y-3 animate-fade-in"> {/* Added subtle fade-in */}
              {leaderboard.map((entry, index) => (
                <li
                  // Use a key that includes the week to ensure proper re-renders on week change
                  key={entry.user_id + '-' + selectedWeekStart}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700/50 rounded-lg shadow-sm transition-all duration-150 hover:shadow-md hover:scale-[1.02]"
                >
                  {/* Left side: Rank, Icon, Name */}
                  <div className="flex items-center space-x-3 overflow-hidden"> {/* Added overflow-hidden */}
                    <span className={`font-bold text-lg w-6 text-center flex-shrink-0 ${getRankColor(index)}`}>
                      {index + 1}
                    </span>
                    {/* Placeholder for avatar if you add it later */}
                    {/* <img src={entry.avatar_url || defaultAvatar} alt="" className="w-6 h-6 rounded-full"/> */}
                    <FiUser className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                    <span className="font-medium text-slate-700 dark:text-zinc-200 truncate" title={entry.user_name || 'Anonymous'}>
                      {entry.user_name || 'Anonymous'}
                    </span>
                  </div>
                  {/* Right side: Score */}
                  <div className="flex items-center space-x-1 flex-shrink-0 pl-2"> {/* Added padding left */}
                    <FiAward className="text-blue-500 dark:text-blue-400" />
                    <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm sm:text-base">
                      {entry.total_score} pts
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div> {/* End Leaderboard Content Area */}
      </div>
    </div>
  );
}