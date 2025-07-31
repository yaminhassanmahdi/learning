// src/app/api/transcript/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
    try {
        const { videoUrl } = await req.json();

        if (!videoUrl) {
            return NextResponse.json({ error: 'Video URL is required.' }, { status: 400 });
        }

        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoUrl);
        const fullTranscript = transcriptItems.map(item => item.text).join(' ');

        return NextResponse.json({ transcript: fullTranscript, videoTitle: videoUrl });
    } catch (error: any) {
        console.error('Transcript Error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch transcript.' }, { status: 500 });
    }
}
