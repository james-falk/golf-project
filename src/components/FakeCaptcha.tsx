'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { loadTournamentData } from '@/utils/storage';

interface FakeCaptchaProps {
  onComplete: (preloadedData?: unknown) => void;
}

const FakeCaptcha: React.FC<FakeCaptchaProps> = ({ onComplete }) => {
  const [selectedSquares, setSelectedSquares] = useState<Set<number>>(new Set());
  const [stage, setStage] = useState<'daryls' | 'larrys' | 'static'>('daryls');
  const [isHumanChecked, setIsHumanChecked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);
  const [preloadedData, setPreloadedData] = useState<unknown>(null);

  // Real Daryl and Larry images
  const darylImages = [
    '/daryl-1.png', '/daryl-2.png', '/daryl-3.png', '/darly-4.png', '/daryl-5.png', '/daryl-6.png', '/daryl-7.jpeg', '/daryl-8.png', '/daryl-9.png'
  ];
  
  const larryImages = [
    '/larry-1.png', '/larry-2.png', '/larry-3.png', '/larry-4.jpeg', '/larry-5.png', '/larry-6.png', '/larry-7.png', '🤗', '😌'
  ];

  const currentImages = stage === 'daryls' ? darylImages : larryImages;
  const currentText = stage === 'daryls' ? 'Select all the Daryls you see' : 'Select all the Larrys you see';

  // Timer for static effect and preload data
  useEffect(() => {
    if (stage === 'static' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (stage === 'static' && timeLeft === 0) {
      onComplete(preloadedData);
    }
  }, [timeLeft, stage, onComplete, preloadedData]);

  // Start preloading data when countdown begins
  useEffect(() => {
    if (stage === 'static' && !preloadedData) {
      const preloadData = async () => {
        try {
          const data = await loadTournamentData();
          setPreloadedData(data);
        } catch (error) {
          console.error('Failed to preload tournament data:', error);
        }
      };
      preloadData();
    }
  }, [stage, preloadedData]);

  const toggleSquare = (id: number) => {
    const newSelected = new Set(selectedSquares);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSquares(newSelected);
  };

  const handleVerify = () => {
    if (stage === 'daryls') {
      // Move to Larry stage
      setStage('larrys');
      setSelectedSquares(new Set()); // Clear selections
    } else if (stage === 'larrys') {
      // Move to static effect
      setStage('static');
    }
  };

  // Movie projector countdown with big popping numbers
  if (stage === 'static') {
    const isExploding = timeLeft === 0;
    
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
        {/* Film grain and scratches */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(circle at 10% 20%, rgba(255,255,255,0.1) 1px, transparent 1px),
              radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 1px, transparent 1px),
              radial-gradient(circle at 40% 40%, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, transparent 98%, rgba(255,255,255,0.03) 100%),
              #000
            `,
            backgroundSize: '50px 50px, 80px 80px, 30px 30px, 200px 100%',
            animation: 'filmGrain 0.2s infinite linear'
          }}
        />
        
        {/* Projector light beam effect */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)',
            animation: 'flicker 0.1s infinite alternate'
          }}
        />
        
        {/* Main countdown display */}
        <div className="relative z-10 text-center">
          {!isExploding ? (
            <>
              {/* Film countdown circle */}
              <div className="relative w-80 h-80 mx-auto mb-8">
                {/* Outer film reel circle */}
                <div 
                  className="absolute inset-0 border-8 border-white rounded-full opacity-80"
                  style={{
                    background: 'radial-gradient(circle, transparent 60%, rgba(255,255,255,0.1) 70%, transparent 80%)'
                  }}
                />
                
                {/* Inner circle with crosshairs */}
                <div className="absolute inset-8 border-2 border-white rounded-full opacity-60">
                  {/* Crosshairs */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white transform -translate-y-0.5"></div>
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white transform -translate-x-0.5"></div>
                </div>
                
                {/* Big popping number in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    key={timeLeft}
                    className="text-white font-bold"
                    style={{
                      fontSize: '12rem',
                      textShadow: `
                        0 0 20px rgba(255,255,255,0.8),
                        0 0 40px rgba(255,255,255,0.6),
                        0 0 60px rgba(255,255,255,0.4)
                      `,
                      animation: 'popAndFade 1s ease-out forwards',
                      fontFamily: 'serif'
                    }}
                  >
                    {timeLeft}
                  </div>
                </div>
                
                {/* Rotating tick marks around the circle */}
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-8 bg-white origin-bottom"
                    style={{
                      top: '10px',
                      left: '50%',
                      transform: `translateX(-50%) rotate(${i * 30}deg)`,
                      transformOrigin: '50% 140px'
                    }}
                  />
                ))}
              </div>
              

            </>
          ) : (
            /* Bomb explosion effect */
            <div className="relative">
              <div 
                className="text-9xl"
                style={{
                  animation: 'bombExplode 1s ease-out forwards'
                }}
              >
                💥💥💥
              </div>
              <div className="absolute inset-0 text-8xl animate-ping">
                🔥
              </div>
              <div className="absolute inset-0 text-6xl animate-spin">
                💥⚡💥⚡💥
              </div>
              <div className="absolute inset-0 text-4xl animate-bounce">
                🌪️💨🌪️💨🌪️
              </div>
              <div className="mt-8 text-red-500 text-4xl font-bold animate-pulse font-mono">
                💣 BOOM! 💣
              </div>
              <div className="mt-2 text-yellow-300 text-xl font-bold animate-bounce">
                ACCESS GRANTED
              </div>
            </div>
          )}
        </div>
        
        <style jsx>{`
          @keyframes filmGrain {
            0%, 100% { transform: translateX(0) translateY(0); }
            10% { transform: translateX(-1px) translateY(-1px); }
            20% { transform: translateX(1px) translateY(1px); }
            30% { transform: translateX(-1px) translateY(1px); }
            40% { transform: translateX(1px) translateY(-1px); }
            50% { transform: translateX(-1px) translateY(-1px); }
            60% { transform: translateX(1px) translateY(1px); }
            70% { transform: translateX(-1px) translateY(1px); }
            80% { transform: translateX(1px) translateY(-1px); }
            90% { transform: translateX(-1px) translateY(-1px); }
          }
          
          @keyframes flicker {
            0% { opacity: 0.18; }
            100% { opacity: 0.22; }
          }
          
          @keyframes popAndFade {
            0% { 
              transform: scale(1); 
              opacity: 1; 
            }
            20% { 
              transform: scale(1.5); 
              opacity: 1; 
            }
            40% { 
              transform: scale(2); 
              opacity: 0.9; 
            }
            60% { 
              transform: scale(3); 
              opacity: 0.7; 
            }
            80% { 
              transform: scale(4); 
              opacity: 0.4; 
            }
            100% { 
              transform: scale(5); 
              opacity: 0; 
            }
          }
          
          @keyframes bombExplode {
            0% { 
              transform: scale(1); 
              opacity: 1; 
            }
            20% { 
              transform: scale(2); 
              opacity: 1; 
            }
            40% { 
              transform: scale(4); 
              opacity: 0.9; 
            }
            60% { 
              transform: scale(6); 
              opacity: 0.7; 
            }
            80% { 
              transform: scale(8); 
              opacity: 0.4; 
            }
            100% { 
              transform: scale(10); 
              opacity: 0; 
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{currentText}</h1>
          <p className="text-sm text-gray-500">If there are none, click verify</p>
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {currentImages.map((item, index) => (
            <div
              key={index}
              onClick={() => toggleSquare(index)}
              className={`
                aspect-square cursor-pointer border-2 rounded transition-all flex items-center justify-center bg-gray-100 overflow-hidden
                ${selectedSquares.has(index) 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
            >
              <div className="relative w-full h-full flex items-center justify-center p-2">
                {item.startsWith('/') ? (
                  // Display image file - smaller and contained
                  <Image 
                    src={item} 
                    alt={`Image ${index + 1}`}
                    width={120}
                    height={120}
                    className="max-w-full max-h-full object-contain rounded"
                    draggable={false}
                  />
                ) : (
                  // Display emoji
                  <span className="text-4xl">{item}</span>
                )}
                {selectedSquares.has(index) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-30 rounded">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Checkbox (only on first stage) */}
        {stage === 'daryls' && (
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isHumanChecked}
                onChange={(e) => setIsHumanChecked(e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">I'm not a robot</span>
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center">
          <button 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Skip
          </button>
          <div className="flex items-center text-xs text-gray-500">
            <div className="w-4 h-4 mr-1">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            reCAPTCHA
          </div>
          <button 
            onClick={handleVerify}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  );
};

export default FakeCaptcha;