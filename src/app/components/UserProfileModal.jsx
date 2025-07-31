import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAtom } from 'jotai';
import { user_id_supabase } from '../../store/uploadAtoms';
import { toast } from 'sonner';
import { User, UserCircle, Briefcase, Calendar, ChevronDown } from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose }) {
    const [uid] = useAtom(user_id_supabase);
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        name: '',
        occupation: '',
        age_range: '',
        email: ''
    });
    const [userUsage, setUserUsage] = useState(null);
    const [isUsageExpanded, setIsUsageExpanded] = useState(false);

    useEffect(() => {
        if (isOpen && uid) {
            fetchUserProfile();
            fetchUserUsage();
        }
    }, [isOpen, uid]);

    const fetchUserProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('full_name, name, occupation, age_range, email')
                .eq('id', uid)
                .single();

            if (error) throw error;
            if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    name: data.name || '',
                    occupation: data.occupation || '',
                    age_range: data.age_range || '',
                    email: data.email || ''
                });
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            toast.error('Failed to load profile');
        }
    };

    const fetchUserUsage = async () => {
        try {
            const { data, error } = await supabase
                .from('user_usage')
                .select('*')
                .eq('user_id', uid)
                .single();

            if (error) throw error;
            setUserUsage(data);
        } catch (error) {
            console.error('Error fetching user usage:', error);
            toast.error('Failed to load usage data');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: profile.full_name,
                    name: profile.name,
                    occupation: profile.occupation,
                    age_range: profile.age_range
                })
                .eq('id', uid);

            if (error) throw error;
            toast.success('Profile updated successfully');
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const usageItems = userUsage ? [
        { label: "Chats", count: userUsage.chat_request_count },
        { label: "Summaries", count: userUsage.summary_count },
        { label: "AI Notes", count: userUsage.ai_notes_count },
        { label: "Flashcards", count: userUsage.flashcard_count },
        { label: "Quizzes", count: userUsage.quiz_count },
        { label: "Paraphrase", count: userUsage.paraphrase_count },
        { label: "AI Check", count: userUsage.ai_check_count },
        { label: "Humanizer", count: userUsage.humanizer_count },
        { label: "Grammar", count: userUsage.grammer_check_count },
        { label: "Exam Prep", count: userUsage.exm_prep_count },
        { label: "Personal Writing", count: userUsage.per_w_count },
        { label: "Solver Chat", count: userUsage.solver_chat_count },
        { label: "General Chat", count: userUsage.general_chat_count },
        { label: "Memes", count: userUsage.meme_count }
    ] : [];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md mx-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Edit Profile</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Display (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </span>
                            <input
                                type="email"
                                value={profile.email}
                                disabled
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 bg-gray-100 dark:bg-zinc-700 dark:text-gray-100 rounded-md shadow-sm cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Existing form fields */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Full Name
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </span>
                            <input
                                type="text"
                                value={profile.full_name}
                                onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm"
                                placeholder="Your full name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            What should we call you?
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <UserCircle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </span>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm"
                                placeholder="Your preferred name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Occupation
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Briefcase className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </span>
                            <select
                                value={profile.occupation}
                                onChange={(e) => setProfile(prev => ({ ...prev, occupation: e.target.value }))}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm"
                            >
                                <option value="">Select your occupation</option>
                                <option value="Student">Student</option>
                                <option value="9-5 Job">9-5 Job</option>
                                <option value="Entrepreneur">Entrepreneur</option>
                                <option value="Freelancer">Freelancer</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Age Range
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </span>
                            <select
                                value={profile.age_range}
                                onChange={(e) => setProfile(prev => ({ ...prev, age_range: e.target.value }))}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm"
                            >
                                <option value="">Select your age range</option>
                                <option value="10-25">10-25 years</option>
                                <option value="25-35">25-35 years</option>
                                <option value="35-45">35-45 years</option>
                                <option value="45+">45+ years</option>
                            </select>
                        </div>
                    </div>

                    {/* Usage Information Dropdown */}
                    <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 mt-4">
                        <button
                            type="button"
                            onClick={() => setIsUsageExpanded(!isUsageExpanded)}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-left hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
                        >
                            <span className="font-medium text-sm text-gray-700 dark:text-gray-200">Usage Details</span>
                            <ChevronDown
                                className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isUsageExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {isUsageExpanded && (
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-md">
                                {userUsage?.is_premium ? (
                                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                        ✨ Premium Plan: Unlimited Usage
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {usageItems.map(item => (
                                            <div key={item.label} className="flex justify-between items-center border-b border-gray-200 dark:border-zinc-600 pb-1">
                                                <span className="text-gray-600 dark:text-gray-300">{item.label}:</span>
                                                <span className={`font-medium ${item.count <= 2 ? 'text-red-600 dark:text-red-400' : item.count <= 5 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    {item.count ?? 'N/A'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
} 