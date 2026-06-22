"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import "./login.css";
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
            <div className="slt-hero-cta">
              <Link href="/presentation" className="slt-cta-link">
                Explore Platform Features
                <svg className="slt-cta-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
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

      {/* login.css styles are loaded statically */}
    </div>
  );
}
