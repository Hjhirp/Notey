import React from 'react';
import type { Session } from "@supabase/supabase-js";

interface NavbarProps {
  session?: Session | null;
  setSession?: (session: Session | null) => void;
}

export default function Navbar({ session, setSession }: NavbarProps) {
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