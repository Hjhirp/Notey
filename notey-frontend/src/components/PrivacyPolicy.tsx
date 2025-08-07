import { useState } from 'react';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-notey-orange focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-2xl font-semibold leading-6 text-gray-900 mb-6">
                Privacy Policy
              </h3>
              
              <div className="mt-2 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Effective Date:</strong> August 7, 2025<br />
                  <strong>App Name:</strong> Notey<br />
                  <strong>Maintained By:</strong> Individual Developer (Harshal Hirpara)
                </p>

                <p className="text-gray-700 mb-4">
                  Thank you for using Notey – a personal project designed to help users record, transcribe, and replay their event memories with audio, transcripts, and photos. This Privacy Policy outlines how your data is handled and your responsibilities as a user.
                </p>

                <p className="text-gray-700 mb-6">
                  If you have any questions, contact me at:{' '}
                  <a href="mailto:hirparaharshal.57@gmail.com" className="text-notey-orange hover:underline">
                    hirparaharshal.57@gmail.com
                  </a>
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">1. What This Policy Covers</h4>
                <p className="text-gray-700 mb-4">
                  This policy covers how Notey collects, stores, and uses your data while you use the app. 
                  Notey is not owned or operated by a company – it is a personal project maintained by an individual.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h4>
                <p className="text-gray-700 mb-2">We collect the following:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Email address (for login/authentication)</li>
                  <li>Audio recordings you choose to upload</li>
                  <li>Photos (including optional selfies or personal images)</li>
                  <li>Transcripts & Summaries generated from your audio</li>
                  <li>Metadata (timestamps, event titles, tags)</li>
                </ul>
                <p className="text-gray-700 mb-4">We do not collect sensitive data unless you choose to upload it voluntarily.</p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Data</h4>
                <p className="text-gray-700 mb-2">We use your data to:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Enable replay and memory features</li>
                  <li>Generate AI-based transcripts and summaries</li>
                  <li>Associate photos and timestamps for easy navigation</li>
                  <li>Improve app reliability and security</li>
                </ul>
                <p className="text-gray-700 mb-4">
                  We do not share, sell, or rent your data for commercial gain. We do not use your data for advertising.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">4. Your Consent</h4>
                <p className="text-gray-700 mb-4">
                  By creating an account and using Notey, you voluntarily agree to this Privacy Policy and consent to the collection, use, and storage of your information as described herein. You may withdraw your consent at any time by deleting your account.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">5. Data Security & Storage</h4>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Your data is stored securely using Supabase (database + storage).</li>
                  <li>We implement reasonable security measures to protect your data, including access-restricted cloud storage and encryption where possible.</li>
                  <li>Transcripts are generated via trusted third-party models (e.g., Whisper, Gemini). Per their respective API policies, your data is not stored by them or used to train their models.</li>
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">6. Responsibility for Uploaded Content</h4>
                <p className="text-gray-700 mb-2">You are solely responsible for the content you upload.</p>
                <p className="text-gray-700 mb-2">If you choose to upload personally identifiable information (PII) — such as:</p>
                <ul className="list-disc pl-5 mb-2 text-gray-700">
                  <li>A photo of yourself or others</li>
                  <li>A voice recording containing names, company info, or sensitive speech</li>
                </ul>
                <p className="text-gray-700 mb-2">You acknowledge and agree that:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>You do so voluntarily and at your own risk</li>
                  <li>You are responsible for obtaining consent from others in recordings or photos</li>
                  <li>I, the developer, am not responsible for any direct or indirect consequences of uploading this content</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ If you do not want personal content in the app, do not upload it.
                  </p>
                </div>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h4>
                <p className="text-gray-700 mb-2">You may:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Request access to your data</li>
                  <li>Request deletion of all your data</li>
                  <li>Stop using the app at any time</li>
                </ul>
                <p className="text-gray-700 mb-4">
                  To make any request, email me at:{' '}
                  <a href="mailto:hirparaharshal.57@gmail.com" className="text-notey-orange hover:underline">
                    hirparaharshal.57@gmail.com
                  </a>
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">8. Data Retention</h4>
                <p className="text-gray-700 mb-4">
                  Your data is retained while your account is active. If you delete your account or request deletion, associated media and metadata will be permanently removed from the platform within 30 days.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">9. Children's Privacy</h4>
                <p className="text-gray-700 mb-4">
                  Notey is not intended for or directed at children under the age of 13. We do not knowingly collect personal information from children. If we learn that we have inadvertently collected information from a child under 13, we will take steps to promptly delete it.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h4>
                <p className="text-gray-700 mb-4">
                  I may update this policy occasionally. Should significant changes occur, you will be notified via an in-app notification at least 15 days before the new policy takes effect, giving you time to review the changes. Continued use of the app after this period constitutes your acceptance of the updated policy.
                </p>

                <p className="text-sm text-gray-500 mt-6 border-t pt-4">
                  Last updated: August 7, 2025<br />
                  <em>Disclaimer: This Privacy Policy is provided for informational purposes and is not a substitute for legal advice.</em>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-notey-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-notey-orange/90 sm:ml-3 sm:w-auto"
              onClick={onClose}
            >
              I Understand
            </button>
            <a
              href="/Privacy Policy.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyLink() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-gray-500 hover:text-gray-700 text-sm"
      >
        Privacy Policy
      </button>
      <PrivacyPolicy isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}