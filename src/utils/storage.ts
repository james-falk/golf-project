import { TournamentData } from '@/types/golf';
import { initialTournamentData } from '@/data/demoData';
import { UserRole } from '@/contexts/AuthContext';

// Save tournament data to server (admin only)
export const saveTournamentData = async (data: TournamentData, userRole: UserRole): Promise<boolean> => {
  try {
    console.log('Attempting to save tournament data...', { userRole, dataKeys: Object.keys(data) });
    
    const response = await fetch('/api/tournament-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, userRole }),
    });

    console.log('Save response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Save response error:', errorText);
      throw new Error(`Failed to save data: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Save successful:', result);
    return true;
  } catch (error) {
    console.error('Error saving tournament data:', error);
    return false;
  }
};

// Load tournament data from server
export const loadTournamentData = async (): Promise<TournamentData> => {
  try {
    console.log('Loading tournament data from API...');
    
    const response = await fetch('/api/tournament-data', {
      method: 'GET',
      cache: 'no-cache', // Ensure fresh data
    });

    console.log('Load response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Load response error:', errorText);
      throw new Error(`Failed to load data: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Data loaded successfully:', { rounds: data.rounds?.length });
    
    // Validate the data structure
    if (data && data.rounds && Array.isArray(data.rounds)) {
      return data as TournamentData;
    }
    
    throw new Error('Invalid data structure received');
  } catch (error) {
    console.error('Error loading tournament data:', error);
    console.log('Falling back to initial data');
    // Return initial data if there's an error
    return initialTournamentData;
  }
};

// Legacy function for backward compatibility - now just returns initial data
export const clearTournamentData = (): void => {
  console.log('Clear function called - data is now managed server-side');
};