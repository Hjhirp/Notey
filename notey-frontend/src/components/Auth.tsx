import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface AuthProps {
  session: Session | null;
  setSession: (session: Session | null) => void;
}

export default function Auth({ session, setSession: _ }: AuthProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const signIn = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for a login link! 📧");
        setEmail(""); // Clear email on success
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };



  if (!session) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Get started with Notey</h2>
          <p className="text-slate-600">Sign in to start recording and organizing your audio notes</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-500 text-base
                         focus:outline-none focus:ring-2 focus:ring-notey-orange focus:border-transparent
                         transition-all duration-200"
            />
          </div>
          
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          {/* Success message */}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              {message}
            </div>
          )}
          
          <button
            onClick={signIn}
            disabled={isLoading || !email.trim()}
            className="w-full bg-notey-orange text-white font-semibold py-3 px-6 rounded-xl text-base
                       hover:bg-notey-orange/90 focus:outline-none focus:ring-2 focus:ring-notey-orange focus:ring-offset-2
                       transition-all duration-200 shadow-sm min-h-[48px] touch-manipulation
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending magic link...
              </>
            ) : (
              "Continue with Email"
            )}
          </button>
        </div>
      </div>
    );
  }

  // For authenticated users, we don't render anything here since user info is in navbar
  return null;
}
