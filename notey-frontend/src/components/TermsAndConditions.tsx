import { useState } from 'react';

interface TermsAndConditionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsAndConditions({ isOpen, onClose }: TermsAndConditionsProps) {
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
                Terms and Conditions
              </h3>
              
              <div className="mt-2 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Effective Date:</strong> August 7, 2025<br />
                  <strong>App Name:</strong> Notey<br />
                  <strong>Maintained By:</strong> Harshal Hirpara (Individual Developer)
                </p>

                <p className="text-gray-700 mb-4">
                  These Terms and Conditions ("Terms") govern your use of Notey, a personal project designed to help users record, replay, and remember live events. By using Notey, you agree to these Terms.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">1. User Agreement</h4>
                <p className="text-gray-700 mb-4">By accessing or using Notey, you confirm that:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>You are at least 13 years old.</li>
                  <li>You are legally able to consent to use online services.</li>
                  <li>You understand this is an independent project, not operated by a company.</li>
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">2. Acceptable Use</h4>
                <p className="text-gray-700 mb-2">You agree not to:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Upload or share illegal, harmful, or abusive content.</li>
                  <li>Violate the privacy of others (e.g., recording without consent).</li>
                  <li>Interfere with app operations or security.</li>
                  <li>Attempt to reverse-engineer or hack the application.</li>
                </ul>
                <p className="text-gray-700 mb-4">You are responsible for everything you upload.</p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">3. Intellectual Property</h4>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>All app code, architecture, and features are the intellectual property of the developer (Harshal Hirpara).</li>
                  <li>You retain full ownership of the content you upload (audio, photos, transcripts).</li>
                  <li>You grant me a limited license to process and display your uploaded content strictly within the app for its intended features.</li>
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">4. Privacy and User Content</h4>
                <p className="text-gray-700 mb-2">You are solely responsible for any PII (personally identifiable information) you upload, including:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Selfies or photos of yourself or others.</li>
                  <li>Audio containing your name, employer, or sensitive speech.</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ You acknowledge that uploading such content is voluntary and that I, the developer, am not liable for any consequences resulting from it.
                  </p>
                  <p className="text-yellow-800 text-sm mt-1">
                    If you do not want to share personal content, do not upload it.
                  </p>
                </div>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">5. Limitation of Liability</h4>
                <p className="text-gray-700 mb-2">The app is provided "as is", without warranties of any kind.</p>
                <p className="text-gray-700 mb-2">I do not guarantee that the app will be:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Free of bugs or outages.</li>
                  <li>Fully secure from data loss.</li>
                  <li>Legally compliant in every country.</li>
                </ul>
                <p className="text-gray-700 mb-4">
                  To the maximum extent permitted by law, you agree not to hold me liable for any direct, indirect, or incidental damages arising from your use of the app.
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">6. Termination</h4>
                <p className="text-gray-700 mb-2">I reserve the right to:</p>
                <ul className="list-disc pl-5 mb-4 text-gray-700">
                  <li>Remove content that violates these terms.</li>
                  <li>Suspend or delete accounts for abuse.</li>
                  <li>Modify or discontinue the service at any time.</li>
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">7. Contact</h4>
                <p className="text-gray-700 mb-4">
                  This app is a personal project maintained by Harshal Hirpara.<br />
                  For any questions or concerns, email me at:{' '}
                  <a href="mailto:hirparaharshal.57@gmail.com" className="text-notey-orange hover:underline">
                    hirparaharshal.57@gmail.com
                  </a>
                </p>

                <h4 className="text-lg font-semibold text-gray-900 mb-3">8. Changes to Terms</h4>
                <p className="text-gray-700 mb-4">
                  These Terms may be updated. Continued use of the app after changes means you agree to the updated terms.
                </p>

                <p className="text-sm text-gray-500 mt-6 border-t pt-4">
                  Last updated: August 7, 2025
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
              href="/Terms and Conditions.pdf"
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

export function TermsAndConditionsLink() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-gray-500 hover:text-gray-700 text-sm"
      >
        Terms & Conditions
      </button>
      <TermsAndConditions isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}