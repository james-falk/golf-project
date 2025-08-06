'use client';

import React, { useState } from 'react';

interface LandingPageProps {
  onCodeSubmit: (code: string, role: 'admin' | 'viewer') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onCodeSubmit }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simple code validation - you can modify these codes as needed
    const ADMIN_CODE = 'ADMIN';
    const VIEWER_CODE = 'USER';

    if (code.toUpperCase() === ADMIN_CODE) {
      onCodeSubmit(code, 'admin');
    } else if (code.toUpperCase() === VIEWER_CODE) {
      onCodeSubmit(code, 'viewer');
    } else {
      setError('Invalid access code. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url("/hills-background.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <img 
                src="/landing-page-image.png" 
                alt="Golf Tournament Logo" 
                className="w-40 h-40 mx-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              East Coast Big Playas 2.0
            </h1>
            <p className="text-gray-600">
              Otsego Club, Gaylord, MI
            </p>
          </div>

          {/* Access Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-900 mb-2">
                Access Code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-lg font-mono tracking-widest uppercase placeholder-black"
                placeholder="Enter code"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Come On In Big Boy'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;