import { TournamentData } from '@/types/golf';
import { initialTournamentData } from '@/data/demoData';

const STORAGE_KEY = 'tribute-golf-tournament';

export const saveTournamentData = (data: TournamentData): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error saving tournament data:', error);
  }
};

export const loadTournamentData = (): TournamentData => {
  try {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Validate the data structure
        if (parsedData && parsedData.rounds && Array.isArray(parsedData.rounds)) {
          return parsedData as TournamentData;
        }
      }
    }
  } catch (error) {
    console.error('Error loading tournament data:', error);
  }
  
  // Return initial data only if no saved data exists or there's an error
  return initialTournamentData;
};

export const clearTournamentData = (): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error clearing tournament data:', error);
  }
};