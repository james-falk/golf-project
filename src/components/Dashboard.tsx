'use client';

import React, { useState, useEffect } from 'react';
import { GameTab, RoundTab, TournamentData, RoundData } from '@/types/golf';
import { loadTournamentData, saveTournamentData } from '@/utils/storage';
import { useAuth } from '@/contexts/AuthContext';
import SkinsTab from './tabs/SkinsTab';
import ClosestToPinTab from './tabs/ClosestToPinTab';
import ScrambleTab from './tabs/ScrambleTab';
import LeaderboardTab from './tabs/LeaderboardTab';
// import TotalWinnings from './TotalWinnings';

const Dashboard = () => {
  const { userRole, logout } = useAuth();
  
  // Load saved tab and round state, or use defaults
  const [activeTab, setActiveTab] = useState<GameTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golf-active-tab');
      if (saved && ['skins', 'closest-pin', 'scramble', 'leaderboard'].includes(saved)) {
        return saved as GameTab;
      }
    }
    return 'skins';
  });
  
  const [activeRound, setActiveRound] = useState<RoundTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golf-active-round');
      if (saved && ['thursday', 'friday', 'saturday'].includes(saved)) {
        return saved as RoundTab;
      }
    }
    return 'thursday';
  });
  
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await loadTournamentData();
        setTournamentData(data);
      } catch (error) {
        console.error('Failed to load tournament data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Save data whenever it changes (admin only)
  useEffect(() => {
    const saveData = async () => {
      if (tournamentData && userRole === 'admin') {
        try {
          setSaveStatus('saving');
          const success = await saveTournamentData(tournamentData, userRole);
          setSaveStatus(success ? 'saved' : 'error');
          
          // Reset status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          console.error('Failed to save tournament data:', error);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      }
    };
    
    saveData();
  }, [tournamentData, userRole]);

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('golf-active-tab', activeTab);
  }, [activeTab]);

  // Save active round to localStorage
  useEffect(() => {
    localStorage.setItem('golf-active-round', activeRound);
  }, [activeRound]);

  const updateTournamentData = (updater: (data: TournamentData) => TournamentData) => {
    setTournamentData(prev => prev ? updater(prev) : null);
  };

  if (isLoading || !tournamentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🏌️</div>
          <div className="text-xl font-semibold text-gray-700 mb-4">Loading tournament data...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  const currentRound = tournamentData.rounds.find(r => r.id === activeRound);
  if (!currentRound) {
    return <div className="min-h-screen flex items-center justify-center">Round not found</div>;
  }

  const tabs: { id: GameTab; label: string; description: string }[] = [
    { id: 'skins', label: 'Skins', description: 'Per-hole competition with net scoring' },
    { id: 'closest-pin', label: 'Closest to Pin', description: 'Par 3 accuracy contests' },
    { id: 'scramble', label: 'Scramble', description: 'Team-based best ball format' },
    { id: 'leaderboard', label: 'Payout Leaderboard', description: 'Tournament winnings summary' },
  ];

  const rounds: { id: RoundTab; label: string; day: string }[] = [
    { id: 'thursday', label: 'Thursday', day: 'Round 1' },
    { id: 'friday', label: 'Friday', day: 'Round 2' },
    { id: 'saturday', label: 'Saturday', day: 'Round 3' },
  ];

  const renderTabContent = () => {
    const isReadOnly = userRole !== 'admin';
    const updateRoundData = isReadOnly ? undefined : (updater: (round: RoundData) => RoundData) => 
      updateTournamentData(tournament => ({
        ...tournament,
        rounds: tournament.rounds.map(r => 
          r.id === activeRound ? updater(r) : r
        )
      }));

    switch (activeTab) {
      case 'skins':
        return <SkinsTab 
          roundData={currentRound} 
          updateRoundData={updateRoundData}
          isReadOnly={isReadOnly}
        />;
      case 'closest-pin':
        return <ClosestToPinTab 
          roundData={currentRound} 
          updateRoundData={updateRoundData}
          isReadOnly={isReadOnly}
        />;
      case 'scramble':
        return <ScrambleTab 
          roundData={currentRound} 
          updateRoundData={updateRoundData}
          isReadOnly={isReadOnly}
        />;
      case 'leaderboard':
        return <LeaderboardTab tournamentData={tournamentData} />;
      default:
        return <SkinsTab 
          roundData={currentRound} 
          updateRoundData={updateRoundData}
          isReadOnly={isReadOnly}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">
                  🏌️ East Coast Big Playas 2.0
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  Otsego Club, Gaylord, MI • {currentRound.day} - {
                    activeTab === 'skins' ? 'Skins' :
                    activeTab === 'closest-pin' ? 'Closest to Pin' :
                    activeTab === 'scramble' ? 'Scramble' :
                    activeTab === 'leaderboard' ? 'Payout Leaderboard' :
                    'Skins'
                  }
                </p>
              </div>

              {/* User Role & Controls */}
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Save Status - Hide text on mobile */}
                {userRole === 'admin' && (
                  <div className="flex items-center">
                    {saveStatus === 'saving' && (
                      <div className="flex items-center text-blue-600">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm ml-1 hidden sm:inline">Saving...</span>
                      </div>
                    )}
                    {saveStatus === 'saved' && (
                      <div className="flex items-center text-green-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="text-sm ml-1 hidden sm:inline">Saved</span>
                      </div>
                    )}
                    {saveStatus === 'error' && (
                      <div className="flex items-center text-red-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-sm ml-1 hidden sm:inline">Save failed</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Role Badge - Smaller on mobile */}
                <div className={`px-2 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  userRole === 'admin' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  <span className="sm:hidden">{userRole === 'admin' ? '👑' : '👀'}</span>
                  <span className="hidden sm:inline">{userRole === 'admin' ? '👑 Admin' : '👀 Viewer'}</span>
                </div>

                {/* Logout Button - Smaller on mobile */}
                <button
                  onClick={logout}
                  className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <span className="sm:hidden">Out</span>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Type Navigation (Main) */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-8 overflow-x-auto" aria-label="Game Types">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // If switching to scramble and currently on Thursday, switch to Friday
                  if (tab.id === 'scramble' && activeRound === 'thursday') {
                    setActiveRound('friday');
                  }
                }}
                className={`${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 px-3 sm:py-4 sm:px-8 border-b-2 font-medium transition-colors duration-200 rounded-t-lg min-w-0 flex-shrink-0`}
              >
                <div className="flex flex-col items-center">
                  <span className="font-bold text-sm sm:text-lg">{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Round Navigation (Secondary) - Hidden for Leaderboard */}
      {activeTab !== 'leaderboard' && (
        <div className="bg-gray-50 border-b">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
            <nav className="flex space-x-2 sm:space-x-4 py-3 overflow-x-auto" aria-label="Round tabs">
              {rounds
                .filter(round => activeTab !== 'scramble' || (round.id === 'friday' || round.id === 'saturday'))
                .map((round) => (
                <button
                  key={round.id}
                  onClick={() => setActiveRound(round.id)}
                  className={`${
                    activeRound === round.id
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300'
                  } px-3 py-2 sm:px-4 border rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 flex-shrink-0`}
                >
                  <div className="text-center">
                    <div className="font-semibold">{round.label}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Dashboard;