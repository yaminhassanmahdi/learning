// d_summaryConfig.js
// Configuration settings for the SummaryTab component

// --- Novita AI API Configuration ---
export const NOVITA_BASE_URL = 'https://cors-for-techi.onrender.com/https://api.novita.ai/v3/openai'; // Replace with your actual URL if different
export const NOVITA_API_KEY = "sk_TJGzb-mYV9KUKeLJiuIn7wJcYLwR6ZL0KaZCLnCztYo"; // Replace with your key or use env variables
export const NOVITA_MODEL = "meta-llama/llama-3.1-8b-instruct";
export const NOVITA_STREAM_ENABLED = true;

// --- Summarization Parameters ---
export const MAX_TOKENS_PER_REQUEST = 6000; // Max tokens for each AI request
export const TARGET_WORDS_PER_CHUNK = 2400; // Target word count for splitting text
export const DELAY_BETWEEN_CHUNKS_MIN_MS = 500; // Minimum delay between processing chunks
export const DELAY_BETWEEN_CHUNKS_MAX_MS = 2000; // Maximum delay between processing chunks
export const SAVE_INTERMEDIATE_EVERY_N_CHUNKS = 6; // How often to save intermediate progress to DB

// --- Concurrency Limiting ---
// export const REDIS_COUNTER_KEY = 'limit' // If using Redis for external limiting
// export const RETRY_DELAY_MS = 5000
// export const MAX_CONCURRENT = 3