import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building,
  Building2,
  Map,
  Settings,
  ShieldCheck,
  LogIn,
  LogOut,
  Sparkles,
  Compass,
  Search,
  Info,
  HelpCircle,
  Smartphone,
  Tv,
  Box,
  CornerDownRight,
  ChevronLeft,
  Loader2
} from 'lucide-react';

import { Hall, Booth } from './types';
import { DEFAULT_HALL, DEFAULT_BOOTHS, DEFAULT_HALLS } from './data/defaultTemplates';
import { db, auth, googleAuthProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

// Lightweight components — loaded immediately
import HallSelection from './components/HallSelection';
import VisitorControls from './components/VisitorControls';
import BuilderLoginModal from './components/BuilderLoginModal';

// Heavy 3D components — lazy loaded only when user enters a hall
// This keeps the landing page bundle tiny (no Three.js on initial load)
const ExhibitionCanvas = lazy(() => import('./components/ExhibitionCanvas'));
const AdminPanel       = lazy(() => import('./components/AdminPanel'));
const BoothModal       = lazy(() => import('./components/BoothModal'));

// Shown while 3D scene is initialising (covers the full hall view)
function HallLoadingScreen({ name }: { name: string }) {
  return (
    <div className="fixed inset-0 bg-[#08090d] flex flex-col items-center justify-center gap-4 z-50">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
      <p className="text-white font-mono text-sm tracking-widest uppercase opacity-70">
        Loading {name}…
      </p>
    </div>
  );
}

export default function App() {
  const [appView, setAppView] = useState<'selecting' | 'inside-hall'>('selecting');
  const [halls, setHalls] = useState<Hall[]>([]);
  const [hallsLoading, setHallsLoading] = useState(true); // true until first Firebase snapshot
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [showBuilderLogin, setShowBuilderLogin] = useState(false);

  const [activeView, setActiveView] = useState<'visitor' | 'admin'>('visitor');
  const [hall, setHall] = useState<Hall>(DEFAULT_HALL);
  const [booths, setBooths] = useState<Booth[]>(DEFAULT_BOOTHS);
  const [activeBoothId, setActiveBoothId] = useState<string | null>(null);

  // Starting visitor camera position relative to the centerpiece Apple booth (0,0)
  const [visitorPos, setVisitorPos] = useState<[number, number, number]>([0, 0.8, 8]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

  // Monitor Google Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load all halls — set hallsLoading=false after first snapshot so we never flash defaults
  useEffect(() => {
    const ref = collection(db, 'halls');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const loaded: Hall[] = [];
        snap.forEach(d => loaded.push(d.data() as Hall));
        setHalls(loaded);
        setHallsLoading(false);
      },
      () => {
        setHalls([]);
        setHallsLoading(false);
      }
    );
    return unsub;
  }, []);

  // Load hall + booths when selectedHallId changes
  useEffect(() => {
    if (!selectedHallId) return;

    const hallRef = doc(db, 'halls', selectedHallId);
    const unsubHall = onSnapshot(hallRef, (snap) => {
      if (snap.exists()) setHall(snap.data() as Hall);
      else setHall(DEFAULT_HALL);
    }, () => setHall(DEFAULT_HALL));

    const boothsRef = collection(db, 'halls', selectedHallId, 'booths');
    const unsubBooths = onSnapshot(boothsRef, (snap) => {
      const b: Booth[] = [];
      snap.forEach(d => b.push(d.data() as Booth));
      setBooths(b.length > 0 ? b : selectedHallId === 'main_hall' ? DEFAULT_BOOTHS : []);
    }, () => setBooths(selectedHallId === 'main_hall' ? DEFAULT_BOOTHS : []));

    return () => { unsubHall(); unsubBooths(); };
  }, [selectedHallId]);

  // Google Sign In trigger for Admins
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (e) {
      console.error("Sign-in failed: ", e);
      alert("Sign In aborted. You can still use the Demo bypass controls to construct and manage booths locally!");
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed: ", e);
    }
  };

  // Enter a specific hall
  const handleEnterHall = (h: Hall) => {
    setSelectedHallId(h.id);
    setHall(h);
    setBooths([]);
    setActiveBoothId(null);
    setSelectedBooth(null);
    setAppView('inside-hall');
  };

  // Create a new hall and enter it
  const handleCreateHall = async (name: string, description: string) => {
    const id = `hall_${Date.now()}`;
    const newHall: Hall = {
      id,
      name,
      description,
      width: 30,
      depth: 22,
      height: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'halls', id), newHall);
      handleEnterHall(newHall);
    } catch (e) {
      console.error(e);
    }
  };

  // Load demo halls and booths into Firestore
  const handleLoadDemo = async () => {
    if (!user) { alert('Please sign in to load demo data.'); return; }
    if (!confirm('Load demo halls and booths? This will add sample data to your database.')) return;
    try {
      await setDoc(doc(db, 'halls', 'main_hall'), DEFAULT_HALL);
      for (const booth of DEFAULT_BOOTHS) {
        await setDoc(doc(db, 'halls', 'main_hall', 'booths', booth.id), booth);
      }
      alert('Demo data loaded!');
    } catch (e) {
      console.error(e);
    }
  };

  // Pre-populate empty cloud database with custom stock blueprint templates inside Firestore
  const handleInitializeDemoData = async () => {
    if (!user) {
      alert("Please sign in first (or click the mock admin button) to allow writing initial templates to Firestore. Anonymous writes are protected.");
      return;
    }

    if (!confirm("This will save 5 beautiful template stands to your real-time cloud database. Proceed?")) return;

    const hallId = selectedHallId || 'main_hall';

    try {
      // 1. Save Hall
      await setDoc(doc(db, 'halls', hallId), hallId === 'main_hall' ? DEFAULT_HALL : hall);

      // 2. Save each booth
      for (const booth of DEFAULT_BOOTHS) {
        await setDoc(doc(db, 'halls', hallId, 'booths', booth.id), { ...booth, hallId });
      }
      alert("Cloud exhibition hall primed with high-fidelity template booths successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `halls/${hallId}`);
    }
  };

  // Stable reference — prevents MemoBoothStructure from re-rendering on every visitor move
  const handleSelectBooth = useCallback((booth: Booth) => {
    setSelectedBooth(booth);
    setActiveBoothId(booth.id);
  }, []);

  // Hall selection screen
  if (appView === 'selecting') {
    return (
      <>
        <HallSelection
          halls={halls}                          // only real Firebase data — no flash of defaults
          isLoading={hallsLoading}               // show spinner until first snapshot arrives
          onEnterHall={handleEnterHall}
          onCreateHall={handleCreateHall}
          onLoadDemo={handleLoadDemo}
          user={user}
          onSignIn={() => setShowBuilderLogin(true)}  // email/password modal, same as inside-hall
          onSignOut={handleSignOut}
          isAuthLoading={isAuthLoading}
        />

        {/* Builder login works on the landing page too */}
        <BuilderLoginModal
          isOpen={showBuilderLogin}
          onClose={() => setShowBuilderLogin(false)}
          onSuccess={() => setShowBuilderLogin(false)}
        />
      </>
    );
  }

  // Inside-hall view
  return (
    <div id="application-root" className="fixed inset-0 bg-[#F0F2F5] font-sans flex flex-col md:flex-row overflow-hidden text-[#1A1D21] select-none">

      {/* LEFT COLUMN/SIDEBAR: Visitor Controls OR Admin Panel */}
      <aside
        id="control-column-sidebar"
        className="w-full md:w-[360px] lg:w-[400px] shrink-0 border-r border-[#E0E4E8] bg-white shadow-xl flex flex-col h-[40%] md:h-full z-10 overflow-hidden"
      >

        {/* Core Header Masthead */}
        <div className="p-5 border-b border-[#E0E4E8] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Back to halls button */}
            <button
              onClick={() => setAppView('selecting')}
              className="p-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E0E4E8] text-neutral-600 hover:text-[#1A1D21] border border-[#E0E4E8] transition-all cursor-pointer shrink-0"
              title="Back to Hall Selection"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="p-2.5 rounded-lg bg-[#1A1D21] text-white shadow-sm">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight font-sans text-[#1A1D21] uppercase flex items-center gap-1.5">
                EXPO ENGINE v1.0
              </h1>
              <p className="text-[10px] text-neutral-500 font-mono tracking-wider font-bold">
                DESIGN HALL VISUALIZER
              </p>
            </div>
          </div>

          {/* Authentication State Profile Badge */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Admin'}
                    className="w-7 h-7 rounded-full border border-[#E0E4E8] shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded bg-[#1A1D21] flex items-center justify-center font-mono text-xs text-white uppercase border border-[#E0E4E8]">
                    {user.email?.substring(0, 1)}
                  </div>
                )}
                <button
                  id="admin-sign-out-btn"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-md bg-white hover:bg-neutral-50 text-neutral-500 hover:text-[#1A1D21] border border-[#E0E4E8] transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="admin-sign-in-btn"
                onClick={() => setShowBuilderLogin(true)}
                className="flex items-center gap-1.5 bg-[#1A1D21] hover:bg-[#2C3036] text-white px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-all cursor-pointer border border-[#1A1D21]"
                title="ورود به Builder Mode"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Builder Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Nav Mode selector toggles */}
        <div className="px-5 py-3 border-b border-[#E0E4E8] bg-[#F0F2F5] flex items-center gap-2 shrink-0 select-none">
          <button
            id="view-visitor-toggle"
            onClick={() => setActiveView('visitor')}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer uppercase tracking-wider ${
              activeView === 'visitor'
                ? 'bg-[#1A1D21] text-white border-[#1A1D21] shadow'
                : 'bg-white text-neutral-500 border-[#E0E4E8] hover:text-[#1A1D21]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Visitor Mode</span>
          </button>

          <button
            id="view-admin-toggle"
            onClick={() => {
              if (!user) {
                // Not logged in → show login modal first
                setShowBuilderLogin(true);
              } else {
                setActiveView('admin');
              }
            }}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer uppercase tracking-wider ${
              activeView === 'admin' && user
                ? 'bg-[#1A1D21] text-white border-[#1A1D21] shadow'
                : 'bg-white text-neutral-500 border-[#E0E4E8] hover:text-[#1A1D21]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Builder Panel</span>
            {!user && <LogIn className="w-3 h-3 opacity-50" />}
          </button>
        </div>

        {/* Core Side content modules */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'visitor' ? (
            <VisitorControls
              hall={hall}
              booths={booths}
              activeBoothId={activeBoothId}
              onSelectBooth={handleSelectBooth}
              visitorPos={visitorPos}
              setVisitorPos={setVisitorPos}
              onAddSampleData={user ? handleInitializeDemoData : undefined}
            />
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Optional sign in prompt for builders to prevent offline failures */}
              {!user && (
                <div className="mx-5 my-3 p-3 bg-neutral-50 border border-[#E0E4E8] rounded-md flex gap-3 select-normal">
                  <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-medium text-neutral-600 leading-normal">
                      Testing locally? You are in draft preview. To save layouts to cloud Firestore, **Sign In** on the top right.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-neutral-400 animate-spin" /></div>}>
                  <AdminPanel
                    hall={hall}
                    booths={booths}
                    onUpdateHall={setHall}
                    onUpdateBooths={setBooths}
                    onSelectBooth={handleSelectBooth}
                    onAddSampleData={handleInitializeDemoData}
                  />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT VIEW: Exhaustive 3D WebGL Exhibition Floor viewport */}
      <main id="primary-render-portal" className="flex-1 h-[60%] md:h-full relative overflow-hidden flex flex-col bg-[#F0F2F5]">

        {/* Floating Top indicators bar overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          {/* Active Exhibition Name Badge */}
          <div className="bg-white/90 text-[#1A1D21] border border-[#E0E4E8] px-4 py-2 rounded-md flex items-center gap-2 shadow-md backdrop-blur-md pointer-events-auto select-none">
            <Building className="w-4 h-4 text-neutral-700 animate-pulse" />
            <div className="leading-none text-left">
              <h4 className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest leading-none font-bold">Exhibition Hall</h4>
              <p className="text-xs font-bold text-[#1A1D21] mt-1 leading-none">
                {hall.name}
              </p>
            </div>
          </div>

          {/* Quick HUD Navigation Assistance */}
          <div className="bg-white/90 text-[#1A1D21] border border-[#E0E4E8] px-3.5 py-2.5 rounded-md flex items-center gap-3.5 text-xs shadow-md backdrop-blur-md pointer-events-auto select-none max-w-sm hidden lg:flex">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1A1D21]">
              <Smartphone className="w-4 h-4" />
              <span>VR READY</span>
            </div>
            <div className="h-4 w-px bg-neutral-200" />
            <p className="text-[10.5px] font-mono text-neutral-500">
              Visitor Pos X: <strong>{visitorPos[0]?.toFixed(1)}m</strong>, Z: <strong>{visitorPos[2]?.toFixed(1)}m</strong>
            </p>
          </div>
        </div>

        {/* Real-time 3D Exhibition Canvas — lazy loaded (Three.js not downloaded until here) */}
        <div className="w-full h-full flex-1 relative">
          <Suspense fallback={<HallLoadingScreen name={hall.name} />}>
            <ExhibitionCanvas
              hall={hall}
              booths={booths}
              activeBoothId={activeBoothId}
              onSelectBooth={handleSelectBooth}
              onCloseBooth={() => { setActiveBoothId(null); setSelectedBooth(null); }}
              visitorPos={visitorPos}
              setVisitorPos={setVisitorPos}
            />
          </Suspense>
        </div>

        {/* Booth Information Modal — lazy loaded */}
        <Suspense fallback={null}>
          <BoothModal
            booth={selectedBooth}
            isOpen={activeBoothId !== null}
            onClose={() => {
              setActiveBoothId(null);
              setSelectedBooth(null);
            }}
          />
        </Suspense>
      </main>

      {/* Builder Mode Login Modal */}
      <BuilderLoginModal
        isOpen={showBuilderLogin}
        onClose={() => setShowBuilderLogin(false)}
        onSuccess={() => {
          setShowBuilderLogin(false);
          setActiveView('admin');
        }}
      />
    </div>
  );
}
