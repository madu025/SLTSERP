"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const SECURITY_QUESTIONS = [
    "What was the name of your first school?",
    "What is your mother's maiden name?",
    "What was your childhood nickname?",
    "In what city were you born?",
    "What is the name of your favorite teacher?"
];

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1: Verify, 2: Security Question, 3: Reset Password
    const [username, setUsername] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [securityQuestion, setSecurityQuestion] = useState("");
    const [securityAnswer, setSecurityAnswer] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetToken, setResetToken] = useState("");

    const handleVerifyUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, employeeId })
            });

            const data = await res.json();

            if (res.ok) {
                setSecurityQuestion(data.securityQuestion);
                setResetToken(data.token);
                setStep(2);
                toast.success("User verified! Please answer your security question.");
            } else {
                toast.error(data.message || "Verification failed");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAnswer = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password/verify-answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: resetToken, answer: securityAnswer })
            });

            const data = await res.json();

            if (res.ok) {
                setStep(3);
                toast.success("Security answer verified! Set your new password.");
            } else {
                toast.error(data.message || "Incorrect answer");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: resetToken, newPassword })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Password reset successful! Redirecting to login...");
                setTimeout(() => router.push("/login"), 2000);
            } else {
                toast.error(data.message || "Password reset failed");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-6 h-6 text-primary" />
                        <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
                    </div>
                    <CardDescription>
                        {step === 1 && "Verify your identity to reset your password"}
                        {step === 2 && "Answer your security question"}
                        {step === 3 && "Set your new password"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Step 1: Verify User */}
                    {step === 1 && (
                        <form onSubmit={handleVerifyUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="employeeId">Employee ID</Label>
                                <Input
                                    id="employeeId"
                                    type="text"
                                    placeholder="Enter your employee ID"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Verifying..." : "Verify Identity"}
                            </Button>
                        </form>
                    )}

                    {/* Step 2: Security Question */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyAnswer} className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                <Label className="text-sm font-semibold text-blue-900">Security Question:</Label>
                                <p className="text-sm text-blue-800 mt-1">{securityQuestion}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="answer">Your Answer</Label>
                                <Input
                                    id="answer"
                                    type="text"
                                    placeholder="Enter your answer"
                                    value={securityAnswer}
                                    onChange={(e) => setSecurityAnswer(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Verifying..." : "Verify Answer"}
                            </Button>
                        </form>
                    )}

                    {/* Step 3: Reset Password */}
                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                <Lock className="w-4 h-4 mr-2" />
                                {loading ? "Resetting..." : "Reset Password"}
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                            <ArrowLeft className="w-3 h-3" />
                            Back to Login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
