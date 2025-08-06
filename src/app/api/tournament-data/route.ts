import { NextRequest, NextResponse } from 'next/server';
import { TournamentData } from '@/types/golf';
import { initialTournamentData } from '@/data/demoData';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'tournament-data.json');

// Ensure data file exists with initial data
function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialTournamentData, null, 2));
    }
  } catch (error) {
    console.error('Error ensuring data file exists:', error);
  }
}

// GET - Load tournament data
export async function GET() {
  try {
    ensureDataFile();
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const tournamentData = JSON.parse(data) as TournamentData;
    
    return NextResponse.json(tournamentData);
  } catch (error) {
    console.error('Error loading tournament data:', error);
    // Return initial data if there's an error reading the file
    return NextResponse.json(initialTournamentData);
  }
}

// POST - Save tournament data (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, userRole } = body;
    
    // Check if user has admin privileges
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }
    
    // Validate data structure
    if (!data || !data.rounds || !Array.isArray(data.rounds)) {
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400 }
      );
    }
    
    ensureDataFile();
    
    // Save data to file
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving tournament data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}