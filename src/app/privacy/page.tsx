export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="mx-auto max-w-4xl px-6 py-12">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
                    <p className="mt-2 text-sm text-slate-500">SLT-ERP Bridge Chrome Extension</p>
                    <p className="mt-1 text-xs text-slate-400">Last updated: August 31, 2026</p>
                </div>

                {/* Content */}
                <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">1. Overview</h2>
                        <p className="leading-relaxed text-slate-600">
                            The SLT-ERP Bridge extension facilitates data synchronization between the SLT Service Portal
                            and the SLTS ERP system. This privacy policy describes how the extension handles user data
                            during this process.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">2. Data Collected</h2>
                        <p className="mb-3 leading-relaxed text-slate-600">
                            The extension captures the following data from the SLT Service Portal pages that the user
                            actively visits:
                        </p>
                        <ul className="ml-6 list-disc space-y-1 text-slate-600">
                            <li>Service Order numbers and status information</li>
                            <li>Customer names, addresses, and contact details as displayed on the portal</li>
                            <li>Material usage details (drop wire, ONT, IPTV serial numbers)</li>
                            <li>Forensic audit photo upload status</li>
                            <li>Team assignment information</li>
                            <li>The logged-in SLT portal username (for attribution only)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">3. How Data Is Used</h2>
                        <p className="leading-relaxed text-slate-600">
                            All captured data is transmitted exclusively to the SLTS ERP application
                            (https://sltserp.vercel.app) for the sole purpose of synchronizing service order
                            information. No data is sent to any third-party service, analytics platform, or external
                            server.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">4. Data Storage</h2>
                        <p className="leading-relaxed text-slate-600">
                            The extension uses Chrome local storage (<code className="rounded bg-slate-100 px-1 text-sm">chrome.storage.local</code>)
                            to temporarily cache scraped data between page navigations. This data is stored only on the
                            user&apos;s local machine and is automatically cleared when the extension is uninstalled or
                            browser cache is cleared. No data is persisted outside the user&apos;s device and the
                            SLTS ERP server.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">5. Data Sharing</h2>
                        <p className="leading-relaxed text-slate-600">
                            We do not sell, trade, share, or transfer any user data to third parties. Data is
                            transmitted only between the SLT Service Portal and the SLTS ERP application, both of
                            which are operated under the authority of SLT Network Solutions.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">6. Permissions</h2>
                        <p className="mb-3 leading-relaxed text-slate-600">The extension requires the following Chrome permissions:</p>
                        <ul className="ml-6 list-disc space-y-1 text-slate-600">
                            <li><strong>storage</strong> — To cache synchronization data locally</li>
                            <li><strong>tabs</strong> — To detect when the user is viewing an SLT portal page</li>
                            <li><strong>activeTab</strong> — To access the currently active tab for scraping</li>
                            <li><strong>alarms</strong> — To schedule periodic synchronization checks</li>
                            <li><strong>cookies</strong> — To authenticate ERP API requests using session cookies</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">7. Security</h2>
                        <p className="leading-relaxed text-slate-600">
                            All data transmission between the extension and the SLTS ERP application occurs over
                            HTTPS. The extension only communicates with domains explicitly listed in its manifest
                            (serviceportal.slt.lk, sltserp.vercel.app). No data is transmitted over unencrypted
                            connections.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">8. User Rights</h2>
                        <p className="leading-relaxed text-slate-600">
                            Users may uninstall the extension at any time, which will remove all locally stored data.
                            For any data held on the SLTS ERP server, users should contact their system administrator
                            or the SLTS ERP support team.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">9. Contact</h2>
                        <p className="leading-relaxed text-slate-600">
                            For questions about this privacy policy, please contact the SLTS ERP administration team
                            through the application&apos;s support channels.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-slate-400">
                    SLT Network Solutions (Pvt) Ltd
                </p>
            </div>
        </div>
    );
}
