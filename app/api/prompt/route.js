import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const promptPath = path.join(process.cwd(), 'prompt.txt');
    const promptText = await fs.readFile(promptPath, 'utf8');
    return NextResponse.json({ prompt: promptText.trim() });
  } catch (error) {
    console.error('Error reading prompt.txt:', error);
    return NextResponse.json({ prompt: '' });
  }
} 