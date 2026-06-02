import React, { useState } from 'react';
import {
  Sparkles, ChevronRight, ChevronLeft, Check,
  Loader2, Minus, Plus, Building2, LayoutGrid
} from 'lucide-react';
import { Booth, Hall } from '../types';
import { computeAutoLayout } from '../utils/autoLayout';
import { db } from '../lib/firebase';
import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';

// ─── Placeholder data pools ───────────────────────────────────────────────────
const COLORS = [
  '#e82127','#4285f4','#1f9e5c','#7b2d8b','#f59e0b',
  '#06b6d4','#ef4444','#8b5cf6','#10b981','#f97316',
  '#ec4899','#14b8a6','#6366f1','#84cc16','#0ea5e9',
  '#a855f7','#22c55e','#fb923c','#38bdf8','#f43f5e',
];
const CATEGORIES = [
  'Technology & IT','Healthcare & Pharma','Finance & Banking',
  'Manufacturing & Industry','Energy & Sustainability','Retail & E-Commerce',
  'Education & Training','Media & Advertising','Transportation & Logistics',
  'Construction & Real Estate','Food & Beverage','Automotive',
];
const PRESETS: Booth['stylePreset'][] = ['modern','futuristic','minimalist','classic'];
const PREFIXES = [
  'Nova','Apex','Prime','Alpha','Nexus','Pulse','Edge','Core',
  'Sigma','Vega','Atlas','Orbit','Zenith','Axiom','Polar',
  'Titan','Aura','Blaze','Crest','Delta',
];
const SUFFIXES = [
  'Systems','Technologies','Solutions','Group','Industries',
  'Labs','Partners','Global','Innovations','Corp',
];

