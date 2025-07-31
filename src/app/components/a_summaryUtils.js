// a_summaryUtils.js
// Utility functions for text processing in SummaryTab

/**
 * Splits a large text into smaller chunks based on paragraphs and target word count.
 * Attempts further splitting if a chunk significantly exceeds the target size.
 * @param {string} text - The input text to split.
 * @param {number} wordsPerChunk - The target number of words for each chunk.
 * @returns {string[]} An array of text chunks.
 */
export const splitTextIntoChunks = (text, wordsPerChunk) => {
    if (!text) return [];
    // Split by one or more blank lines (accounts for different newline patterns)
    const paragraphs = text.split(/(\n\s*){2,}/);
    const chunks = [];
    let currentChunk = "";
    let currentWordCount = 0;

    for (const paragraph of paragraphs) {
        if (!paragraph || paragraph.trim() === "") continue; // Skip empty separators/paragraphs
        const trimmedParagraph = paragraph.trim();
        const paragraphWords = trimmedParagraph.split(/\s+/).length;

        if (currentWordCount > 0 && currentWordCount + paragraphWords > wordsPerChunk) {
            // If adding the next paragraph exceeds the limit, finalize the current chunk
            chunks.push(currentChunk.trim());
            currentChunk = trimmedParagraph; // Start new chunk with the current paragraph
            currentWordCount = paragraphWords;
        } else {
            // Add the paragraph to the current chunk
            currentChunk += (currentChunk ? "\n\n" : "") + trimmedParagraph; // Add separator back if needed
            currentWordCount += paragraphWords;
        }
    }
    // Add the last accumulated chunk if it's not empty
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    // --- Secondary Split for Very Large Chunks ---
    // This addresses cases where a single paragraph might exceed the word limit.
    const finalChunks = [];
    // Estimate token count roughly (words * 6 chars/word can be a proxy)
    // Using character length as a more direct measure related to tokens.
    const roughCharLimit = wordsPerChunk * 6; // Adjust multiplier based on typical token length

    for (const chunk of chunks) {
        // Check if chunk significantly exceeds the rough character limit (e.g., 20% buffer)
        if (chunk.length > roughCharLimit * 1.2) {
            console.warn(`SummaryTab Util: Chunk significantly larger than target (${chunk.length} chars vs limit ~${roughCharLimit}), attempting word-based split.`);
            const words = chunk.split(/\s+/);
            let subChunk = "";
            let subWordCount = 0;
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                // Add word if it doesn't exceed the target count
                if (subWordCount < wordsPerChunk) {
                    subChunk += (subChunk ? " " : "") + word;
                    subWordCount++;
                } else {
                    // Target reached, push the sub-chunk and start a new one
                    finalChunks.push(subChunk);
                    subChunk = word; // Start new sub-chunk with the current word
                    subWordCount = 1;
                }
            }
            // Push the last sub-chunk if it contains words
            if (subChunk) finalChunks.push(subChunk);
        } else {
            // Chunk is within reasonable size, add it directly
            finalChunks.push(chunk);
        }
    }

    console.log(`SummaryTab Util: Split text into ${finalChunks.length} final chunks.`);
    return finalChunks;
};