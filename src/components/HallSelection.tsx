import React, { useState } from 'react';
import { Hall } from '../types';
import { User } from 'firebase/auth';
import { Building2, ArrowRight, Plus, LogIn, LogOut, Loader2 } from 'lucide-react';

interface HallSelectionProps {
  halls: Hall[];
  isLoading?: boolean;
  onEnterHall: (hall: Hall) => void;
  onCreateHall: (name: string, description: string) => Promise<void>;
  onLoadDemo: () => Promise<void>;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthLoading: boolean;
}

export default function HallSelection({
  halls,
  isLoading = false,
  onEnterHall,
  onCreateHall,
  onLoadDemo,
  user,
  onSignIn,
  onSignOut,
  isAuthLoading,
}: HallSelectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHallName, setNewHallName] = useState('');
  const [newHallDesc, setNewHallDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleCreate = async () => {
    if (!newHallName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateHall(newHallName.trim(), newHallDesc.trim());
      setNewHallName('');
      setNewHallDesc('');
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await onLoadDemo();
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#08090d' }}
    >
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0d1527 100%)', border: '1px solid rgba(99,179,237,0.15)' }}
          >
            <Building2 className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1
              className="text-sm font-bold tracking-[0.2em] uppercase"
              style={{ color: '#e2e8f0', letterSpacing: '0.15em' }}
            >
              TOHID META PORT
            </h1>
            <p className="text-[10px] font-mono tracking-widest" style={{ color: '#4a5568' }}>
              VIRTUAL EXHIBITION PLATFORM
            </p>
          </div>
        </div>

        {/* Auth Button */}
        <div>
          {isAuthLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Admin'}
                  className="w-7 h-7 rounded-full"
                  style={{ border: '1px solid rgba(99,179,237,0.3)' }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold uppercase"
                  style={{ background: '#1a2744', color: '#90cdf4', border: '1px solid rgba(99,179,237,0.3)' }}
                >
                  {user.email?.substring(0, 1)}
                </div>
              )}
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer"
                style={{ color: '#718096', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#718096'; }}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer"
              style={{ color: '#90cdf4', border: '1px solid rgba(99,179,237,0.25)', background: 'rgba(99,179,237,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.05)'; }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-6 py-10">
        {/* Hero */}
        <div className="max-w-5xl mx-auto mb-12 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: '#e2e8f0', letterSpacing: '-0.01em' }}
          >
            Virtual Exhibition Platform
          </h2>
          <p className="text-sm font-mono" style={{ color: '#4a5568' }}>
            Select a hall to enter the immersive 3D space
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            /* Loading — wait for Firebase, never flash default data */
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#4a7fa5' }} />
              <p className="text-xs font-mono tracking-widest" style={{ color: '#2d3748' }}>
                Loading halls…
              </p>
            </div>
          ) : halls.length === 0 ? (
            /* Empty state — only shown after Firebase confirms no halls exist */
            <div
              className="text-center py-20 rounded-xl border"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#2d3748' }} />
              <p className="text-base font-semibold mb-1" style={{ color: '#718096' }}>
                No exhibition halls yet
              </p>
              <p className="text-xs font-mono mb-6" style={{ color: '#2d3748' }}>
                {user
                  ? 'Create a new hall or load demo data to get started'
                  : 'Sign in as admin to create and manage halls'}
              </p>
              {user ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer"
                    style={{ background: 'rgba(99,179,237,0.1)', color: '#90cdf4', border: '1px solid rgba(99,179,237,0.25)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Hall
                  </button>
                  <button
                    onClick={handleLoadDemo}
                    disabled={isLoadingDemo}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.03)', color: '#718096', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {isLoadingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Load Demo Halls
                  </button>
                </div>
              ) : (
                <button
                  onClick={onSignIn}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer mx-auto"
                  style={{ background: 'rgba(99,179,237,0.12)', color: '#90cdf4', border: '1px solid rgba(99,179,237,0.3)' }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In as Admin
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Hall grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {halls.map((hall) => (
                  <div
                    key={hall.id}
                    className="rounded-xl flex flex-col transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,179,237,0.2)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                    }}
                  >
                    <div className="p-5 flex-1">
                      {/* Hall name */}
                      <h3
                        className="text-base font-bold mb-2 leading-snug"
                        style={{ color: '#e2e8f0' }}
                      >
                        {hall.name}
                      </h3>

                      {/* Description */}
                      {hall.description && (
                        <p
                          className="text-xs leading-relaxed mb-4"
                          style={{ color: '#4a5568' }}
                        >
                          {hall.description}
                        </p>
                      )}

                      {/* Dimensions badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(99,179,237,0.07)', color: '#4a7fa5', border: '1px solid rgba(99,179,237,0.12)' }}
                        >
                          {hall.width}m &times; {hall.depth}m
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(255,255,255,0.03)', color: '#2d3748', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          H: {hall.height}m
                        </span>
                      </div>
                    </div>

                    {/* Enter button */}
                    <div
                      className="px-5 pb-5"
                    >
                      <button
                        onClick={() => onEnterHall(hall)}
                        className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
                        style={{ background: 'rgba(99,179,237,0.1)', color: '#90cdf4', border: '1px solid rgba(99,179,237,0.2)' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.18)';
                          (e.currentTarget as HTMLButtonElement).style.color = '#bee3f8';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.1)';
                          (e.currentTarget as HTMLButtonElement).style.color = '#90cdf4';
                        }}
                      >
                        Enter Hall
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Create New Hall card — admins only */}
                {user && !showCreateForm && (
                  <div
                    className="rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer transition-all duration-200 min-h-[180px]"
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px dashed rgba(255,255,255,0.08)',
                    }}
                    onClick={() => setShowCreateForm(true)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,179,237,0.2)';
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,179,237,0.03)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.01)';
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style={{ background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.15)' }}
                    >
                      <Plus className="w-5 h-5" style={{ color: '#4a7fa5' }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#4a5568' }}>
                      Create New Hall
                    </p>
                    <p className="text-[10px] font-mono text-center" style={{ color: '#2d3748' }}>
                      Add a new exhibition hall
                    </p>
                  </div>
                )}

                {/* Inline create form */}
                {user && showCreateForm && (
                  <div
                    className="rounded-xl p-5 flex flex-col gap-4"
                    style={{
                      background: 'rgba(99,179,237,0.04)',
                      border: '1px solid rgba(99,179,237,0.2)',
                    }}
                  >
                    <h3 className="text-sm font-bold" style={{ color: '#90cdf4' }}>
                      New Exhibition Hall
                    </h3>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5" style={{ color: '#4a5568' }}>
                        Hall Name
                      </label>
                      <input
                        type="text"
                        value={newHallName}
                        onChange={e => setNewHallName(e.target.value)}
                        placeholder="e.g. Technology & Innovation Hall"
                        className="w-full text-sm px-3 py-2 rounded-md outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#e2e8f0',
                        }}
                        onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(99,179,237,0.4)'; }}
                        onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5" style={{ color: '#4a5568' }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={newHallDesc}
                        onChange={e => setNewHallDesc(e.target.value)}
                        placeholder="Brief description of this hall"
                        className="w-full text-sm px-3 py-2 rounded-md outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#e2e8f0',
                        }}
                        onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(99,179,237,0.4)'; }}
                        onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={handleCreate}
                        disabled={isCreating || !newHallName.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                        style={{ background: 'rgba(99,179,237,0.15)', color: '#90cdf4', border: '1px solid rgba(99,179,237,0.3)' }}
                      >
                        {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Create
                      </button>
                      <button
                        onClick={() => { setShowCreateForm(false); setNewHallName(''); setNewHallDesc(''); }}
                        className="px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer"
                        style={{ color: '#4a5568', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Load Demo button — authenticated, below grid */}
              {user && halls.length === 0 && (
                <div className="text-center mt-4">
                  <button
                    onClick={handleLoadDemo}
                    disabled={isLoadingDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer disabled:opacity-40"
                    style={{ color: '#4a5568', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    {isLoadingDemo ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Load Demo Halls
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
