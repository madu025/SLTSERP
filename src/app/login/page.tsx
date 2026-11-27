"use client";

import Link from "next/link";
import {  useState, useEffect, Suspense  } from 'react';
import { NexusLogoMaster } from "@/components/ui/NexusLogo";
import "./route-login.css";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { landingPath } from "@/config/landing";
import * as z from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

// Staff motivation quotes, one at a time on the route panel
const staffQuotes = [
  { content: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { content: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { content: "The details are not the details. They make the design.", author: "Charles Eames" },
  { content: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { content: "Good design is good business.", author: "Thomas Watson Jr." },
  { content: "Excellence is not a skill, it is an attitude.", author: "Ralph Marston" },
];

const bodyFont = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-lg-body", display: "swap" });
const displayFont = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-lg-display", display: "swap" });

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  // Session expired banner (set by global 401 interceptor in SessionManager)
  const sessionExpired = searchParams.get('session') === 'expired';
  // Sanitize callbackUrl: internal paths only (no open redirects), and never
  // '/' — the root route is a session-aware gateway, not a page to return to.
  const rawCallback = searchParams.get('callbackUrl') || null;
  const callbackUrl = rawCallback && rawCallback !== '/' && rawCallback.startsWith('/') && !rawCallback.startsWith('//')
    ? rawCallback
    : null;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  // The SSR HTML is interactive (and submittable) long before this component
  // hydrates. Until then the form has no onSubmit handler, so a "Sign In" click
  // or Enter falls back to a NATIVE GET submission: no /api/login call happens,
  // the page silently reloads with empty fields, and the credentials land in the
  // URL. Gate the submit control on hydration and adopt anything already typed.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const typedUsername = (document.getElementById('login-username') as HTMLInputElement | null)?.value ?? '';
    const typedPassword = (document.getElementById('login-password') as HTMLInputElement | null)?.value ?? '';
    if (typedUsername) form.setValue('username', typedUsername);
    if (typedPassword) form.setValue('password', typedPassword);
    
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, [form]);

  // Dismiss any lingering toasts and close active service worker notifications on login screen
  useEffect(() => {
    try {
      toast.dismiss();
    } catch {}
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.getNotifications().then((notifications) => {
          notifications.forEach((n) => n.close());
        }).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setError("");
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[LOGIN] Attempt ${attempt}/${maxRetries} started at ${new Date().toISOString()}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for cold starts
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        console.log(`[LOGIN] Response status: ${response.status}, ok: ${response.ok}`);

        if (response.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          if (data.token) {
            localStorage.setItem("token", data.token);
          }

          // Confirm the session cookie is actually visible to the server BEFORE
          // navigating. A fixed delay loses the Set-Cookie commit race on some
          // machines/browsers: the /dashboard navigation then goes out without
          // the token, middleware bounces back to /login, and only the second
          // login attempt works. Probe an authenticated endpoint until it stops
          // returning 401 (cookie committed) instead of sleeping blindly.
          let sessionConfirmed = false;
          for (let i = 0; i < 10 && !sessionConfirmed; i++) {
            try {
              const probe = await fetch('/api/profile', { credentials: 'same-origin' });
              // 401 = cookie not yet visible; any other status means it was.
              sessionConfirmed = probe.status !== 401;
            } catch {
              // Network hiccup — retry.
            }
            if (!sessionConfirmed) await new Promise(r => setTimeout(r, 250));
          }

          if (!sessionConfirmed) {
            console.error('[LOGIN] Session cookie not visible after login — aborting redirect');
            setError('Session could not be established. Please try again.');
            return;
          }

          const targetUrl = callbackUrl || landingPath(data.user?.permissions);

          console.log(`[LOGIN] Success, redirecting to: ${targetUrl}`);
          window.location.assign(targetUrl);
          return; // Success, exit
        }

        // Server-side errors (500/502/503/504) — likely cold start or connection
        // initialization failure. Retry once so the warm connection succeeds.
        const isServerError = [500, 502, 503, 504].includes(response.status);
        if (isServerError && attempt < maxRetries) {
          console.warn(`[LOGIN] Server error ${response.status} on attempt ${attempt}, retrying after 1.5s...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        // Auth error (401/403) or final attempt server error — show immediately
        setError(data.error?.message || data.message || "Login failed");
        return;
      } catch (err) {
        if (attempt < maxRetries) {
          // Network/timeout error - retry after 1s
          console.warn(`[LOGIN] Attempt ${attempt} network error, retrying...`, err);
          await new Promise(r => setTimeout(r, 1000));
        } else {
          // Final attempt failed
          const isTimeout = err instanceof DOMException && err.name === 'AbortError';
          console.error(`[LOGIN] Final attempt failed:`, err);
          setError(isTimeout
            ? "Server is starting up. Please try again."
            : "Connection failed. Please check your network and try again.");
        }
      }
    }
  };

  // Next quote every 8 seconds
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % staffQuotes.length), 8000);
    return () => clearInterval(t);
  }, []);

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <div className={`lg-root ${bodyFont.variable} ${displayFont.variable}`}>
      {/* Route panel: the fibre route from the exchange to the customer */}
      <section className="lg-route-panel" aria-label="SLTS Nexus">
        {/* The headline names the system, so the logo carries no subtitle */}
        <NexusLogoMaster iconSize={52} subtitle="" />

        <div className="lg-headline-block">
          <h1 className="lg-headline">Workflow Management System</h1>
          <p className="lg-lede">Outside plant work, start to finish: projects, stores, procurement and finance for SLT Services, in one place.</p>
          <figure className="lg-quote" aria-live="polite">
            <blockquote key={quoteIndex} className="lg-quote-text">&ldquo;{staffQuotes[quoteIndex].content}&rdquo;</blockquote>
            <figcaption className="lg-quote-author">{staffQuotes[quoteIndex].author}</figcaption>
          </figure>
        </div>

        <svg className="lg-route" viewBox="0 0 600 210" role="img" aria-label="A fibre route from the exchange, through a cabinet and poles, to the customer">
          <line className="lg-route-ground" x1="0" y1="180" x2="600" y2="180" />
          {/* Exchange */}
          <path className="lg-route-plant" d="M22 180 V132 H82 V180 M22 132 L52 114 L82 132 M38 150 H50 M58 150 H70 M38 164 H50 M58 164 H70" />
          {/* Cabinet */}
          <path className="lg-route-plant" d="M200 180 V146 H230 V180 M206 154 H224" />
          {/* Poles */}
          <path className="lg-route-plant" d="M300 180 V88 M288 95 H312 M390 180 V88 M378 95 H402 M480 180 V88 M468 95 H492" />
          {/* Customer */}
          <path className="lg-route-plant" d="M540 180 V148 H582 V180 M534 152 L561 130 L588 152 M555 180 V164 H567 V180" />
          {/* The fibre: underground to the cabinet, then aerial over the poles, then the drop */}
          <path className="lg-route-fibre" pathLength={1} d="M60 170 H215 L300 95 Q345 122 390 95 Q435 122 480 95 Q522 108 552 150" />
          <circle className="lg-route-pulse" r="4" />
          <text className="lg-route-label" x="52" y="200" textAnchor="middle">Exchange</text>
          <text className="lg-route-label" x="215" y="200" textAnchor="middle">Cabinet</text>
          <text className="lg-route-label" x="390" y="200" textAnchor="middle">Poles</text>
          <text className="lg-route-label" x="561" y="200" textAnchor="middle">Customer</text>
        </svg>
      </section>

      {/* Form panel */}
      <main className="lg-form-panel">
        <div className="lg-form-column">
          <h2 className="lg-title">Sign in</h2>
          <p className="lg-sub">Use your SLTS Nexus username and password.</p>

          {sessionExpired && (
            <div className="lg-alert lg-alert-expired" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Your session has ended. Sign in again to continue.</span>
            </div>
          )}

          {error && (
            <div className="lg-alert lg-alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="lg-form" noValidate>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="gap-0">
                    <FormLabel className="lg-label" htmlFor="login-username">Username</FormLabel>
                    <FormControl>
                      <input
                        id="login-username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="lg-input"
                        aria-invalid={!!usernameError}
                        aria-describedby={usernameError ? "login-username-error" : undefined}
                        {...field}
                      />
                    </FormControl>
                    {usernameError && <p id="login-username-error" className="lg-field-error">{usernameError}</p>}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="gap-0">
                    <FormLabel className="lg-label" htmlFor="login-password">Password</FormLabel>
                    <FormControl>
                      <input
                        id="login-password"
                        autoComplete="current-password"
                        type="password"
                        className="lg-input"
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? "login-password-error" : undefined}
                        {...field}
                      />
                    </FormControl>
                    {passwordError && <p id="login-password-error" className="lg-field-error">{passwordError}</p>}
                  </FormItem>
                )}
              />

              <button
                type={hydrated ? "submit" : "button"}
                disabled={!hydrated || isSubmitting}
                id="login-submit-btn"
                className="lg-submit"
              >
                {isSubmitting ? (
                  <>
                    <svg className="lg-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              {/* Below Sign in, so Tab goes Username -> Password -> Sign in */}
              <Link href="/forgot-password" className="lg-forgot">Forgot password?</Link>
            </form>
          </Form>

          {/* Quick test login (development server only) */}
          {process.env.NODE_ENV === "development" && (
            <div className="lg-dev">
              <p className="lg-dev-title">Quick test login (development only)</p>
              <div className="lg-dev-grid">
                {[
                  { username: 'admin',         role: 'Super Admin'  },
                  { username: 'testadmin',     role: 'Admin'        },
                  { username: 'ospmanager',    role: 'OSP Manager'  },
                  { username: 'areamanager',   role: 'Area Manager' },
                  { username: 'storesmanager', role: 'Stores Mgr'   },
                  { username: 'coordinator',   role: 'Coordinator'  },
                  { username: 'qcofficer',     role: 'QC Officer'   },
                ].map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    className="lg-dev-btn"
                    onClick={async () => {
                      form.setValue('username', u.username);
                      form.setValue('password', 'Admin@123');
                      await form.trigger(['username', 'password']);
                      form.handleSubmit(onSubmit)();
                    }}
                  >
                    {u.role}
                  </button>
                ))}
              </div>
              <p className="lg-dev-note">Password Admin@123. Click a role to sign in.</p>
            </div>
          )}

          <p className="lg-note">For authorised SLT Services staff and contractors only.</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
            <h1 className="text-xl font-semibold text-slate-900">SLTS Nexus</h1>
            <p className="mt-2 text-sm text-slate-700">Loading sign-in…</p>
          </section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
