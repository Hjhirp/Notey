import React from 'react';
import type { Session } from "@supabase/supabase-js";

interface NavbarProps {
  session?: Session | null;
  setSession?: (session: Session | null) => void;
  onOpenSettings?: () => void;
}

export default function Navbar({ session, setSession, onOpenSettings }: NavbarProps) {
  const handleSignOut = async () => {
    if (setSession) {
      setSession(null);
    }
  };

  // Debug: Check if logo file is accessible
  React.useEffect(() => {
    fetch('/notey-small.png')
      .then(response => {
        if (response.ok) {
        } else {
        }
      })
      .catch(error => {
      });
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center">
          <div className="w-12 h-12 mr-3 flex items-center justify-center">
            <img
              src="/notey.png"
              alt="Notey Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                // Fallback to text logo if image fails to load
                const target = e.target as HTMLImageElement;
                target.outerHTML = '<div class="flex items-center justify-center w-12 h-12 bg-notey-orange rounded-lg"><span class="text-white text-xl font-bold">N</span></div>';
              }}
            />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Notey</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {session ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-sm text-slate-600">
                {session.user.email}
              </div>
              <button
                onClick={onOpenSettings}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Settings & Integrations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-notey-orange/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-notey-orange">
                  {session.user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-2 h-2 bg-notey-orange rounded-full"></div>
              <div className="w-2 h-2 bg-notey-pink rounded-full"></div>
              <div className="w-2 h-2 bg-notey-orange rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}