import React, { useState } from 'react';
import { Building2, Mail, Lock, Eye, EyeOff, X, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface BuilderLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BuilderLoginModal({ isOpen, onClose, onSuccess }: BuilderLoginModalProps) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess();
      onClose();
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email'
      ) {
        setError('ایمیل یا رمز عبور اشتباه است.');
      } else if (code === 'auth/too-many-requests') {
        setError('تعداد تلاش بیش از حد. لطفاً بعداً امتحان کنید.');
      } else {
        setError('ورود ناموفق بود. اتصال اینترنت یا تنظیمات Firebase را بررسی کنید.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4 bg-[#0d111a] border border-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#1e2a3a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#141e2e] border border-[#1e2a3a]">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase mb-0.5">
                Tohid Meta Port
              </p>
              <h2 className="text-sm font-bold text-white leading-none">
                Builder Mode
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-white hover:bg-[#1e2a3a] transition-all disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-neutral-500 font-mono text-center">
            برای مدیریت غرفه‌ها، نمایشگاه را ویرایش کنید
          </p>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">
              ایمیل
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                disabled={loading}
                className="w-full bg-[#141824] border border-[#1e2a3a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">
              رمز عبور
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full bg-[#141824] border border-[#1e2a3a] rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors disabled:opacity-40"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/25 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold py-2.5 px-4 rounded-lg transition-all text-sm tracking-wide"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال ورود…</>
              : <><Building2 className="w-4 h-4" /> ورود به Builder Mode</>
            }
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-[10px] text-neutral-700 font-mono">
            فقط مدیران مجاز به ویرایش هستند
          </p>
        </div>
      </div>
    </div>
  );
}
