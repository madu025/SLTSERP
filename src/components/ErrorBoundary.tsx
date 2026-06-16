// Client-side Error Boundary and Logger
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('React Error Boundary caught an error:', error, errorInfo);
        }

        // You can also log to an error reporting service here
        // Example: logErrorToService(error, errorInfo);

        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Something Went Wrong
                        </h1>

                        <p className="text-slate-600 mb-6">
                            We apologize for the inconvenience. An unexpected error has occurred.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                                <p className="text-xs font-mono text-red-800 break-all">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-red-600 cursor-pointer">
                                            Stack trace
                                        </summary>
                                        <pre className="text-[10px] text-red-700 mt-2 overflow-auto max-h-40">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={this.handleReset}
                            className="w-full bg-primary hover:bg-primary-dark"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reload Page
                        </Button>

                        <p className="text-xs text-slate-400 mt-4">
                            If this problem persists, please contact support.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// API Error Logger
export function logApiError(endpoint: string, error: any) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
    };

    if (process.env.NODE_ENV === 'development') {
        console.error('🔴 API Error:', errorLog);
    }

    // In production, you would send this to a logging service
    // Example: sendToLoggingService(errorLog);
}

// Fetch wrapper with error handling
export async function safeFetch(url: string, options?: RequestInit) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        logApiError(url, error);
        throw error;
    }
}
