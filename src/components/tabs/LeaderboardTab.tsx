'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Player, RoundData, TournamentData } from '@/types/golf';
import { calculatePlayerScrambleWinnings } from '@/utils/scrambleUtils';
import { jsPDF } from 'jspdf';

interface LeaderboardTabProps {
  tournamentData: TournamentData;
}

type PayoutTab = 'thursday' | 'friday' | 'saturday' | 'total';

const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ tournamentData }) => {
  const [activePayoutTab, setActivePayoutTab] = useState<PayoutTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golf-active-payout-tab');
      if (saved && ['thursday', 'friday', 'saturday', 'total'].includes(saved)) {
        return saved as PayoutTab;
      }
    }
    return 'total';
  });
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Save active payout tab to localStorage
  useEffect(() => {
    localStorage.setItem('golf-active-payout-tab', activePayoutTab);
  }, [activePayoutTab]);

  // Calculate winnings for a specific player on a specific round
  const calculatePlayerRoundWinnings = (playerId: string, round: RoundData) => {
    let roundWinnings = 0;

    // Skins winnings
    const skinsWinnings = round.skinsGame.skinResults
      .filter(skin => skin.winner === playerId)
      .reduce((sum, skin) => sum + skin.pot, 0);
    roundWinnings += skinsWinnings;

    // Closest to Pin winnings ($20 per win)
    const ctpWinnings = round.closestToPinGame.holes
      .filter(hole => hole.winner === playerId).length * 20;
    roundWinnings += ctpWinnings;

    // Scramble winnings - per-player payout based on team size
    const scrambleWinnings = calculatePlayerScrambleWinnings(playerId, round);
    roundWinnings += scrambleWinnings;

    return roundWinnings;
  };

  // Calculate total winnings for each player across all rounds
  const calculatePlayerTotalWinnings = (playerId: string) => {
    return tournamentData.rounds.reduce((total, round) => {
      return total + calculatePlayerRoundWinnings(playerId, round);
    }, 0);
  };

  // Get all unique players from all rounds
  const getAllPlayers = (): Player[] => {
    const playersMap = new Map<string, Player>();
    
    tournamentData.rounds.forEach(round => {
      // Add players from skins game
      round.skinsGame.players.forEach(player => {
        playersMap.set(player.id, player);
      });
      
      // Add players from closest to pin game
      round.closestToPinGame.players.forEach(player => {
        playersMap.set(player.id, player);
      });
    });

    return Array.from(playersMap.values());
  };

  const allPlayers = getAllPlayers();

  // Export to PDF function
  const exportToPDF = async () => {
    console.log('Starting PDF export...');
    
    setIsExporting(true);
    
    try {
      const currentData = getCurrentData();
      if (!currentData) {
        throw new Error('Current data is null');
      }

      console.log('Creating PDF with jsPDF...');
      const pdf = new jsPDF('p', 'mm', 'letter');
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(currentData.title, margin, 30);
      
      // Add subtitle
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('East Coast Big Playas 2.0 • Otsego Club, Gaylord, MI', margin, 40);
      pdf.text(`Generated ${new Date().toLocaleDateString()}`, margin, 48);
      
      // Table setup
      let yPosition = 65;
      const rowHeight = 12;
      
      // Determine if this round has scramble (all rounds can have scramble)
      const hasScramble = true; // All rounds can have scramble winnings
      const colWidths = hasScramble ? [75, 25, 25, 25, 25] : [100, 37.5, 37.5, 0]; // Adjust widths based on columns
      
      // Draw table header
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 8, contentWidth, rowHeight, 'F');
      
      let xPosition = margin;
      const headers = hasScramble ? ['Player', 'Skins', 'CTP', 'Scramble', 'Total'] : ['Player', 'Skins', 'CTP', 'Total'];
      headers.forEach((header, index) => {
        if (index === 0) {
          pdf.text(header, xPosition + 5, yPosition);
        } else {
          pdf.text(header, xPosition + colWidths[index] - 5, yPosition, { align: 'right' });
        }
        xPosition += colWidths[index];
      });
      
      yPosition += rowHeight + 5;
      
      // Draw table rows
      pdf.setFont('helvetica', 'normal');
      currentData.leaderboard.forEach((player, index) => {
        // Calculate individual game winnings for the selected period
        let skinsTotal = 0;
        let ctpTotal = 0;
        let scrambleTotal = 0;

        currentData.rounds.forEach(round => {
          // Skins
          skinsTotal += round.skinsGame.skinResults
            .filter(skin => skin.winner === player.id)
            .reduce((sum, skin) => sum + skin.pot, 0);
          
          // Closest to Pin
          ctpTotal += round.closestToPinGame.holes
            .filter(hole => hole.winner === player.id).length * 20;
          
          // Scramble - use the utility function
          scrambleTotal += calculatePlayerScrambleWinnings(player.id, round);
        });

        const totalWinnings = skinsTotal + ctpTotal + scrambleTotal;
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPosition - 8, contentWidth, rowHeight, 'F');
        }
        
        xPosition = margin;
        
        // Player name (with rank)
        pdf.setFont('helvetica', 'bold');
        pdf.text(`#${index + 1} ${player.name}`, xPosition + 5, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`${player.group} Player`, xPosition + 5, yPosition + 4);
        pdf.setFontSize(11);
        xPosition += colWidths[0];
        
        // Amounts
        const amounts = hasScramble 
          ? [`$${skinsTotal}`, `$${ctpTotal}`, `$${scrambleTotal}`, `$${totalWinnings}`]
          : [`$${skinsTotal}`, `$${ctpTotal}`, `$${totalWinnings}`];
        
        amounts.forEach((amount, amountIndex) => {
          const isTotal = (hasScramble && amountIndex === 3) || (!hasScramble && amountIndex === 2);
          if (isTotal) { // Total column
            pdf.setFont('helvetica', 'bold');
          }
          pdf.text(amount, xPosition + colWidths[amountIndex + 1] - 5, yPosition, { align: 'right' });
          if (isTotal) {
            pdf.setFont('helvetica', 'normal');
          }
          xPosition += colWidths[amountIndex + 1];
        });
        
        yPosition += rowHeight + 2;
        
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 30;
        }
      });
      
      // Add total payout at bottom
      yPosition += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total Payout: $${currentData.totalPayout}`, margin, yPosition);
      
      console.log('Saving PDF...');
      
      // Generate filename based on active tab
      let fileName = '';
      switch (activePayoutTab) {
        case 'thursday':
          fileName = 'Thursday_Results.pdf';
          break;
        case 'friday':
          fileName = 'Friday_Results.pdf';
          break;
        case 'saturday':
          fileName = 'Saturday_Results.pdf';
          break;
        case 'total':
          fileName = 'TotalResults.pdf';
          break;
        default:
          fileName = 'GolfResults.pdf';
      }
      
      pdf.save(fileName);
      
      console.log('PDF export completed successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      alert(`Error generating PDF: ${errorMessage}. Please check the console for details.`);
    } finally {
      setIsExporting(false);
    }
  };

  // Get hardcoded prize pool amounts
  const getPrizePool = (tab: PayoutTab): number => {
    switch (tab) {
      case 'thursday': return 360;
      case 'friday': return 720;
      case 'saturday': return 720;
      case 'total': return 1800;
      default: return 0;
    }
  };

  // Get the current data based on active tab
  const getCurrentData = () => {
    if (activePayoutTab === 'total') {
      // Total across all rounds
      const leaderboard = allPlayers.map(player => ({
        ...player,
        totalWinnings: calculatePlayerTotalWinnings(player.id)
      })).sort((a, b) => b.totalWinnings - a.totalWinnings);

      const totalPayout = getPrizePool('total'); // Use hardcoded amount

      return {
        leaderboard,
        totalPayout,
        title: 'Total Tournament Payout',
        rounds: tournamentData.rounds
      };
    } else {
      // Single day
      const round = tournamentData.rounds.find(r => r.id === activePayoutTab);
      if (!round) return null;

      const leaderboard = allPlayers.map(player => ({
        ...player,
        totalWinnings: calculatePlayerRoundWinnings(player.id, round)
      })).sort((a, b) => b.totalWinnings - a.totalWinnings);

      const totalPayout = getPrizePool(activePayoutTab); // Use hardcoded amount

      return {
        leaderboard,
        totalPayout,
        title: round.name,
        rounds: [round]
      };
    }
  };

  const currentData = getCurrentData();
  if (!currentData) return <div>Round not found</div>;

  const payoutTabs = [
    { id: 'thursday' as PayoutTab, label: 'Thursday' },
    { id: 'friday' as PayoutTab, label: 'Friday' },
    { id: 'saturday' as PayoutTab, label: 'Saturday' },
    { id: 'total' as PayoutTab, label: 'Total' },
  ];

  return (
    <div className="space-y-8">
      {/* Tournament Summary */}
      <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200 rounded-lg p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🏆 Tournament Payout Leaderboard</h2>
          <p className="text-lg text-gray-700">
            {activePayoutTab === 'thursday' ? 'Thursday' :
             activePayoutTab === 'friday' ? 'Friday' :
             activePayoutTab === 'saturday' ? 'Saturday' :
             'Total'} Prize Pool: <span className="font-bold text-green-600">${currentData.totalPayout}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Combined winnings from Skins, Closest to Pin, and Scramble competitions
          </p>
        </div>
      </div>

      {/* Payout Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-3 sm:px-6 space-y-4 sm:space-y-0">
              <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto w-full sm:w-auto" aria-label="Payout tabs">
                {payoutTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePayoutTab(tab.id)}
                    className={`${
                      activePayoutTab === tab.id
                        ? 'border-green-500 text-green-600 bg-green-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 flex-shrink-0`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 w-full sm:w-auto justify-center"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-6" ref={contentRef}>
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900">{currentData.title}</h3>
            <p className="text-sm text-gray-600 mt-1">
              East Coast Big Playas 2.0 • Otsego Club, Gaylord, MI • Generated {new Date().toLocaleDateString()}
            </p>
          </div>
          
          {/* Leaderboard */}
          <div className="space-y-3 mb-8">
            {currentData.leaderboard.map((player, index) => (
              <div key={player.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 ${
                index === 0 && player.totalWinnings > 0
                  ? 'border-yellow-300 bg-yellow-50' // First place
                  : index === 1 && player.totalWinnings > 0
                  ? 'border-gray-300 bg-gray-50' // Second place
                  : index === 2 && player.totalWinnings > 0
                  ? 'border-orange-300 bg-orange-50' // Third place
                  : 'border-gray-200 bg-white' // Everyone else
              }`}>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className={`text-lg sm:text-2xl font-bold ${
                    index === 0 && player.totalWinnings > 0 ? 'text-yellow-600' :
                    index === 1 && player.totalWinnings > 0 ? 'text-gray-600' :
                    index === 2 && player.totalWinnings > 0 ? 'text-orange-600' :
                    'text-gray-400'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-base sm:text-lg text-gray-900">{player.name}</div>
                                            <div className="text-xs sm:text-sm text-gray-600">{player.group} Player</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg sm:text-2xl font-bold ${
                    player.totalWinnings > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    ${player.totalWinnings}
                  </div>
                  {index === 0 && player.totalWinnings > 0 && (
                    <div className="text-xs sm:text-sm text-yellow-600 font-medium">👑 Champion</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown by Game Type */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Winnings Breakdown</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Player</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Skins</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Closest to Pin</th>
                    {(activePayoutTab === 'friday' || activePayoutTab === 'saturday' || activePayoutTab === 'total') && (
                      <th className="text-right py-3 px-4 font-semibold text-gray-900">Scramble</th>
                    )}
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 border-l border-gray-200">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.leaderboard.map((player) => {
                    // Calculate individual game winnings for the selected period
                    let skinsTotal = 0;
                    let ctpTotal = 0;
                    const scrambleTotal = 0;

                    currentData.rounds.forEach(round => {
                      // Skins
                      skinsTotal += round.skinsGame.skinResults
                        .filter(skin => skin.winner === player.id)
                        .reduce((sum, skin) => sum + skin.pot, 0);
                      
                      // Closest to Pin
                      ctpTotal += round.closestToPinGame.holes
                        .filter(hole => hole.winner === player.id).length * 20;
                      
                      // Scramble (TODO: implement when scramble structure is ready)
                    });

                    return (
                      <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{player.name}</td>
                        <td className="py-3 px-4 text-right text-gray-700">${skinsTotal}</td>
                        <td className="py-3 px-4 text-right text-gray-700">${ctpTotal}</td>
                        {(activePayoutTab === 'friday' || activePayoutTab === 'saturday' || activePayoutTab === 'total') && (
                          <td className="py-3 px-4 text-right text-gray-700">${scrambleTotal}</td>
                        )}
                        <td className="py-3 px-4 text-right font-bold text-green-600 border-l border-gray-200">
                          ${player.totalWinnings}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTab;