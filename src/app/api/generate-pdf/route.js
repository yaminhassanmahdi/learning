import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export async function POST(request) {
    let browser = null;

    try {
        // Validate request body
        const body = await request.json();
        const { html, filename } = body;

        if (!html) {
            return NextResponse.json(
                { error: 'HTML content is required' },
                { status: 400 }
            );
        }

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        // Validate filename format
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
        if (sanitizedFilename !== filename) {
            return NextResponse.json(
                { error: 'Invalid filename format' },
                { status: 400 }
            );
        }

        // Connect to Browserless.io
        try {
            browser = await puppeteer.connect({
                browserWSEndpoint: `wss://production-sfo.browserless.io?token=2SVDlUVVgiYU19ca1af60e579f2dc5b4b75ba1b7933a96a1d`,
            });
        } catch (launchError) {
            console.error('Browser connection error:', launchError);
            return NextResponse.json(
                { error: 'Failed to connect to PDF generation service' },
                { status: 500 }
            );
        }

        // Create new page
        const page = await browser.newPage();

        try {
            // Set content with timeout
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000 // 30 second timeout
            });
        } catch (contentError) {
            console.error('Content setting error:', contentError);
            return NextResponse.json(
                { error: 'Failed to process HTML content' },
                { status: 500 }
            );
        }

        try {
            // Generate PDF with specific options
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '70px',
                    right: '50px',
                    bottom: '70px',
                    left: '50px'
                },
                timeout: 30000 // 30 second timeout
            });

            // Return PDF with proper headers
            return new NextResponse(pdf, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
                    'Content-Length': pdf.length.toString()
                }
            });

        } catch (pdfError) {
            console.error('PDF generation error:', pdfError);
            return NextResponse.json(
                { error: 'Failed to generate PDF document' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Unexpected error in PDF generation:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred during PDF generation' },
            { status: 500 }
        );
    } finally {
        // Ensure browser is closed even if an error occurs
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
    }
} 