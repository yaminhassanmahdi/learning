// app/page.tsx
'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust path if necessary
import { Sun, Moon, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useAtomValue } from 'jotai'; // Removed Provider, useAtom, useSetAtom as they were not used directly in this component beyond useAtomValue
import {
    user_id_supabase,
} from "../../store/uploadAtoms"; // Assuming this path is correct for your project structure

// Define the Task type
interface Task {
    id: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    title: string;
    is_completed: boolean;
    created_at: string;
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tasksForModal, setTasksForModal] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isLoadingTasks, setIsLoadingTasks] = useState(false); // Used for modal and monthly fetch
    const [darkMode, setDarkMode] = useState(false);
    const [monthlyTaskCounts, setMonthlyTaskCounts] = useState<Record<string, number>>({});

    const DEMO_USER_ID = useAtomValue(user_id_supabase);



    // Calendar Logic
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const monthDaysCount = daysInMonth(currentYear, currentMonth);
    const startingDay = firstDayOfMonth(currentYear, currentMonth);

    const calendarDays: (Date | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= monthDaysCount; i++) {
        calendarDays.push(new Date(currentYear, currentMonth, i));
    }
    while (calendarDays.length % 7 !== 0 && calendarDays.length < 42) {
        calendarDays.push(null);
    }

    const prevMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const fetchMonthlyTasks = useCallback(async (year: number, month: number) => {
        if (!DEMO_USER_ID) { // Don't fetch if user_id isn't available yet
            setMonthlyTaskCounts({});
            return;
        }
        setIsLoadingTasks(true); // Indicate loading for the monthly counts
        const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
        const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('tasks')
            .select('id, date, is_completed') // Fetch is_completed status
            .eq('user_id', DEMO_USER_ID)
            .gte('date', firstDay)
            .lte('date', lastDay);

        if (error) {
            console.error('Error fetching monthly tasks:', error.message);
            setMonthlyTaskCounts({});
        } else if (data) {
            const counts: Record<string, number> = {};
            data.forEach(task => {
                if (!task.is_completed) { // Only count incomplete tasks
                    counts[task.date] = (counts[task.date] || 0) + 1;
                }
            });
            setMonthlyTaskCounts(counts);
        }
        setIsLoadingTasks(false);
    }, [DEMO_USER_ID]); // DEMO_USER_ID is now a dependency

    useEffect(() => {
        fetchMonthlyTasks(currentYear, currentMonth);
    }, [currentYear, currentMonth, fetchMonthlyTasks]);


    const fetchTasksForModal = async (date: Date) => {
        if (!date || !DEMO_USER_ID) {
            setTasksForModal([]);
            return;
        }
        setIsLoadingTasks(true); // Indicate loading for modal tasks
        const dateString = date.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', DEMO_USER_ID)
            .eq('date', dateString)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching tasks for modal:', error.message);
            setTasksForModal([]);
        } else {
            setTasksForModal(data || []);
        }
        setIsLoadingTasks(false);
    };

    const handleDateClick = (date: Date | null) => {
        if (!date) return;
        setSelectedDate(date);
        fetchTasksForModal(date); // fetchTasksForModal also uses DEMO_USER_ID implicitly via Supabase client
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedDate(null);
        setTasksForModal([]);
        setNewTaskTitle('');
    };

    const handleAddTask = async (e: FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !selectedDate || !DEMO_USER_ID) return;

        const dateString = selectedDate.toISOString().split('T')[0];
        const newTaskPayload = {
            user_id: DEMO_USER_ID,
            date: dateString,
            title: newTaskTitle.trim(),
            is_completed: false, // New tasks are incomplete
        };

        const { data, error } = await supabase
            .from('tasks')
            .insert(newTaskPayload)
            .select()
            .single();

        if (error) {
            console.error('Error adding task:', error.message);
        } else if (data) {
            setTasksForModal(prevTasks => [...prevTasks, data as Task]);
            setNewTaskTitle('');
            // Update monthly count for incomplete tasks
            setMonthlyTaskCounts(prevCounts => ({
                ...prevCounts,
                [dateString]: (prevCounts[dateString] || 0) + 1,
            }));
        }
    };

    const toggleTaskCompletion = async (taskId: string, currentStatus: boolean) => {
        const taskToUpdate = tasksForModal.find(task => task.id === taskId);
        if (!taskToUpdate) return;

        const newStatus = !currentStatus;
        const taskDate = taskToUpdate.date;

        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: newStatus })
            .eq('id', taskId);

        if (error) {
            console.error('Error updating task:', error.message);
        } else {
            setTasksForModal(prevTasks =>
                prevTasks.map(task =>
                    task.id === taskId ? { ...task, is_completed: newStatus } : task
                )
            );
            // Update monthly count based on whether the task became complete or incomplete
            setMonthlyTaskCounts(prevCounts => {
                const currentCount = prevCounts[taskDate] || 0;
                return {
                    ...prevCounts,
                    [taskDate]: newStatus ? Math.max(0, currentCount - 1) : currentCount + 1,
                };
            });
        }
    };

    const handleDeleteTask = async (taskId: string, taskDate: string) => {
        const taskToDelete = tasksForModal.find(task => task.id === taskId);
        if (!taskToDelete) return;

        const wasIncomplete = !taskToDelete.is_completed;

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

        if (error) {
            console.error('Error deleting task:', error.message);
        } else {
            setTasksForModal(prevTasks => prevTasks.filter(task => task.id !== taskId));
            // If the deleted task was incomplete, decrement the monthly count
            if (wasIncomplete) {
                setMonthlyTaskCounts(prevCounts => ({
                    ...prevCounts,
                    [taskDate]: Math.max(0, (prevCounts[taskDate] || 1) - 1),
                }));
            }
        }
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        // Provider for Jotai is assumed to be higher up in the component tree
        <div className="h-fit bg-zinc-50 dark:bg-zinc-700/60 rounded-lg text-light-text dark:text-dark-text transition-colors duration-300 p-4">
            <div className="max-w-3xl mx-auto">



                {/* Calendar Navigation */}
                <div className="flex justify-between items-center mb-2 p-2 rounded bg-transparent shadow-sm">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-md dark:text-zinc-50 hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-lg dark:text-zinc-50 font-semibold">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                        onClick={nextMonth}
                        className="p-2 rounded-md hover:bg-zinc-400  dark:text-zinc-50  dark:hover:bg-zinc-600 transition-colors"
                        aria-label="Next month"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 text-center font-medium">
                    {dayNames.map(day => (
                        <div key={day} className="p- text-sm text-zinc-500 dark:text-zinc-400">
                            {day}
                        </div>
                    ))}
                    {calendarDays.map((day, index) => {
                        const dayString = day ? day.toISOString().split('T')[0] : '';
                        const taskCount = dayString && DEMO_USER_ID ? monthlyTaskCounts[dayString] || 0 : 0; // Show 0 if no user ID

                        return (
                            <div
                                key={index}
                                className={`p-1 sm:p-2  border-zinc-300  dark:text-zinc-50 rounded aspect-square flex flex-col items-center justify-center relative border-2
                                  ${day ? 'cursor-pointer hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors' : 'bg-zinc-100 dark:bg-zinc-800/50'}
                                  ${day && new Date().toDateString() === day.toDateString() ? 'bg-blue-500/30 dark:border-green-400 dark:bg-zinc-800/40 font-bold' : 'dark:border-zinc-700'}
                                  ${selectedDate && day && selectedDate.toDateString() === day.toDateString() ? 'ring-2 ring-blue-500' : ''}
                                `}
                                onClick={() => day && handleDateClick(day)}
                            >
                                {day ? day.getDate() : ''}
                                {taskCount > 0 && (
                                    <span className="absolute bottom-1 right-1 text-xs bg-red-500 text-white rounded-full h-3 w-3 flex items-center justify-center sm:h-5 sm:w-5">
                                        {taskCount}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal for Tasks */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 opacity-100">
                    <div className="bg-zinc-300/60 dark:bg-zinc-800/70 p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 scale-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold dark:text-zinc-200">
                                Tasks for {selectedDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="p-1 rounded-full hover:bg-zinc-400 dark:hover:bg-zinc-600 dark:text-zinc-200 transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mb-4 max-h-60 overflow-y-auto space-y-2 pr-2">
                            {isLoadingTasks && tasksForModal.length === 0 && isModalOpen ? (
                                <p>Loading tasks...</p>
                            ) : tasksForModal.length > 0 ? (
                                tasksForModal.map(task => (
                                    <div key={task.id} className="flex items-center justify-between p-2 bg-zinc-200 dark:bg-zinc-700 rounded">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id={`task-${task.id}`}
                                                checked={task.is_completed}
                                                onChange={() => toggleTaskCompletion(task.id, task.is_completed)}
                                                className="mr-3 h-5 w-5 text-blue-600 border-zinc-400 dark:border-zinc-500 rounded focus:ring-blue-500 bg-transparent"
                                            />
                                            <label
                                                htmlFor={`task-${task.id}`}
                                                className={`flex-grow ${task.is_completed ? 'line-through text-zinc-500 dark:text-zinc-400' : 'dark:text-zinc-100'}`}
                                            >
                                                {task.title}
                                            </label>
                                        </div>
                                        <button onClick={() => handleDeleteTask(task.id, task.date)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" aria-label="Delete task">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="dark:text-zinc-400">No tasks for this date. Add one below!</p>
                            )}
                        </div>

                        <form onSubmit={handleAddTask} className="flex gap-2">
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Enter new task title"
                                className="flex-grow p-2 border border-zinc-400 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-700 focus:ring-1 dark:text-zinc-100 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <button
                                type="submit"
                                className="bg-blue-500/80 hover:bg-blue-500
                                dark:bg-green-400 dark:hover:bg-green-500  text-white font-semibold p-2 rounded transition-colors flex items-center"
                                aria-label="Add task"
                                disabled={!DEMO_USER_ID} // Disable if no user ID
                            >
                                <Plus size={20} className="mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Add</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {isModalOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={closeModal}></div>}
        </div>
    );
}