function generateBooths(count: number, hallId: string): Booth[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: count }, (_, i) => {
    const letter = letters[Math.floor(i / 9)];
    const num = String((i % 9) + 1).padStart(2, '0');
    const prefix = PREFIXES[i % PREFIXES.length];
    const suffix = SUFFIXES[Math.floor(i / PREFIXES.length) % SUFFIXES.length];
    const company = `${prefix} ${suffix}`;
    const cat = CATEGORIES[i % CATEGORIES.length];
    return {
      id: `booth_${hallId}_${i}_${Date.now()}`,
      hallId,
      boothNumber: `${letter}${num}`,
      companyName: company,
      category: cat,
      description: `${company} is a leading provider in the ${cat} sector. Visit our virtual booth to explore products, request demos, and connect directly with our team.`,
      width: 4,
      depth: 3,
      height: 3,
      posX: 0,
      posZ: 0,
      themeColor: COLORS[i % COLORS.length],
      logoUrl: '',
      bannerUrl: '',
      productImageUrl: '',
      websiteUrl: 'https://example.com',
      whatsapp: '',
      videoUrl: '',
      stylePreset: PRESETS[i % PRESETS.length],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

function calcPreview(count: number) {
  if (count === 0) return { cols: 0, rows: 0, hallW: 0, hallD: 0 };
  const cellW = 4, cellD = 3, aisleW = 3.5, aisleD = 4, margin = 3;
  const cols = Math.max(1, Math.round(Math.sqrt(count * (4 / 3))));
  const rows = Math.ceil(count / cols);
  const hallW = Math.ceil(cols * cellW + (cols - 1) * aisleW + 2 * margin);
  const hallD = Math.ceil(rows * cellD + (rows - 1) * aisleD + 2 * margin);
  return { cols, rows, hallW, hallD };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface QuickSetupWizardProps {
  hall: Hall;
  onUpdateHall: (hall: Hall) => void;
  onUpdateBooths: (booths: Booth[]) => void;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function QuickSetupWizard({
  hall,
  onUpdateHall,
  onUpdateBooths,
  onClose,
}: QuickSetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [boothCount, setBoothCount] = useState(10);
  const [hallName, setHallName] = useState(hall.name);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const preview = calcPreview(boothCount);

  const changeCount = (delta: number) => {
    setBoothCount(c => Math.max(1, Math.min(200, c + delta)));
  };

  // ── Step 3: build everything ─────────────────────────────────────────────
  const handleBuild = async () => {
    setBuilding(true);
    setProgress(0);
    setErrorMsg(null);

    try {
      // 1. Read existing booths (to delete them)
      const boothsSnap = await getDocs(collection(db, 'halls', hall.id, 'booths'));
      setProgress(10);

      // 2. Generate new booths + auto-layout (pure local computation)
      const rawBooths = generateBooths(boothCount, hall.id);
      const newHallBase: Hall = { ...hall, name: hallName.trim() || hall.name };
      const { booths: arranged, hall: newHall } = computeAutoLayout(rawBooths, newHallBase);
      setProgress(25);

      // 3. Commit everything in atomic WriteBatch chunks (Firestore limit = 500 ops/batch)
      //    We chunk at 400 to leave headroom for the hall doc + deletes.
      const MAX_OPS = 400;
      let currentBatch = writeBatch(db);
      let opCount = 0;
      const batches: ReturnType<typeof writeBatch>[] = [currentBatch];

      const addOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
        if (opCount >= MAX_OPS) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          opCount = 0;
        }
        fn(currentBatch);
        opCount++;
      };

      // Delete old booths
      boothsSnap.docs.forEach(d => addOp(b => b.delete(d.ref)));

      // Write hall doc
      addOp(b => b.set(doc(db, 'halls', hall.id), newHall));

      // Write new booth docs
      arranged.forEach(booth =>
        addOp(b => b.set(doc(db, 'halls', hall.id, 'booths', booth.id), booth))
      );

      setProgress(40);

      // Commit each batch sequentially and update progress
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        setProgress(40 + Math.round(((i + 1) / batches.length) * 58));
      }

      onUpdateHall(newHall);
      onUpdateBooths(arranged);
      setProgress(100);
      setDone(true);

    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const raw  = (err as { message?: string }).message ?? String(err);

      let friendly = `خطا: ${raw}`;
      if (code === 'permission-denied') {
        friendly = 'دسترسی رد شد (permission-denied).\n\nدر Firebase Console → Firestore → Rules این قانون را اضافه کنید:\nallow write: if request.auth != null;';
      } else if (code === 'unauthenticated') {
        friendly = 'برای ذخیره در Firebase باید وارد حساب ادمین شوید.';
      } else if (code === 'unavailable' || raw.includes('offline')) {
        friendly = 'اتصال به Firebase برقرار نیست. اینترنت را بررسی کنید.';
      } else if (code === 'not-found') {
        friendly = 'سالن در Firebase پیدا نشد. ابتدا سالن را ذخیره کنید.';
      }

      console.error('[QuickSetupWizard]', code, raw);
      setErrorMsg(friendly);
      setBuilding(false);
      setStep(2); // برگشت به مرحله ۲ تا کاربر دوباره تلاش کند
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!building ? onClose : undefined} />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-0 md:mx-4 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden border border-[#E0E4E8]">

        {/* Progress bar */}
        <div className="h-1 bg-[#F0F2F5]">
          <div
            className="h-full bg-[#1A1D21] transition-all duration-500"
            style={{ width: building ? `${progress}%` : step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#F0F2F5] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#F0F2F5]">
            <Sparkles className="w-4 h-4 text-[#1A1D21]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase">Quick Hall Setup</p>
            <h2 className="text-sm font-bold text-[#1A1D21] leading-tight truncate">
              {step === 1 && 'تعداد غرفه'}
              {step === 2 && 'نام سالن'}
              {step === 3 && (done ? 'آماده شد!' : 'در حال ساخت...')}
            </h2>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            {step}/3
          </span>
        </div>

        {/* ── STEP 1: Booth count ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <p className="text-xs text-neutral-500 font-mono text-center">
              چند غرفه می‌خواهید در این سالن داشته باشید؟
            </p>

            {/* Counter */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => changeCount(-1)}
                className="w-11 h-11 rounded-xl bg-[#F0F2F5] hover:bg-[#E0E4E8] flex items-center justify-center transition-all cursor-pointer border border-[#E0E4E8]"
              >
                <Minus className="w-4 h-4 text-[#1A1D21]" />
              </button>

              <input
                type="number"
                value={boothCount}
                onChange={e => setBoothCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                className="w-24 text-center text-3xl font-bold text-[#1A1D21] bg-[#F8F9FA] border border-[#E0E4E8] rounded-xl py-2.5 focus:outline-none focus:border-[#1A1D21]"
              />

              <button
                onClick={() => changeCount(1)}
                className="w-11 h-11 rounded-xl bg-[#F0F2F5] hover:bg-[#E0E4E8] flex items-center justify-center transition-all cursor-pointer border border-[#E0E4E8]"
              >
                <Plus className="w-4 h-4 text-[#1A1D21]" />
              </button>
            </div>

            {/* Quick-select pills */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[5, 10, 20, 30, 50, 100].map(n => (
                <button
                  key={n}
                  onClick={() => setBoothCount(n)}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all cursor-pointer ${
                    boothCount === n
                      ? 'bg-[#1A1D21] text-white border-[#1A1D21]'
                      : 'bg-white text-neutral-500 border-[#E0E4E8] hover:border-neutral-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Live preview */}
            {boothCount > 0 && (
              <div className="bg-[#F8F9FA] border border-[#E0E4E8] rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest text-center font-bold">
                  پیش‌نمایش سالن
                </p>
                <div className="flex items-center justify-center gap-6 text-center">
                  <div>
                    <p className="text-lg font-bold text-[#1A1D21]">{preview.cols} × {preview.rows}</p>
                    <p className="text-[9px] font-mono text-neutral-400 uppercase">ستون × ردیف</p>
                  </div>
                  <div className="w-px h-8 bg-[#E0E4E8]" />
                  <div>
                    <p className="text-lg font-bold text-[#1A1D21]">{preview.hallW}m × {preview.hallD}m</p>
                    <p className="text-[9px] font-mono text-neutral-400 uppercase">ابعاد سالن</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={boothCount < 1}
              className="w-full flex items-center justify-center gap-2 bg-[#1A1D21] hover:bg-[#2C3036] disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all text-sm"
            >
              بعدی <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Hall name ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <p className="text-xs text-neutral-500 font-mono text-center">
              اسم این سالن نمایشگاه را بنویسید
            </p>

            {/* Error display — shown when Firebase write fails */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                  ⚠️ خطا در ذخیره‌سازی
                </p>
                <p className="text-[11px] text-red-500 whitespace-pre-line leading-relaxed">
                  {errorMsg}
                </p>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-[10px] font-mono text-red-400 underline cursor-pointer"
                >
                  بستن
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">
                نام سالن
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={hallName}
                  onChange={e => setHallName(e.target.value)}
                  placeholder="Innovation & Technology Hall"
                  className="w-full border border-[#E0E4E8] bg-[#F8F9FA] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1A1D21] placeholder-neutral-400 focus:outline-none focus:border-[#1A1D21] transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Summary card */}
            <div className="bg-[#F8F9FA] border border-[#E0E4E8] rounded-xl p-4 space-y-2">
              {[
                { label: 'نام سالن', value: hallName.trim() || '—' },
                { label: 'تعداد غرفه', value: `${boothCount} غرفه` },
                { label: 'چیدمان', value: `${preview.cols} ستون × ${preview.rows} ردیف` },
                { label: 'ابعاد سالن', value: `${preview.hallW}m × ${preview.hallD}m` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-neutral-400">{row.label}</span>
                  <span className="font-bold text-[#1A1D21]">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#F0F2F5] hover:bg-[#E0E4E8] text-neutral-600 font-bold py-3 rounded-xl transition-all text-sm border border-[#E0E4E8] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> قبلی
              </button>
              <button
                onClick={() => { setStep(3); handleBuild(); }}
                disabled={!hallName.trim()}
                className="flex-2 flex-1 flex items-center justify-center gap-2 bg-[#1A1D21] hover:bg-[#2C3036] disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> ساخت نمایشگاه
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Building ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="p-6 space-y-6">
            {!done ? (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-10 h-10 text-[#1A1D21] animate-spin" />
                  <p className="text-sm font-bold text-[#1A1D21]">
                    در حال ساخت {boothCount} غرفه...
                  </p>
                  <p className="text-xs text-neutral-400 font-mono">{progress}% کامل شد</p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1A1D21] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="space-y-2 text-xs font-mono text-neutral-400">
                  {progress >= 15  && <p className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> غرفه‌های قبلی پاک شدن</p>}
                  {progress >= 35  && <p className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> {boothCount} غرفه تولید شد</p>}
                  {progress >= 50  && <p className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> چیدمان خودکار اعمال شد</p>}
                  {progress >= 100 && <p className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> ذخیره در Firebase</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-[#1A1D21] text-center">
                    {boothCount} غرفه با موفقیت ساخته شد!
                  </p>
                  <p className="text-xs text-neutral-400 font-mono text-center">
                    اطلاعات پیش‌فرض قرار داده شده — ویرایش کنید
                  </p>
                </div>

                {/* What's next */}
                <div className="bg-[#F8F9FA] border border-[#E0E4E8] rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">مراحل بعدی</p>
                  {[
                    'روی هر غرفه کلیک کنید و اطلاعات شرکت را ویرایش کنید',
                    'لوگو، بنر و لینک‌ها را اضافه کنید',
                    'از دکمه Edit (✏️) در لیست غرفه‌ها استفاده کنید',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-neutral-500">
                      <span className="font-mono font-bold text-neutral-400 shrink-0">{i + 1}.</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 bg-[#1A1D21] hover:bg-[#2C3036] text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <LayoutGrid className="w-4 h-4" /> مشاهده غرفه‌ها
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
