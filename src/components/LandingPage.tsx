'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import FakeCaptcha from './FakeCaptcha';

interface LandingPageProps {
  onCodeSubmit: (code: string, role: 'admin' | 'viewer', preloadedData?: unknown) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onCodeSubmit }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingRole, setPendingRole] = useState<'admin' | 'viewer' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Simple code validation - you can modify these codes as needed
    const ADMIN_CODE = 'MANGOS';
    const VIEWER_CODE = 'OTSEGO';

    // Remove spaces and convert to uppercase for comparison
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();

    if (cleanCode === ADMIN_CODE) {
      // Admin goes straight to dashboard - no CAPTCHA
      onCodeSubmit(code, 'admin');
    } else if (cleanCode === VIEWER_CODE) {
      // Users go through CAPTCHA flow
      setPendingRole('viewer');
      setShowCaptcha(true);
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  const handleCaptchaComplete = (preloadedData?: unknown) => {
    if (pendingRole) {
      onCodeSubmit(code, pendingRole, preloadedData);
    }
  };

  return (
    <>
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
              <Image 
                src="/landing-page-image.png" 
                alt="Golf Tournament Logo" 
                width={160}
                height={160}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-lg font-mono tracking-widest uppercase text-black placeholder-gray-400"
                placeholder="Enter code"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            {code.trim() && (
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
              >
                Come On In Big Boy
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
    
    {showCaptcha && (
      <FakeCaptcha onComplete={handleCaptchaComplete} />
    )}
  </>
  );
};

export default LandingPage;