'use client';

import { useState } from 'react';

async function getYouTubeData(videoUrlOrId: string) {
    const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrlOrId }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Transcript fetch failed.');
    }

    const data = await res.json();
    return {
        transcript: data.transcript,
        videoTitle: data.videoTitle,
    };
}
  

export default function YouTubeTranscriptViewer() {
    const [videoUrl, setVideoUrl] = useState('');
    const [transcript, setTranscript] = useState('');
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFetch = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getYouTubeData(videoUrl);
            setTranscript(result.transcript);
            setTitle(result.videoTitle);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch transcript.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
            <h1 className="text-2xl font-bold mb-4">YouTube Transcript Viewer</h1>
            <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter YouTube URL or Video ID"
                className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            <button
                onClick={handleFetch}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={loading}
            >
                {loading ? 'Fetching...' : 'Get Transcript'}
            </button>
            {error && <p className="mt-4 text-red-500">{error}</p>}
            {transcript && (
                <div className="mt-6">
                    <h2 className="text-xl font-semibold mb-2">{title}</h2>
                    <p className="whitespace-pre-wrap text-gray-800">{transcript}</p>
                </div>
            )}
        </div>
    );
}
