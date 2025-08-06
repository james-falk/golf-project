'use client';

import React, { useState, useEffect } from 'react';
import { GameTab, RoundTab, TournamentData } from '@/types/golf';
import { loadTournamentData, saveTournamentData } from '@/utils/storage';
import SkinsTab from './tabs/SkinsTab';
import ClosestToPinTab from './tabs/ClosestToPinTab';
import ScrambleTab from './tabs/ScrambleTab';
import LeaderboardTab from './tabs/LeaderboardTab';
// import TotalWinnings from './TotalWinnings';

const Dashboard = () => {
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

  // Load data on mount
  useEffect(() => {
    const data = loadTournamentData();
    setTournamentData(data);
  }, []);

  // Save data whenever it changes
  useEffect(() => {
    if (tournamentData) {
      saveTournamentData(tournamentData);
    }
  }, [tournamentData]);

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

  if (!tournamentData) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
    switch (activeTab) {
      case 'skins':
        return <SkinsTab roundData={currentRound} updateRoundData={(updater) => 
          updateTournamentData(tournament => ({
            ...tournament,
            rounds: tournament.rounds.map(r => 
              r.id === activeRound ? updater(r) : r
            )
          }))
        } />;
      case 'closest-pin':
        return <ClosestToPinTab roundData={currentRound} updateRoundData={(updater) => 
          updateTournamentData(tournament => ({
            ...tournament,
            rounds: tournament.rounds.map(r => 
              r.id === activeRound ? updater(r) : r
            )
          }))
        } />;
      case 'scramble':
        return <ScrambleTab roundData={currentRound} updateRoundData={(updater) => 
          updateTournamentData(tournament => ({
            ...tournament,
            rounds: tournament.rounds.map(r => 
              r.id === activeRound ? updater(r) : r
            )
          }))
        } />;
      case 'leaderboard':
        return <LeaderboardTab tournamentData={tournamentData} />;
      default:
        return <SkinsTab roundData={currentRound} updateRoundData={(updater) => 
          updateTournamentData(tournament => ({
            ...tournament,
            rounds: tournament.rounds.map(r => 
              r.id === activeRound ? updater(r) : r
            )
          }))
        } />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  🏌️ East Coast Big Playas 2.0
                </h1>
                <p className="text-gray-600">
                  Otsego Club, Gaylord, MI • {currentRound.day} - {
                    activeTab === 'skins' ? 'Skins' :
                    activeTab === 'closest-pin' ? 'Closest to Pin' :
                    activeTab === 'scramble' ? 'Scramble' :
                    activeTab === 'leaderboard' ? 'Payout Leaderboard' :
                    'Skins'
                  }
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Game Type Navigation (Main) */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Game Types">
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
                } whitespace-nowrap py-4 px-8 border-b-2 font-medium transition-colors duration-200 rounded-t-lg`}
              >
                <div className="flex flex-col items-center">
                  <span className="font-bold text-lg">{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Round Navigation (Secondary) - Hidden for Leaderboard */}
      {activeTab !== 'leaderboard' && (
        <div className="bg-gray-50 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-4 py-3" aria-label="Round tabs">
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
                  } px-4 py-2 border rounded-lg font-medium text-sm transition-colors duration-200`}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Dashboard;