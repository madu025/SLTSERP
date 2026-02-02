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
        setDbStatus(data.database === 'connected' ? 'connected' : 'disconnected');
      } catch {
        setDbStatus('disconnected');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
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
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-sky-50 z-0"></div>

      {/* Abstract Shapes for Premium Feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>

      {/* Main Card Container */}
      <div className="relative z-10 w-full max-w-6xl bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col md:flex-row min-h-[600px] transition-all duration-300 hover:shadow-primary/5">

        {/* Left Side - Brand & Inspiration */}
        <div className="hidden md:flex w-full md:w-1/2 bg-gradient-to-br from-primary to-primary-dark relative overflow-hidden p-12 flex-col justify-between text-white">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>

          {/* Top Branding */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-md border border-white/20">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-bold tracking-wider opacity-95">SLTS Nexus</span>
          </div>

          {/* Center Content */}
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
              Manage Your <br />
              <span className="text-sky-200">Workflow</span> <br />
              Optimization
            </h2>
            <p className="text-sky-100 max-w-md text-lg leading-relaxed opacity-90">
              Streamline your OSP management workflows with our next-generation Nexus enterprise solution.
            </p>
          </div>

          {/* Bottom Quote Carousel */}
          <div className="relative z-10 mt-12">
            <div className="h-24 flex items-end">
              <div key={quoteIndex} className="animate-fadeIn transition-all duration-500">
                <p className="text-lg italic font-medium text-white/90">"{premiumQuotes[quoteIndex].content}"</p>
                <p className="text-sm text-sky-200 mt-2 font-semibold">— {premiumQuotes[quoteIndex].author}</p>
              </div>
            </div>
            {/* Indicators */}
            <div className="flex gap-2 mt-4">
              {premiumQuotes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setQuoteIndex(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${i === quoteIndex ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                />
              ))}
            </div>
          </div>

          {/* Decorative Circles */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -left-24 w-48 h-48 bg-sky-400/20 rounded-full blur-2xl"></div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center bg-white/50 backdrop-blur-sm">
          <div className="max-w-md w-full mx-auto space-y-8">

            {/* Mobile Header (Only visible on Mobile) */}
            <div className="md:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
                <Image src="/logo.png" alt="Logo" width={48} height={48} priority className="object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
              <p className="text-slate-500 mt-1">Sign in to continue</p>
            </div>

            <div className="hidden md:block">
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Sign In</h2>
              <p className="text-slate-500 mt-2">Welcome back! Please enter your details.</p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-shake">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-semibold">Username</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <Input
                            placeholder="Enter your username"
                            className="bg-slate-50 border-slate-200 text-slate-900 pl-11 py-6 rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary"
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
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-slate-700 font-semibold">Password</FormLabel>
                        <a href="#" className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors">Forgot password?</a>
                      </div>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="bg-slate-50 border-slate-200 text-slate-900 pl-11 py-6 rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary"
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
                  className="w-full py-6 bg-gradient-to-r from-primary to-primary-dark hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-base"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>

            {/* Forgot Password Link */}
            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-sm text-primary hover:text-primary-dark hover:underline transition-colors">
                Forgot Password?
              </Link>
            </div>

            {/* 🧪 TEST USERS - Enabled for Development/Testing phase */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="text-center mb-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  🧪 Quick Test Login
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Development & Testing Phase Only</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { username: 'admin', role: 'Super Admin', color: 'from-violet-500 to-purple-600' },
                  { username: 'testadmin', role: 'Admin', color: 'from-blue-500 to-blue-600' },
                  { username: 'ospmanager', role: 'OSP Manager', color: 'from-emerald-500 to-green-600' },
                  { username: 'areamanager', role: 'Area Manager', color: 'from-orange-500 to-amber-600' },
                  { username: 'storesmanager', role: 'Stores Mgr', color: 'from-cyan-500 to-teal-600' },
                  { username: 'coordinator', role: 'Coordinator', color: 'from-pink-500 to-rose-600' },
                  { username: 'qcofficer', role: 'QC Officer', color: 'from-indigo-500 to-blue-600' },
                ].map((user) => (
                  <button
                    key={user.username}
                    type="button"
                    onClick={async () => {
                      form.setValue('username', user.username);
                      form.setValue('password', 'Admin@123');
                      // Auto-submit after 200ms
                      setTimeout(() => {
                        form.handleSubmit(onSubmit)();
                      }, 200);
                    }}
                    className={`px-3 py-2 rounded-lg bg-gradient-to-r ${user.color} text-white text-xs font-medium hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95`}
                  >
                    {user.role}
                  </button>
                ))}
              </div>

              <p className="text-[9px] text-slate-400 text-center mt-2 italic">
                Password: Admin@123 • Click to auto-login
              </p>
            </div>

            <div className="pt-4 text-center space-y-3">

              {/* Database Status Indicator */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  dbStatus === 'disconnected' ? 'bg-red-500' :
                    'bg-yellow-500 animate-pulse'
                  }`} />
                <span className={`font-medium ${dbStatus === 'connected' ? 'text-green-600' :
                  dbStatus === 'disconnected' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                  {dbStatus === 'connected' ? 'Database Connected' :
                    dbStatus === 'disconnected' ? 'Database Offline' :
                      'Checking Database...'}
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Protected by Enterprise Security. <br />
                <span className="opacity-70">Unauthorized access is prohibited.</span>
              </p>
            </div>

          </div>
        </div>
      </div>
      {/* Background Shapes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
