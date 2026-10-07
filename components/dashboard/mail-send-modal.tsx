"use client";

import { CheckCircle2, AlertCircle, Mail, Loader2, X } from "lucide-react";

interface MailSendModalProps {
  isOpen: boolean;
  status: "sending" | "success" | "error" | "idle";
  companyName?: string;
  jobCount?: number;
  errorMessage?: string;
  onClose?: () => void;
}

export function MailSendModal({
  isOpen,
  status,
  companyName = "Your Company",
  jobCount = 1,
  errorMessage,
  onClose,
}: MailSendModalProps) {
  if (!isOpen || status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-8">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        )}

        {status === "sending" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Mail className="w-8 h-8 text-cyan-400 animate-bounce" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Submitting Report</h3>
              <p className="text-sm text-slate-400">
                {jobCount === 1 ? `Sending ${companyName} pump tests…` : `Processing ${jobCount} reports…`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400">Please wait...</span>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Report Submitted Successfully</h3>
              <p className="text-sm text-slate-400">
                {jobCount === 1 ? `${companyName} report sent to the team` : `${jobCount} reports submitted`}
              </p>
              <p className="text-xs text-emerald-400/80 mt-2">✓ Email with Excel sent</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-red-500/20 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Submission Failed</h3>
              <p className="text-sm text-slate-400 mb-3">
                {errorMessage || "Unable to submit report. Check your internet connection."}
              </p>
              <p className="text-xs text-amber-300">⚠ Report queued on this device. Use &apos;Resend&apos; when online to retry.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
