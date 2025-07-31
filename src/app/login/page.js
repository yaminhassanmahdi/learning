// components/Auth.js
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAtom } from 'jotai';
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, AlertTriangle, User, UserPlus, Sun, Moon } from 'lucide-react'; // Added Sun and Moon icons
import LoadingSpinner from '../components/LoadingSpinner'; // Import your LoadingSpinner
import { useAuth } from '../contexts/AuthContext';

// Import Jotai atoms (keeping your existing imports)
import {
    fileAtom,
    textAtom, // Assuming this is used elsewhere, if not, it can be removed
    fileNameAtom, // Assuming this is used elsewhere
    chat_id_supabase, // Assuming this is used elsewhere
    file_url_supabase,
    quizQuestions,
    flashCardsState,
    summaryState,
    file_id_supabase,
    file_contents_supabase,
    user_id_supabase,
    userEmail_state
} from "../../store/uploadAtoms";

const Auth = () => {
    const router = useRouter();
    const { user } = useAuth(); // Use the auth context
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [country, setCountry] = useState('');
    const [occupation, setOccupation] = useState('');
    const [ageRange, setAgeRange] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSignUpView, setIsSignUpView] = useState(false); // <-- State to toggle between Sign In and Sign Up
    const [isDarkMode, setIsDarkMode] = useState(true);

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const [uid, setUID] = useAtom(user_id_supabase);
    const [userEmail_s, setUserEmail_s] = useAtom(userEmail_state);

    // Your state reset logic atoms (keeping them as they are)
    const [file, setFile] = useAtom(fileAtom);
    const [fileURLSupabase, setFileURLSupabase] = useAtom(file_url_supabase);
    const [quizQues, setQuizQuestions] = useAtom(quizQuestions);
    const [flashCards, setFlashCards] = useAtom(flashCardsState);
    const [summaryS, setSummaryS] = useAtom(summaryState);
    const [file_id_s, setFile_id_s] = useAtom(file_id_supabase);
    const [fileContentsS, setFileContentsS] = useAtom(file_contents_supabase);

    useEffect(() => {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === 'enabled') {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDarkMode(false);
        }
    }, []);

    const toggleDarkMode = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'disabled');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'enabled');
        }
        setIsDarkMode(!isDarkMode);
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setDisplayName('');
        setCountry('');
        setOccupation('');
        setAgeRange('');
        setError(null);
    };

    // Helper function to check if user exists in users table
    const checkUserExists = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
                throw error;
            }

            return !!data;
        } catch (error) {
            console.error('Error checking user existence:', error);
            return false;
        }
    };

    // Helper function to check if user usage exists
    const checkUserUsageExists = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('user_usage')
                .select('user_id')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
                throw error;
            }

            return !!data;
        } catch (error) {
            console.error('Error checking user usage existence:', error);
            return false;
        }
    };

    // Helper function to insert user data safely
    const insertUserData = async (userData) => {
        console.log('insertUserData ---> ', userData);
        try {
            // Check if user already exists
            const userExists = await checkUserExists(userData.id);

            if (!userExists) {
                const { data, error } = await supabase
                    .from('users')
                    .insert([{
                        id: userData.id,
                        email: userData.email,
                        full_name: userData.full_name,
                        name: userData.name,
                        country: userData.country,
                        occupation: userData.occupation,
                        age_range: userData.age_range,
                        created_at: userData.created_at
                    }])
                    .select();
                console.log('error ---> ', error);
                if (error) {
                    if (error.code === '23505') { // Unique violation - user already exists
                        console.log('User already exists in database');
                        return { success: true, message: 'User already exists' };
                    } else {
                        throw error;
                    }
                }

                console.log('User data inserted successfully:', data);
                return { success: true, data };
            } else {
                console.log('User already exists in database');
                return { success: true, message: 'User already exists' };
            }
        } catch (error) {
            console.error('Error inserting user data:', error);
            return { success: false, error: error.message };
        }
    };

    // Helper function to initialize user usage safely
    const initializeUserUsage = async (userId) => {
        try {
            // Check if user usage already exists
            const usageExists = await checkUserUsageExists(userId);

            if (!usageExists) {
                const usageData = {
                    user_id: userId,
                    is_premium: false,
                    summary_count: 8,
                    ai_notes_count: 8,
                    flashcard_count: 8,
                    quiz_count: 8,
                    paraphrase_count: 8,
                    ai_check_count: 8,
                    humanizer_count: 8,
                    grammer_check_count: 8,
                    chat_request_count: 8,
                    exm_prep_count: 8,
                    per_w_count: 8,
                    solver_chat_count: 8,
                    general_chat_count: 8,
                    meme_count: 8,
                    last_reset: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('user_usage')
                    .insert([usageData])
                    .select();

                if (error) {
                    if (error.code === '23505') { // Unique violation - usage already exists
                        console.log('Usage record already exists');
                        return { success: true, message: 'Usage record already exists' };
                    } else {
                        throw error;
                    }
                }

                console.log('User usage initialized successfully:', data);
                return { success: true, data };
            } else {
                console.log('Usage record already exists');
                return { success: true, message: 'Usage record already exists' };
            }
        } catch (error) {
            console.error('Error initializing user usage:', error);
            return { success: false, error: error.message };
        }
    };

    const handleSignUp = async () => {
        if (!name.trim()) {
            setError("Please enter your full name.");
            return;
        }
        if (!displayName.trim()) {
            setError("Please enter what we should call you.");
            return;
        }
        if (!email || !password || !confirmPassword) {
            setError("Please enter email and password.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (!country || !occupation || !ageRange) {
            setError("Please fill in all required fields.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // First, sign up the user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name.trim(),
                        name: displayName.trim(),
                        country: country,
                        occupation: occupation,
                        age_range: ageRange
                    },
                    emailRedirectTo: `${window.location.origin}/login`
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            if (data?.user) {
                // Store the user data in localStorage to be used after email confirmation
                const pendingUserData = {
                    id: data.user.id,
                    email: data.user.email,
                    full_name: name.trim(),
                    name: displayName.trim(),
                    country: country,
                    occupation: occupation,
                    age_range: ageRange,
                    created_at: new Date().toISOString()
                };

                try {
                    localStorage.setItem('pendingUserData', JSON.stringify(pendingUserData));
                } catch (storageError) {
                    console.error('Error storing pending user data:', storageError);
                    // Continue without localStorage - data will be lost but signup still works
                }

                setUID(data.user.id);
                setUserEmail_s(data.user.email);
                alert('Sign up successful! Please check your email to confirm your account. After confirming, you can log in.');
                setIsSignUpView(false);
                resetForm();
            }
        } catch (error) {
            setError(error.message || "An error occurred during sign up.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                throw signInError;
            }

            if (data?.user) {
                console.log('login user ---> ', data.user.id);

                // Check if this is a newly confirmed user
                let pendingUserData = null;
                try {
                    const storedData = localStorage.getItem('pendingUserData');
                    pendingUserData = storedData ? JSON.parse(storedData) : null;
                } catch (parseError) {
                    console.error('Error parsing pending user data:', parseError);
                    localStorage.removeItem('pendingUserData'); // Remove corrupted data
                }

                // If we have pending user data and it matches the current user
                if (pendingUserData && pendingUserData.id === data.user.id) {
                    console.log('Processing newly confirmed user:', data.user.id);

                    try {
                        // Insert user data
                        const userResult = await insertUserData({
                            id: data.user.id,
                            email: data.user.email,
                            full_name: pendingUserData.full_name,
                            name: pendingUserData.name,
                            country: pendingUserData.country,
                            occupation: pendingUserData.occupation,
                            age_range: pendingUserData.age_range,
                            created_at: pendingUserData.created_at
                        });

                        if (!userResult.success) {
                            console.error('Failed to insert user data:', userResult.error);
                            // Don't throw error, continue with login
                        }

                        // Initialize user usage
                        const usageResult = await initializeUserUsage(data.user.id);

                        if (!usageResult.success) {
                            console.error('Failed to initialize user usage:', usageResult.error);
                            // Don't throw error, continue with login
                        }

                        // Clear the pending user data only if both operations succeeded or the records already exist
                        if (userResult.success && usageResult.success) {
                            try {
                                localStorage.removeItem('pendingUserData');
                                console.log('Pending user data cleared successfully');
                            } catch (storageError) {
                                console.error('Error clearing pending user data:', storageError);
                            }
                        }

                    } catch (error) {
                        console.error('Database operation error:', error);
                        // Log the error but don't prevent login
                        // The user can still use the app, and we can retry data insertion later
                    }
                }

                // Set user state (redirect will be handled by auth context)
                setUserEmail_s(email);
                setFileURLSupabase(null);
                setQuizQuestions(null);
                setSummaryS(null);
                setFlashCards(null);
                setFile_id_s(null);
                setFileContentsS(null);
                setUID(data.user.id);

                // Note: Redirect is now handled automatically by AuthContext
            }
        } catch (error) {
            console.error('Login error:', error);
            setError(error.message || "An unexpected error occurred during login.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSignUpView) {
            handleSignUp();
        } else {
            handleLogin();
        }
    };

    const toggleView = () => {
        setIsSignUpView(!isSignUpView);
        resetForm();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="absolute top-4 right-4">
                <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    aria-label="Toggle dark mode"
                >
                    {isDarkMode ? (
                        <Sun className="h-5 w-5 text-yellow-500" />
                    ) : (
                        <Moon className="h-5 w-5 text-zinc-700" />
                    )}
                </button>
            </div>
            <div className="w-full max-w-md p-6 md:p-8 space-y-6 bg-white dark:bg-zinc-800 rounded-xl shadow-lg">
                {/* Header */}
                <div className="text-center">
                    {isSignUpView ? (
                        <UserPlus className="mx-auto h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-3" />
                    ) : (
                        <LogIn className="mx-auto h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-3" />
                    )}
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {isSignUpView ? 'Create an Account' : 'Welcome Back'}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {isSignUpView ? 'Fill in the details to join us.' : 'Sign in to continue to your account.'}
                    </p>
                </div>

                {/* Error Message Area */}
                {error && (
                    <div className="flex items-center p-3 space-x-2 text-sm bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-300 rounded-md">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {isSignUpView && (
                        <>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <User className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                                    </span>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        autoComplete="name"
                                        required={isSignUpView}
                                        placeholder="John Doe"
                                        className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    What should we call you?
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <User className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                                    </span>
                                    <input
                                        id="displayName"
                                        name="displayName"
                                        type="text"
                                        autoComplete="nickname"
                                        required={isSignUpView}
                                        placeholder="John"
                                        className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="country" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Country
                                </label>
                                <select
                                    id="country"
                                    name="country"
                                    required={isSignUpView}
                                    className="block w-full pl-3 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">Select your country</option>
                                    <option value="USA">United States</option>
                                    <option value="UK">United Kingdom</option>
                                    <option value="Canada">Canada</option>
                                    <option value="Australia">Australia</option>
                                    <option value="India">India</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="occupation" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Occupation
                                </label>
                                <select
                                    id="occupation"
                                    name="occupation"
                                    required={isSignUpView}
                                    className="block w-full pl-3 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                    value={occupation}
                                    onChange={(e) => setOccupation(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">Select your occupation</option>
                                    <option value="Student">Student</option>
                                    <option value="9-5 Job">9-5 Job</option>
                                    <option value="Entrepreneur">Entrepreneur</option>
                                    <option value="Freelancer">Freelancer</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="ageRange" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Age Range
                                </label>
                                <select
                                    id="ageRange"
                                    name="ageRange"
                                    required={isSignUpView}
                                    className="block w-full pl-3 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                    value={ageRange}
                                    onChange={(e) => setAgeRange(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">Select your age range</option>
                                    <option value="10-25">10-25 years</option>
                                    <option value="25-35">25-35 years</option>
                                    <option value="35-45">35-45 years</option>
                                    <option value="45+">45+ years</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Email address
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Mail className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                            </span>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="you@example.com"
                                className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                            </span>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUpView ? "new-password" : "current-password"}
                                required
                                placeholder="••••••••"
                                className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Confirm Password Input (only for sign up) */}
                    {isSignUpView && (
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                                </span>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required={isSignUpView}
                                    placeholder="••••••••"
                                    className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-100 rounded-md shadow-sm placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm transition duration-150 ease-in-out"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner size="h-5 w-5" color="border-white" message="" />
                                    <span className="ml-2">{isSignUpView ? 'Signing Up...' : 'Signing In...'}</span>
                                </>
                            ) : (
                                isSignUpView ? 'Sign Up' : 'Sign In'
                            )}
                        </button>
                    </div>
                </form>

                {/* Toggle View Link */}
                <div className="text-sm text-center">
                    <button
                        onClick={toggleView}
                        className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none"
                        disabled={loading}
                    >
                        {isSignUpView ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Auth;