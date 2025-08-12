import React from 'react';
import type { Session } from "@supabase/supabase-js";
import { Button } from './ui/Button';

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/50 px-4 sm:px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center group">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mr-3 flex items-center justify-center transition-transform group-hover:scale-105">
            <img
              src="/notey.png"
              alt="Notey Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
              onError={(e) => {
                // Fallback to text logo if image fails to load
                const target = e.target as HTMLImageElement;
                target.outerHTML = '<div class="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-notey-orange to-notey-orange/80 rounded-xl shadow-sm"><span class="text-white text-lg sm:text-xl font-bold">N</span></div>';
              }}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">Notey</h1>
            <span className="text-xs text-slate-500 hidden sm:block">AI-Powered Notes</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {session ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="hidden md:block text-sm text-slate-600 max-w-32 truncate">
                {session.user.email}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="p-2 hover:bg-slate-100"
                title="Settings & Integrations"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
              <div className="w-8 h-8 bg-gradient-to-br from-notey-orange/20 to-notey-pink/20 rounded-full flex items-center justify-center border border-notey-orange/20">
                <span className="text-sm font-semibold text-notey-brown">
                  {session.user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-slate-600 hover:text-slate-900"
              >
                <span className="hidden sm:inline">Sign out</span>
                <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-1">
                <div className="w-2 h-2 bg-notey-orange rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-notey-pink rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-notey-orange rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}