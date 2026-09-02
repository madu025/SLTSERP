export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="mx-auto max-w-4xl px-6 py-12">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
                    <p className="mt-2 text-sm text-slate-500">SLT-ERP Bridge Browser Extension</p>
                    <p className="mt-1 text-xs text-slate-400">Effective date: September 2, 2026</p>
                </div>

                {/* Content */}
                <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">1. Overview and Data Controller</h2>
                        <p className="leading-relaxed text-slate-600">
                            SLT-ERP Bridge is a browser extension operated by <strong>SLT Network Solutions (Pvt) Ltd
                            (&quot;SLTS&quot;)</strong>. It synchronizes service order data between the Sri Lanka Telecom
                            Service Portal and the internal SLTS ERP system. This extension is a workforce tool intended
                            solely for SLTS employees and authorized contractors performing SLT outside-plant
                            installation work. SLTS is the data controller for all data described in this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">2. Data We Collect</h2>
                        <p className="mb-3 leading-relaxed text-slate-600">
                            The extension only processes data from the specific SLT portal pages the user has open and
                            from the SLTS ERP application. We collect:
                        </p>
                        <ul className="ml-6 list-disc space-y-1 text-slate-600">
                            <li><strong>Service order data</strong> displayed on SLT portal pages the user actively
                                visits: service order numbers and status, customer names, addresses and contact details,
                                material usage details (drop wire, ONT, IPTV serial numbers), bill-of-materials (BOM)
                                CSV data served for those orders, forensic audit photo upload status, and team
                                assignment information.</li>
                            <li><strong>The logged-in SLT portal username</strong>, used only to attribute the captured
                                data to the correct operator.</li>
                            <li><strong>The SLT portal session cookie (PHPSESSID)</strong> for
                                serviceportal.slt.lk / ishamp.slt.lk, transmitted to the SLTS ERP server so that
                                portal session state can be validated and synchronization can resume after the user
                                logs in to the portal.</li>
                            <li><strong>Local synchronization status data</strong> stored on the user&apos;s device
                                only: last sync results (capped at 50 entries), a retry queue for failed syncs, the
                                ERP server address, and diagnostic connection status.</li>
                        </ul>
                        <p className="mt-3 leading-relaxed text-slate-600">
                            We do <strong>not</strong> collect: general browsing history, data from websites other than
                            the domains listed in Section 7, passwords or login credentials, payment or financial
                            account details, precise location, health data, biometric data, or any advertising
                            identifiers.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">3. How We Use Data</h2>
                        <p className="leading-relaxed text-slate-600">
                            All data is used exclusively to synchronize service order information into the SLTS ERP
                            system so that installation teams, storekeepers, and coordinators can record and process
                            completed work. Specifically: captured portal data is pushed to the ERP to create or update
                            service order records; the portal session cookie is used to validate session state and
                            resume interrupted synchronization; and locally stored retry data is used to re-attempt
                            failed transmissions. Data is never used for advertising, profiling, analytics, credit
                            scoring, or lending purposes, and is never used to train machine-learning models.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">4. Data Storage</h2>
                        <p className="leading-relaxed text-slate-600">
                            Captured data is stored in three places: (a) the browser&apos;s local extension storage
                            (<code className="rounded bg-slate-100 px-1 text-sm">chrome.storage.local</code>) and
                            IndexedDB on the user&apos;s device, which hold only synchronization status and the retry
                            queue; (b) the SLTS ERP application database, which holds the synchronized service order
                            records; and (c) transiently in memory during transmission. Nothing is stored on any other
                            server. Removing the extension deletes all device-side data automatically.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">5. Data Sharing</h2>
                        <p className="leading-relaxed text-slate-600">
                            We do not sell, rent, trade, or transfer user data to any third party. Data is transmitted
                            only between the SLT Service Portal (operated by Sri Lanka Telecom) and the SLTS ERP
                            application, both operated under the authority of SLT Network Solutions (Pvt) Ltd. We do
                            not share data with advertising networks, data brokers, analytics providers, or any other
                            external service.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">6. Data Retention and Deletion</h2>
                        <p className="leading-relaxed text-slate-600">
                            Device-side data (sync history and retry queue) is kept only while the extension is
                            installed and is automatically deleted when the extension is removed or the browser
                            profile is deleted. Synchronized service order records in the SLTS ERP server are retained
                            in accordance with the company&apos;s business record retention requirements. Any user may
                            request deletion of their associated data by contacting us (Section 12); requests are
                            actioned within 30 days.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">7. Permissions and Domains</h2>
                        <p className="mb-3 leading-relaxed text-slate-600">The extension requests the following Chrome permissions:</p>
                        <ul className="ml-6 list-disc space-y-1 text-slate-600">
                            <li><strong>storage</strong> — to cache synchronization status and settings locally</li>
                            <li><strong>tabs</strong> — to detect open SLT portal tabs so data can be combined across
                                them</li>
                            <li><strong>activeTab</strong> — to read the portal page the user is actively viewing</li>
                            <li><strong>alarms</strong> — to schedule periodic synchronization and retry processing</li>
                            <li><strong>cookies</strong> — to read the SLT portal session cookie (PHPSESSID) and share
                                it with the SLTS ERP server for session validation</li>
                        </ul>
                        <p className="mt-3 leading-relaxed text-slate-600">
                            The extension only accesses the following hosts, as declared in its manifest:
                            serviceportal.slt.lk, ishamp.slt.lk and other *.slt.lk subdomains,
                            d2ixqikwtprwf0.cloudfront.net (BOM file host for the portal), sltserp.vercel.app (the SLTS
                            ERP application), and localhost addresses for internal development testing. It runs no
                            code on any other website.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">8. Security</h2>
                        <p className="leading-relaxed text-slate-600">
                            All transmission occurs over HTTPS/TLS; no data is sent over unencrypted connections. ERP
                            requests are authenticated with a dedicated extension key header, and the SLTS ERP
                            application itself requires user login with role-based access control. Data is never
                            transmitted to any domain outside the list in Section 7.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">9. Your Rights and Choices</h2>
                        <p className="leading-relaxed text-slate-600">
                            You may uninstall the extension at any time, which immediately and permanently removes all
                            locally stored data. You may also clear stored extension data through your browser
                            settings. Subject to applicable data protection law, you may request access to,
                            correction of, or deletion of data held on the SLTS ERP server by contacting the address
                            in Section 12.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">10. Children&apos;s Privacy</h2>
                        <p className="leading-relaxed text-slate-600">
                            The extension is a workforce tool and is not directed at children under the age of 16. We
                            do not knowingly collect data from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">11. Changes to This Policy</h2>
                        <p className="leading-relaxed text-slate-600">
                            We may update this policy to reflect changes in the extension or applicable law. Updates
                            are posted on this page with a revised effective date, and material changes are
                            communicated to extension users through internal company channels.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-slate-800">12. Contact Us</h2>
                        <p className="leading-relaxed text-slate-600">
                            For questions, data access requests, or deletion requests regarding this privacy policy,
                            contact the SLTS ERP administration team:
                        </p>
                        <ul className="ml-6 list-disc space-y-1 text-slate-600">
                            <li>Email: prasad@slts.lk</li>
                            <li>Organization: SLT Network Solutions (Pvt) Ltd, Colombo, Sri Lanka</li>
                        </ul>
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
