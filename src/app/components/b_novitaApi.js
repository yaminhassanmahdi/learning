// b_novitaApi.js
// Function for interacting with the Novita AI API

import { releaseSlot, waitForSlot } from '../lib/redisClient'; // Assuming redis client is set up for concurrency

/**
 * Summarizes a text chunk using the Novita AI API.
 * @param {object} openai - The initialized OpenAI client instance configured for Novita.
 * @param {object} config - Configuration object { model, maxTokens, stream }
 * @param {string} textChunk - The text chunk to summarize.
 * @param {boolean} isFinalCombine - Flag indicating if this is the final combination step.
 * @param {number} chunkIndex - The index of the current chunk (for logging/progress).
 * @param {number} totalChunks - The total number of chunks (for logging/progress).
 * @param {function} setSummaryProgress - Function to update the progress message state.
 * @returns {Promise<string>} The generated summary text.
 */
export const summarizeTextChunk = async (
    openai,
    config,
    textChunk,
    isFinalCombine = false,
    chunkIndex = 0,
    totalChunks = 1,
    setSummaryProgress // Pass the state setter
) => {
    if (!openai) throw new Error("Novita AI client not provided.");
    if (!textChunk || textChunk.trim() === "") {
        console.warn(`NovitaAPI: Skipping empty text chunk ${isFinalCombine ? '(final combine)' : `(${chunkIndex + 1}/${totalChunks})`}.`);
        return ""; // Return empty string for empty input
    }

    let prompt;
    const logPrefix = `NovitaAPI: [${isFinalCombine ? 'Final Combine' : `Chunk ${chunkIndex + 1}/${totalChunks}`}]`;

    if (isFinalCombine) {
        if (setSummaryProgress) setSummaryProgress("Refining summaries...");
        prompt = `The following text consists of notes from different parts of a larger document.
          Please synthesize these into a **single, coherent final revision notes** in **Markdown** format.

          Follow these guidelines precisely:
          - Create a unified narrative, removing redundancy between the partial summaries.
          - Use **Bold** for emphasis (e.g., **text**).
          - Use *Italics* for emphasis (e.g., *text*).
          - Use unordered lists with **-** or **•** for list items.
          - Use tables to visualize important things.
          - Use 3-4 tables to highlight (mandatory).
          - Ensure links are in the format [link text](URL).
          - Aim for a concise final summary with all the main points or headlines (e.g., 5-8 main points or paragraphs).
          - Structure for readability using paragraphs and bullet points.
          - At the end, provide 2 or 3 relevant website links for further reading if appropriate based on the content.
          - Add mnemonics.
          - At the end add things that can come in exam.

          Partial notes:
          ---
          ${textChunk}
          ---
          Final Coherent notes (Markdown Format) (everything should be in markdown format mandatory) Make the notes dont lose information:
        `;
    } else {
        const progressPercentage = totalChunks > 0 ? Math.round(((chunkIndex + 1) / totalChunks) * 100) : 0;
        if (setSummaryProgress) setSummaryProgress(`Summarizing (${progressPercentage}%)...`);
        prompt = `Please make notes of the following text chunk, which is part of a larger document.
          Focus on extracting the key information from **this specific chunk**.
          Format the output in **Markdown**.

          Guidelines:
          - Use **Bold** and *Italics* for emphasis.
          - Use lists (-) if appropriate for this chunk.
          - Keep it concise, focusing only on this chunk's content.
          - create 1-2 tables for easy visualization of complex topics
          - Consider the most important infos only
          - Don't lose info

          Text Chunk to create revision notes:
          ---
          ${textChunk}
          ---
          Concise note of this Chunk (Markdown Format):
        `;
    }

    console.log(`${logPrefix} Requesting summary via Novita.ai...`);

    // --- Concurrency Limiting (using Redis example) ---
    await waitForSlot(); // Wait for an available slot before making the API call

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: config.model,
            stream: config.stream,
            max_tokens: config.maxTokens,
            response_format: { type: "text" }, // Ensure text output if supported
            // temperature: 0.7 // Optional: Adjust creativity/focus
        });

        let fullResponse = "";

        if (config.stream) {
            console.log(`${logPrefix} Receiving stream...`);
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullResponse += content;
                // Note: Real-time update of intermediate display is handled in the main component
                // based on the *final* result of this function for chunk summaries.
                if (chunk.choices[0]?.finish_reason) {
                    console.log(`${logPrefix} Stream finished. Reason: ${chunk.choices[0].finish_reason}`);
                }
            }
        } else {
            // Handle non-streaming response
            fullResponse = completion.choices[0]?.message?.content?.trim() ?? "";
        }

        if (!fullResponse && !config.stream) { // Check non-stream response
            throw new Error(`Novita AI returned an empty response.`);
        }
        if (config.stream && fullResponse.trim() === "") {
            console.warn(`${logPrefix} Novita AI stream resulted in an empty response after processing.`);
            // Return empty string, let the main component handle it
        }

        console.log(`${logPrefix} Received summary from Novita.ai.`);
        return fullResponse.trim(); // Return the complete summary string

    } catch (err) {
        console.error(`${logPrefix} Error during Novita AI call:`, err);
        const errorMessage = err.response?.data?.message || err.message || 'Unknown AI error';
        // Throw a specific error to be caught by the main component
        throw new Error(`Failed during ${isFinalCombine ? 'final summary' : `chunk ${chunkIndex + 1}`} generation via Novita: ${errorMessage}`);
    } finally {
        console.log(`${logPrefix} Releasing slot.`);
        await releaseSlot(); // Release the slot whether success or failure
    }
};