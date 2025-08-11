import { NextRequest, NextResponse } from 'next/server';
import { TournamentData } from '@/types/golf';
import { initialTournamentData } from '@/data/demoData';
import { kv } from '@vercel/kv';
import { createClient } from 'redis';

const TOURNAMENT_DATA_KEY = 'golf-tournament-data';

// Fallback in-memory storage when neither KV nor Redis is available
let fallbackCache: TournamentData = initialTournamentData;

// Check if Vercel KV is properly configured
function isKVAvailable(): boolean {
  return !!(process.env.KV_URL && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Check if Redis URL is available
function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

// Create Redis client if available
let redisClient: ReturnType<typeof createClient> | null = null;
if (isRedisAvailable()) {
  redisClient = createClient({
    url: process.env.REDIS_URL
  });
}

// GET - Load tournament data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearCache = searchParams.get('clearCache') === 'true';
    
    if (isKVAvailable()) {
      console.log('Loading tournament data from Vercel KV...');
      
      if (clearCache) {
        console.log('Cache clear requested, forcing reload with initial data');
        await kv.set(TOURNAMENT_DATA_KEY, initialTournamentData);
        return NextResponse.json(initialTournamentData);
      }
      
      // Try to get data from KV storage
      const storedData = await kv.get(TOURNAMENT_DATA_KEY);
      
      if (storedData) {
        console.log('Tournament data found in KV storage');
        return NextResponse.json(storedData as TournamentData);
      } else {
        console.log('No data found in KV, initializing with default data');
        // Initialize KV with default data
        await kv.set(TOURNAMENT_DATA_KEY, initialTournamentData);
        return NextResponse.json(initialTournamentData);
      }
    } else if (isRedisAvailable() && redisClient) {
      console.log('Loading tournament data from Redis...');
      
      // Connect to Redis if not connected
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      
      if (clearCache) {
        console.log('Cache clear requested, forcing reload with initial data');
        await redisClient.set(TOURNAMENT_DATA_KEY, JSON.stringify(initialTournamentData));
        return NextResponse.json(initialTournamentData);
      }
      
      // Try to get data from Redis
      const storedData = await redisClient.get(TOURNAMENT_DATA_KEY);
      
      if (storedData) {
        console.log('Tournament data found in Redis');
        return NextResponse.json(JSON.parse(storedData) as TournamentData);
      } else {
        console.log('No data found in Redis, initializing with default data');
        // Initialize Redis with default data
        await redisClient.set(TOURNAMENT_DATA_KEY, JSON.stringify(initialTournamentData));
        return NextResponse.json(initialTournamentData);
      }
    } else {
      console.log('Neither KV nor Redis available, using fallback cache');
      return NextResponse.json(fallbackCache);
    }
  } catch (error) {
    console.error('Error loading tournament data:', error);
    // Return fallback cache if there's an error
    return NextResponse.json(fallbackCache);
  }
}

// POST - Save tournament data (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, userRole } = body;
    
    console.log('Attempting to save data for user role:', userRole);
    
    // Check if user has admin privileges
    if (userRole !== 'admin') {
      console.log('Unauthorized save attempt');
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }
    
    // Validate data structure
    if (!data || !data.rounds || !Array.isArray(data.rounds)) {
      console.log('Invalid data structure received');
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400 }
      );
    }
    
    if (isKVAvailable()) {
      // Save data to Vercel KV (persistent storage)
      await kv.set(TOURNAMENT_DATA_KEY, data);
      console.log('Tournament data saved successfully to Vercel KV');
    } else if (isRedisAvailable() && redisClient) {
      // Save data to Redis (persistent storage)
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      await redisClient.set(TOURNAMENT_DATA_KEY, JSON.stringify(data));
      console.log('Tournament data saved successfully to Redis');
    } else {
      // Save to fallback cache when neither KV nor Redis is available
      fallbackCache = data;
      console.log('Tournament data saved to fallback cache (no persistent storage configured)');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving tournament data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}