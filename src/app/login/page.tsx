"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Static premium quotes (Performance Boost)
const premiumQuotes = [
  { content: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { content: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { content: "The details are not the details. They make the design.", author: "Charles Eames" },
  { content: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { content: "Good design is good business.", author: "Thomas Watson Jr." },
  { content: "Excellence is not a skill, it is an attitude.", author: "Ralph Marston" },
];

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  // Check database health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setDbStatus(data.services?.database === 'healthy' ? 'connected' : 'disconnected');
      } catch {
        setDbStatus('disconnected');
      }
    };
    checkHealth();
  }, []);

  // Cycle through quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % premiumQuotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        router.push("/dashboard");
      } else {
        setError(data.message || "Login failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="slt-login-root">
      {/* Animated BG blobs */}
      <div className="slt-blob slt-blob-1" />
      <div className="slt-blob slt-blob-2" />
      <div className="slt-blob slt-blob-3" />

      {/* Main 2-column grid */}
      <div className="slt-card">

        {/* ── LEFT PANEL ── */}
        <div className="slt-left-panel">
          {/* Noise overlay */}
          <div className="slt-noise" />

          {/* Branding */}
          <div className="slt-brand">
            <div className="slt-logo-wrap">
              <Image src="/logo.png" alt="SLTS Nexus" width={36} height={36} className="slt-logo-img" />
            </div>
            <span className="slt-brand-name">SLTS Nexus</span>
          </div>

          {/* Hero text */}
          <div className="slt-hero">
            <h1 className="slt-hero-title">
              Enterprise<br />
              <span className="slt-hero-accent">Resource</span><br />
              Management
            </h1>
            <p className="slt-hero-sub">
              Streamline OSP workflows with SLT&apos;s next-generation Nexus enterprise platform.
            </p>
          </div>

          {/* Feature badges */}
          <div className="slt-badges">
            {["Real-time Inventory", "Audit Trails", "Role-based Access"].map((f) => (
              <div key={f} className="slt-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </div>
            ))}
          </div>

          {/* Quote carousel */}
          <div className="slt-quote-area">
            <div key={quoteIndex} className="slt-quote-fade">
              <p className="slt-quote-text">&ldquo;{premiumQuotes[quoteIndex].content}&rdquo;</p>
              <p className="slt-quote-author">&mdash; {premiumQuotes[quoteIndex].author}</p>
            </div>
            <div className="slt-quote-dots">
              {premiumQuotes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setQuoteIndex(i)}
                  className={`slt-dot${i === quoteIndex ? " slt-dot-active" : ""}`}
                  aria-label={`Quote ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (Login form) ── */}
        <div className="slt-right-panel">
          {/* Mobile-only top branding */}
          <div className="slt-mobile-brand">
            <div className="slt-mobile-logo-wrap">
              <Image src="/logo.png" alt="Logo" width={44} height={44} priority className="slt-logo-img" />
            </div>
            <h1 className="slt-mobile-title">SLTS Nexus</h1>
            <p className="slt-mobile-sub">Sri Lanka Telecom Enterprise System</p>
          </div>

          {/* Desktop heading */}
          <div className="slt-desktop-heading">
            <h2 className="slt-form-title">Welcome back</h2>
            <p className="slt-form-sub">Sign in to your SLTS account to continue</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="slt-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="slt-form">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="slt-label">Username</FormLabel>
                    <FormControl>
                      <div className="slt-input-wrap">
                        <svg className="slt-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <Input
                          id="login-username"
                          placeholder="Enter your username"
                          className="slt-input"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="slt-label-row">
                      <FormLabel className="slt-label">Password</FormLabel>
                      <Link href="/forgot-password" className="slt-forgot">Forgot password?</Link>
                    </div>
                    <FormControl>
                      <div className="slt-input-wrap">
                        <svg className="slt-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          className="slt-input"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                id="login-submit-btn"
                className="slt-submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <svg className="slt-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Quick Test Login */}
          <div className="slt-test-section">
            <div className="slt-test-header">
              <span className="slt-test-badge">🧪 Quick Test Login</span>
              <span className="slt-test-note">Development &amp; Testing Phase Only</span>
            </div>
            <div className="slt-test-grid">
              {[
                { username: 'admin',        role: 'Super Admin',  cls: 'slt-role-violet'  },
                { username: 'testadmin',    role: 'Admin',        cls: 'slt-role-blue'    },
                { username: 'ospmanager',   role: 'OSP Manager',  cls: 'slt-role-emerald' },
                { username: 'areamanager',  role: 'Area Manager', cls: 'slt-role-orange'  },
                { username: 'storesmanager',role: 'Stores Mgr',   cls: 'slt-role-cyan'    },
                { username: 'coordinator',  role: 'Coordinator',  cls: 'slt-role-pink'    },
                { username: 'qcofficer',    role: 'QC Officer',   cls: 'slt-role-indigo'  },
              ].map((u) => (
                <button
                  key={u.username}
                  type="button"
                  className={`slt-role-btn ${u.cls}`}
                  onClick={() => {
                    form.setValue('username', u.username);
                    form.setValue('password', 'Admin@123');
                    setTimeout(() => form.handleSubmit(onSubmit)(), 200);
                  }}
                >
                  {u.role}
                </button>
              ))}
            </div>
            <p className="slt-test-pw">Password: Admin@123 &bull; Click to auto-login</p>
          </div>

          {/* Footer status */}
          <div className="slt-footer">
            <div className="slt-db-status">
              <span className={`slt-db-dot ${dbStatus === 'connected' ? 'slt-db-ok' : dbStatus === 'disconnected' ? 'slt-db-err' : 'slt-db-wait'}`} />
              <span className={`slt-db-label ${dbStatus === 'connected' ? 'slt-db-label-ok' : dbStatus === 'disconnected' ? 'slt-db-label-err' : 'slt-db-label-wait'}`}>
                {dbStatus === 'connected' ? 'Database Connected' : dbStatus === 'disconnected' ? 'Database Offline' : 'Checking…'}
              </span>
            </div>
            <p className="slt-footer-note">Protected by Enterprise Security. Unauthorized access is prohibited.</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* ── SLT Brand Palette ──
           Primary Blue   : #0072BB  (SLT corporate blue)
           Dark Blue      : #004A80  (depth / hover)
           Accent Teal    : #00AEEF  (sky-blue highlight)
           Background     : #08111F  (very dark navy)
        */

        .slt-login-root {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: #08111F;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        /* ── Animated background blobs ── */
        .slt-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          animation: blobPulse 8s ease-in-out infinite;
        }
        .slt-blob-1 {
          width: 55vw; height: 55vw;
          top: -20%; left: -15%;
          background: radial-gradient(circle, rgba(0,114,187,0.22) 0%, transparent 70%);
          animation-delay: 0s;
        }
        .slt-blob-2 {
          width: 45vw; height: 45vw;
          bottom: -20%; right: -10%;
          background: radial-gradient(circle, rgba(0,174,239,0.15) 0%, transparent 70%);
          animation-delay: 3s;
        }
        .slt-blob-3 {
          width: 30vw; height: 30vw;
          top: 40%; left: 50%;
          background: radial-gradient(circle, rgba(0,74,128,0.12) 0%, transparent 70%);
          animation-delay: 5s;
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1) translate(0, 0); }
          50%       { transform: scale(1.08) translate(2%, 2%); }
        }

        /* ── Main card ── */
        .slt-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1100px;
          display: grid;
          grid-template-columns: 1fr;
          background: rgba(13, 22, 38, 0.85);
          backdrop-filter: blur(24px);
          border-radius: 20px;
          border: 1px solid rgba(0,114,187,0.18);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03);
          overflow: hidden;
        }
        @media (min-width: 900px) {
          .slt-card {
            grid-template-columns: 1fr 1fr;
            min-height: 620px;
          }
        }

        /* ── LEFT PANEL ── */
        .slt-left-panel {
          display: none;
          position: relative;
          overflow: hidden;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem;
          background: linear-gradient(145deg, #004A80 0%, #0072BB 45%, #00AEEF 100%);
        }
        @media (min-width: 900px) {
          .slt-left-panel { display: flex; }
        }

        .slt-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 200px;
          pointer-events: none;
        }

        /* Brand */
        .slt-brand {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .slt-logo-wrap {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .slt-logo-img { object-fit: contain; filter: drop-shadow(0 0 8px rgba(255,255,255,0.3)); }
        .slt-brand-name {
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #fff;
        }

        /* Hero */
        .slt-hero { position: relative; z-index: 1; }
        .slt-hero-title {
          font-size: clamp(2rem, 3.5vw, 2.75rem);
          font-weight: 800;
          line-height: 1.15;
          color: #fff;
          margin: 0 0 1rem;
        }
        .slt-hero-accent {
          color: rgba(255,255,255,0.75);
          text-decoration: underline;
          text-decoration-color: rgba(255,255,255,0.3);
          text-underline-offset: 5px;
        }
        .slt-hero-sub {
          color: rgba(255,255,255,0.75);
          font-size: 0.9rem;
          line-height: 1.6;
          max-width: 28ch;
        }

        /* Feature badges */
        .slt-badges { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 0.5rem; }
        .slt-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          padding: 0.35rem 0.85rem;
          color: rgba(255,255,255,0.9);
          font-size: 0.78rem;
          font-weight: 500;
          width: fit-content;
        }

        /* Quote carousel */
        .slt-quote-area { position: relative; z-index: 1; }
        .slt-quote-fade { animation: sltFadeUp 0.5s ease-out; }
        @keyframes sltFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .slt-quote-text {
          font-size: 0.9rem;
          font-style: italic;
          color: rgba(255,255,255,0.85);
          line-height: 1.6;
          margin: 0 0 0.35rem;
        }
        .slt-quote-author {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.55);
          font-weight: 600;
        }
        .slt-quote-dots { display: flex; gap: 6px; margin-top: 0.75rem; }
        .slt-dot {
          height: 4px;
          width: 8px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.25);
          border: none;
          cursor: pointer;
          transition: all 0.3s;
          padding: 0;
        }
        .slt-dot-active { width: 24px; background: rgba(255,255,255,0.85); }

        /* ── RIGHT PANEL ── */
        .slt-right-panel {
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          justify-content: center;
        }
        @media (min-width: 480px) { .slt-right-panel { padding: 2.5rem 2rem; } }
        @media (min-width: 900px) { .slt-right-panel { padding: 3rem 2.5rem; } }

        /* Mobile brand (hidden on desktop) */
        .slt-mobile-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          text-align: center;
        }
        @media (min-width: 900px) { .slt-mobile-brand { display: none; } }
        .slt-mobile-logo-wrap {
          background: linear-gradient(135deg, #004A80, #0072BB);
          border-radius: 16px;
          padding: 0.75rem;
          display: inline-flex;
          box-shadow: 0 8px 24px rgba(0,114,187,0.35);
        }
        .slt-mobile-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.04em;
          margin: 0;
        }
        .slt-mobile-sub {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.45);
          margin: 0;
        }

        /* Desktop heading (hidden on mobile) */
        .slt-desktop-heading { display: none; }
        @media (min-width: 900px) { .slt-desktop-heading { display: block; } }
        .slt-form-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 0.375rem;
        }
        .slt-form-sub { font-size: 0.85rem; color: rgba(255,255,255,0.45); margin: 0; }

        /* Error */
        .slt-error {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #f87171;
          font-size: 0.82rem;
          animation: sltShake 0.3s ease-in-out;
        }
        @keyframes sltShake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }

        /* Form */
        .slt-form { display: flex; flex-direction: column; gap: 1rem; }
        .slt-label {
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          color: rgba(255,255,255,0.7) !important;
          letter-spacing: 0.03em;
        }
        .slt-label-row { display: flex; align-items: center; justify-content: space-between; }
        .slt-forgot { font-size: 0.75rem; color: #00AEEF; font-weight: 500; text-decoration: none; transition: color 0.2s; }
        .slt-forgot:hover { color: #fff; }

        .slt-input-wrap { position: relative; }
        .slt-input-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          transition: color 0.2s;
          z-index: 1;
        }
        .slt-input-wrap:focus-within .slt-input-icon { color: #0072BB; }

        /* Override shadcn Input inside slt-input-wrap */
        .slt-input {
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 10px !important;
          color: #fff !important;
          font-size: 0.875rem !important;
          height: 2.85rem !important;
          padding-left: 2.75rem !important;
          transition: border-color 0.2s, box-shadow 0.2s !important;
        }
        .slt-input::placeholder { color: rgba(255,255,255,0.25) !important; }
        .slt-input:focus {
          border-color: #0072BB !important;
          box-shadow: 0 0 0 3px rgba(0,114,187,0.2) !important;
          outline: none !important;
        }

        /* Submit button */
        .slt-submit-btn {
          width: 100% !important;
          height: 2.85rem !important;
          border-radius: 10px !important;
          font-size: 0.9rem !important;
          font-weight: 700 !important;
          letter-spacing: 0.02em;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.5rem !important;
          background: linear-gradient(135deg, #0072BB 0%, #00AEEF 100%) !important;
          color: #fff !important;
          border: none !important;
          box-shadow: 0 6px 20px rgba(0,114,187,0.35) !important;
          transition: transform 0.15s, box-shadow 0.15s !important;
          cursor: pointer !important;
        }
        .slt-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px) !important;
          box-shadow: 0 10px 28px rgba(0,114,187,0.45) !important;
        }
        .slt-submit-btn:active:not(:disabled) { transform: translateY(0) !important; }
        .slt-submit-btn:disabled { opacity: 0.6 !important; cursor: not-allowed !important; }
        .slt-spin { animation: sltSpin 1s linear infinite; }
        @keyframes sltSpin { to { transform: rotate(360deg); } }

        /* Test login */
        .slt-test-section {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 1rem;
        }
        .slt-test-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 0.625rem;
          flex-wrap: wrap;
        }
        .slt-test-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: #f59e0b;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .slt-test-note { font-size: 0.68rem; color: rgba(255,255,255,0.3); }
        .slt-test-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.4rem;
        }
        @media (min-width: 480px) {
          .slt-test-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 900px) {
          .slt-test-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .slt-test-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .slt-role-btn {
          padding: 0.45rem 0.6rem;
          border-radius: 8px;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          border: 1px solid;
          color: rgba(255,255,255,0.85);
          text-align: center;
        }
        .slt-role-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .slt-role-btn:active { transform: translateY(0); }
        .slt-role-violet  { background: rgba(139,92,246,0.18); border-color: rgba(139,92,246,0.3); }
        .slt-role-blue    { background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.3); }
        .slt-role-emerald { background: rgba(16,185,129,0.18); border-color: rgba(16,185,129,0.3); }
        .slt-role-orange  { background: rgba(249,115,22,0.18); border-color: rgba(249,115,22,0.3); }
        .slt-role-cyan    { background: rgba(6,182,212,0.18);  border-color: rgba(6,182,212,0.3);  }
        .slt-role-pink    { background: rgba(236,72,153,0.18); border-color: rgba(236,72,153,0.3); }
        .slt-role-indigo  { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.3); }
        .slt-test-pw { font-size: 0.68rem; color: rgba(255,255,255,0.25); text-align: center; margin-top: 0.5rem; }

        /* Footer */
        .slt-footer { text-align: center; display: flex; flex-direction: column; gap: 0.5rem; }
        .slt-db-status { display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .slt-db-dot {
          width: 7px; height: 7px; border-radius: 50%;
          animation: sltPulse 2s ease-in-out infinite;
        }
        .slt-db-ok  { background: #10b981; }
        .slt-db-err { background: #ef4444; }
        .slt-db-wait { background: #f59e0b; }
        @keyframes sltPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        .slt-db-label    { font-size: 0.72rem; font-weight: 600; }
        .slt-db-label-ok   { color: #34d399; }
        .slt-db-label-err  { color: #f87171; }
        .slt-db-label-wait { color: #fbbf24; }
        .slt-footer-note { font-size: 0.68rem; color: rgba(255,255,255,0.2); line-height: 1.5; }
      `}</style>
    </div>
  );
}
