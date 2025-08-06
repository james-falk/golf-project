import { TournamentData } from '@/types/golf';
import { initialTournamentData } from '@/data/demoData';
import { UserRole } from '@/contexts/AuthContext';

// Save tournament data to server (admin only)
export const saveTournamentData = async (data: TournamentData, userRole: UserRole): Promise<boolean> => {
  try {
    const response = await fetch('/api/tournament-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, userRole }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save data: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error saving tournament data:', error);
    return false;
  }
};

// Load tournament data from server
export const loadTournamentData = async (): Promise<TournamentData> => {
  try {
    const response = await fetch('/api/tournament-data', {
      method: 'GET',
      cache: 'no-cache', // Ensure fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate the data structure
    if (data && data.rounds && Array.isArray(data.rounds)) {
      return data as TournamentData;
    }
    
    throw new Error('Invalid data structure received');
  } catch (error) {
    console.error('Error loading tournament data:', error);
    // Return initial data if there's an error
    return initialTournamentData;
  }
};

// Legacy function for backward compatibility - now just returns initial data
export const clearTournamentData = (): void => {
  console.log('Clear function called - data is now managed server-side');
};