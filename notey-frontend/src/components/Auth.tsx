import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import TermsAndConditions from "./TermsAndConditions";
import PrivacyPolicy from "./PrivacyPolicy";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardHeader, CardContent } from "./ui/Card";

interface AuthProps {
  session: Session | null;
  setSession: (session: Session | null) => void;
}

export default function Auth({ session }: AuthProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const signIn = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the Terms and Conditions to continue");
      return;
    }

    if (!acceptedPrivacy) {
      setError("Please accept the Privacy Policy to continue");
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
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };



  if (!session) {
    return (
      <Card className="max-w-md mx-auto shadow-xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-notey-orange to-notey-pink rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Notey</h2>
          <p className="text-slate-600">Sign in to start recording and organizing your audio notes with AI</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Input
            type="email"
            label="Email address"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error && !message ? error : undefined}
            helperText="We'll send you a secure login link"
          />
          
          {/* Success message */}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          {/* Terms and Conditions Checkbox */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="terms-checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-notey-orange border-gray-300 rounded focus:ring-notey-orange"
              />
              <div className="text-sm text-slate-600">
                <label htmlFor="terms-checkbox" className="cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="text-notey-orange hover:underline font-medium"
                  >
                    Terms and Conditions
                  </button>
                </label>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="privacy-checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-notey-orange border-gray-300 rounded focus:ring-notey-orange"
              />
              <div className="text-sm text-slate-600">
                <label htmlFor="privacy-checkbox" className="cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacy(true)}
                    className="text-notey-orange hover:underline font-medium"
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>
            </div>
          </div>
          
          <Button
            onClick={signIn}
            disabled={isLoading || !email.trim() || !acceptedTerms || !acceptedPrivacy}
            isLoading={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Sending magic link..." : "Continue with Email"}
          </Button>
        </CardContent>
        
        {/* Terms and Conditions Modal */}
        <TermsAndConditions 
          isOpen={showTerms} 
          onClose={() => setShowTerms(false)} 
        />
        
        {/* Privacy Policy Modal */}
        <PrivacyPolicy 
          isOpen={showPrivacy} 
          onClose={() => setShowPrivacy(false)} 
        />
      </Card>
    );
  }

  // For authenticated users, we don't render anything here since user info is in navbar
  return null;
}
