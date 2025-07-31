import React from 'react';
import { FiInfo, FiChevronDown, FiChevronRight, FiLoader, FiTrash2, FiPlus, FiZap, FiBookOpen, FiStar } from 'react-icons/fi';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
const Sidebar = ({
    hasReachedPrepLimit,
    AI_CONFIGURED,
    MAX_USER_PREPS,
    onClearSelection,
    userPreps = [],
    activePrepId,
    handlePrepSelect,
    isLoading,
    loadingPrepContent,
    handleDeletePrep,
    onCloseSidebar, // <-- add this prop
}) => {
    return (
        <div className="flex flex-col h-full space-y-6 z-[-10] ">
            {/* Mobile close button (if needed) */}

            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center space-x-3">

                    <div>
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            Exam Prep Hub
                        </h1>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            AI-powered study companion
                        </p>
                    </div>
                </div>
            </div>

            {/* Prep Limit Warning */}
            {hasReachedPrepLimit && AI_CONFIGURED && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl backdrop-blur-sm">
                    <div className="flex items-start space-x-3">
                        <div className="p-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                            <FiInfo className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                                Storage Full
                            </h3>
                            <p className="text-amber-700 dark:text-amber-300 text-xs mt-1 leading-relaxed">
                                You&apos;ve reached the limit of {MAX_USER_PREPS} saved preparations. Delete one to create a new one.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Create New Button */}
            {/* <button
                onClick={onClearSelection}
                className="group relative w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center space-x-2"
            >
                <FiPlus className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" />
                <span>Create New Exam</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button> */}
            <button
                onClick={onClearSelection}
                className=" group p-3 w-full rounded font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow
                dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 
                        bg-zinc-800 hover:bg-zinc-200 text-white hover:text-zinc-800 flex flex-row space-x-2 items-center justify-center"

            >
                <FiPlus className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" />
                <span>Create New Exam</span>
            </button>

            {/* Saved Preparations */}
            {userPreps.length > 0 && AI_CONFIGURED && (
                <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center space-x-2">
                            <FiBookOpen className="w-4 h-4" />
                            <span>Saved Preparations</span>
                        </h2>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                            {userPreps.length}
                        </span>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
                        {userPreps.map((prep, index) => (
                            <div
                                key={prep.id}
                                className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${activePrepId === prep.id
                                    ? 'bg-gradient-to-r from-green-50 to-green-50 dark:from-green-900/30 dark:to-green-900/30 border-green-200 dark:border-green-700/50 shadow-md'
                                    : 'bg-white/80 dark:bg-zinc-800/80 border-zinc-200/50 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center p-3">
                                    <button
                                        onClick={() => handlePrepSelect(prep.id)}
                                        className="flex-1 flex items-center space-x-3 text-left focus:outline-none"
                                        disabled={isLoading || loadingPrepContent}
                                        title={`View: ${prep.prep_name}`}
                                    >
                                        <div className="flex-shrink-0">
                                            <div className={`p-2 rounded-lg transition-all duration-200 ${activePrepId === prep.id
                                                ? 'bg-green-100 dark:bg-green-900/40'
                                                : 'bg-zinc-100 dark:bg-zinc-700 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-600'
                                                }`}>
                                                {activePrepId === prep.id ? (
                                                    <FiChevronDown className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <FiChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium text-sm truncate transition-colors duration-200 ${activePrepId === prep.id
                                                ? 'text-green-700 dark:text-green-300'
                                                : 'text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                                                }`}>
                                                {prep.prep_name}
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                {new Date(prep.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </button>

                                    {/* Loading indicator */}
                                    {loadingPrepContent && activePrepId === prep.id && (
                                        <div className="flex-shrink-0 ml-2">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                                                <FiLoader className="animate-spin w-4 h-4 text-green-600 dark:text-green-400" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Delete button */}
                                    <button
                                        onClick={() => handleDeletePrep(prep.id)}
                                        className="flex-shrink-0 ml-2 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isLoading || loadingPrepContent}
                                        title="Delete preparation"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Active indicator */}
                                {activePrepId === prep.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-green-600 rounded-r-full"></div>
                                )}

                                {/* Hover effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {userPreps.length === 0 && AI_CONFIGURED && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4 p-6">
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-fit mx-auto">
                            <FiBookOpen className="w-8 h-8 text-zinc-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                No preparations yet
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Create your first exam preparation to get started
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                        <FiStar className="w-3 h-3" />
                        <span>AI-Powered</span>
                    </div>
                    <span>{userPreps.length} / {MAX_USER_PREPS}</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;