import React, { useState } from 'react';
import { Plus, Trash, Edit3, Settings, Save, Sparkles, FolderClosed, PhoneCall, Link2, Upload, AlertTriangle, Eye, LayoutGrid } from 'lucide-react';
import { Hall, Booth } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { computeAutoLayout } from '../utils/autoLayout';
import QuickSetupWizard from './QuickSetupWizard';

interface AdminPanelProps {
  hall: Hall;
  booths: Booth[];
  onUpdateHall: (hall: Hall) => void;
  onUpdateBooths: (updatedBooths: Booth[]) => void;
  onSelectBooth: (booth: Booth) => void;
  onAddSampleData: () => void;
}

export default function AdminPanel({
  hall,
  booths,
  onUpdateHall,
  onUpdateBooths,
  onSelectBooth,
  onAddSampleData
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'hall' | 'booth-list' | 'booth-form'>('booth-list');
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Hall Form State
  const [hallName, setHallName] = useState(hall.name);
  const [hallWidth, setHallWidth] = useState(hall.width);
  const [hallDepth, setHallDepth] = useState(hall.depth);
  const [hallHeight, setHallHeight] = useState(hall.height);

  // Booth Form State
  const [bId, setBId] = useState('');
  const [bNumber, setBNumber] = useState('');
  const [bCompany, setBCompany] = useState('');
  const [bCategory, setBCategory] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bWidth, setBWidth] = useState(4);
  const [bDepth, setBDepth] = useState(3);
  const [bHeight, setBHeight] = useState(3);
  const [bPosX, setBPosX] = useState(0);
  const [bPosZ, setBPosZ] = useState(0);
  const [bColor, setBColor] = useState('#38bdf8');
  const [bLogo, setBLogo] = useState('');
  const [bBanner, setBBanner] = useState('');
  const [bProductImg, setBProductImg] = useState('');
  const [bWebsite, setBWebsite] = useState('');
  const [bWhatsapp, setBWhatsapp] = useState('');
  const [bVideo, setBVideo] = useState('');
  const [bPreset, setBPreset] = useState<'classic' | 'modern' | 'minimalist' | 'futuristic'>('modern');
  const [customModelFilename, setCustomModelFilename] = useState('');
  const [customModelUrl, setCustomModelUrl] = useState('');

  // Handle Hall Save
  const handleSaveHall = async () => {
    const updated: Hall = {
      ...hall,
      name: hallName,
      width: Number(hallWidth),
      depth: Number(hallDepth),
      height: Number(hallHeight),
      updatedAt: new Date().toISOString()
    };
    
    const docPath = `halls/${hall.id}`;
    try {
      await setDoc(doc(db, 'halls', hall.id), updated);
      onUpdateHall(updated);
      alert('Exhibition hall dimensions saved successfully!');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, docPath);
    }
  };

  // Auto Layout — arrange booths with optimal spacing
  const handleAutoLayout = async () => {
    if (booths.length === 0) { alert('Add some booths first.'); return; }
    if (!confirm(`Auto-arrange ${booths.length} booth${booths.length > 1 ? 's' : ''} with optimal spacing? Hall dimensions will be adjusted to fit.`)) return;
    const { booths: arranged, hall: newHall } = computeAutoLayout(booths, hall);
    try {
      await setDoc(doc(db, 'halls', hall.id), newHall);
      onUpdateHall(newHall);
      await Promise.all(arranged.map(b => setDoc(doc(db, 'halls', hall.id, 'booths', b.id), b)));
      onUpdateBooths(arranged);
      alert(`${arranged.length} booths arranged in ${Math.ceil(Math.sqrt(arranged.length))} columns. Hall resized to ${newHall.width}m × ${newHall.depth}m.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `halls/${hall.id}`);
    }
  };

  // Open Form to Create New Booth
  const handleAddNewBoothClick = () => {
    setSelectedBoothId(null);
    setBId(`booth_${Date.now()}`);
    setBNumber(`A${String(booths.length + 1).padStart(2, '0')}`);
    setBCompany('');
    setBCategory('General Trade');
    setBDesc('');
    setBWidth(4);
    setBDepth(4);
    setBHeight(3.2);
    setBPosX(0);
    setBPosZ(0);
    setBColor('#38bdf8');
    setBLogo('');
    setBBanner('');
    setBProductImg('');
    setBWebsite('');
    setBWhatsapp('');
    setBVideo('');
    setBPreset('modern');
    setCustomModelFilename('');
    setCustomModelUrl('');
    setActiveTab('booth-form');
  };

  // Open Form to Edit Existing Booth
  const handleEditBoothClick = (booth: Booth) => {
    setSelectedBoothId(booth.id);
    setBId(booth.id);
    setBNumber(booth.boothNumber);
    setBCompany(booth.companyName);
    setBCategory(booth.category);
    setBDesc(booth.description);
    setBWidth(booth.width);
    setBDepth(booth.depth);
    setBHeight(booth.height);
    setBPosX(booth.posX);
    setBPosZ(booth.posZ);
    setBColor(booth.themeColor);
    setBLogo(booth.logoUrl || '');
    setBBanner(booth.bannerUrl || '');
    setBProductImg(booth.productImageUrl || '');
    setBWebsite(booth.websiteUrl || '');
    setBWhatsapp(booth.whatsapp || '');
    setBVideo(booth.videoUrl || '');
    setBPreset(booth.stylePreset);
    setCustomModelUrl(booth.modelUrl || '');
    setCustomModelFilename(booth.modelUrl ? 'custom_model.glb' : '');
    setActiveTab('booth-form');
  };

  // Handles dynamic local GLB uploads for immediate 3D visualization inside ThreeJS
  const handleGLBUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomModelUrl(url);
      setCustomModelFilename(file.name);
    }
  };

  // Handles local images uploads (Logo, Banner, Products) as DataURLs
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'banner' | 'product') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (field === 'logo') setBLogo(reader.result);
          if (field === 'banner') setBBanner(reader.result);
          if (field === 'product') setBProductImg(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Delete Booth
  const handleDeleteBooth = async (boothId: string) => {
    if (!confirm('Are you absolutely sure you want to delete this exhibition booth? This cannot be undone.')) return;
    
    const docPath = `halls/${hall.id}/booths/${boothId}`;
    try {
      await deleteDoc(doc(db, 'halls', hall.id, 'booths', boothId));
      const filtered = booths.filter((b) => b.id !== boothId);
      onUpdateBooths(filtered);
      if (selectedBoothId === boothId) {
        setSelectedBoothId(null);
        setActiveTab('booth-list');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, docPath);
    }
  };

  // Save/Publish Booth configurations
  const handleSaveBooth = async () => {
    if (!bCompany.trim()) {
      alert('Please provide a valid company name!');
      return;
    }
    
    // Safety boundaries check
    const maxX = hall.width / 2;
    const maxZ = hall.depth / 2;
    if (Math.abs(bPosX) > maxX || Math.abs(bPosZ) > maxZ) {
      alert(`Safety alert: Your booth coordinates place it outside the exhibition walls. Max values are X: ±${maxX.toFixed(1)}m, Z: ±${maxZ.toFixed(1)}m. Correcting positions...`);
      return;
    }

    const savedBooth: Booth = {
      id: bId,
      hallId: hall.id,
      boothNumber: bNumber,
      companyName: bCompany,
      category: bCategory,
      description: bDesc,
      width: Number(bWidth),
      depth: Number(bDepth),
      height: Number(bHeight),
      posX: Number(bPosX),
      posZ: Number(bPosZ),
      themeColor: bColor,
      logoUrl: bLogo,
      bannerUrl: bBanner,
      productImageUrl: bProductImg,
      websiteUrl: bWebsite || 'https://google.com',
      whatsapp: bWhatsapp || '+15550192837',
      videoUrl: bVideo || 'https://www.w3schools.com/html/mov_bbb.mp4',
      stylePreset: bPreset,
      modelUrl: customModelUrl,
      modelScale: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docPath = `halls/${hall.id}/booths/${savedBooth.id}`;
    try {
      await setDoc(doc(db, 'halls', hall.id, 'booths', savedBooth.id), savedBooth);
      
      let updatedBooths: Booth[];
      if (selectedBoothId) {
        updatedBooths = booths.map((b) => (b.id === savedBooth.id ? savedBooth : b));
      } else {
        updatedBooths = [...booths, savedBooth];
      }
      
      onUpdateBooths(updatedBooths);
      setActiveTab('booth-list');
      alert(`Booth ${bNumber} published inside Firestore database successfully!`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, docPath);
    }
  };

  return (
    <div id="admin-control-dashboard" className="h-full flex flex-col bg-white text-[#1A1D21] p-6 space-y-6 overflow-y-auto">
      
      {/* Dynamic Header */}
      <div className="flex items-center justify-between border-b border-[#E0E4E8] pb-4">
        <div>
          <h2 className="text-lg font-bold font-sans flex items-center gap-2 text-[#1A1D21]">
            <Settings className="w-5 h-5 text-[#1A1D21] animate-spin" style={{ animationDuration: '6s' }} />
            Exhibition Planner
          </h2>
          <p className="text-[10px] text-neutral-400 font-mono mt-1 font-bold">
            Real-time Hall Space & Booth zoning
          </p>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex bg-[#F0F2F5] p-1 rounded-md border border-[#E0E4E8] text-xs font-mono font-semibold select-none">
        <button
          onClick={() => setActiveTab('booth-list')}
          className={`flex-1 py-1.5 rounded transition-all cursor-pointer text-center ${
            activeTab === 'booth-list' ? 'bg-white text-[#1A1D21] shadow-sm font-bold' : 'text-neutral-550 hover:text-[#1A1D21]'
          }`}
        >
          Booth List
        </button>
        <button
          onClick={() => setActiveTab('hall')}
          className={`flex-1 py-1.5 rounded transition-all cursor-pointer text-center ${
            activeTab === 'hall' ? 'bg-white text-[#1A1D21] shadow-sm font-bold' : 'text-neutral-550 hover:text-[#1A1D21]'
          }`}
        >
          Hall Dimensions
        </button>
        <button
          onClick={handleAddNewBoothClick}
          className={`flex-1 py-1.5 rounded transition-all cursor-pointer text-center ${
            activeTab === 'booth-form' && !selectedBoothId ? 'bg-white text-[#1A1D21] shadow-sm font-bold' : 'text-neutral-550 hover:text-[#1A1D21]'
          }`}
        >
          Add Booth
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1">
        {/* A. HALL DIMENSIONS CONFIG */}
        {activeTab === 'hall' && (
          <div className="space-y-5 font-sans">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 font-bold">Exhibition Hall Title</label>
                <input
                  type="text"
                  value={hallName}
                  onChange={(e) => setHallName(e.target.value)}
                  className="w-full bg-white text-[#1A1D21] text-sm px-4 py-2.5 rounded-lg border border-[#E0E4E8] focus:outline-none focus:border-[#1A1D21]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 font-bold">Width (X)</label>
                  <input
                    type="number"
                    value={hallWidth}
                    onChange={(e) => setHallWidth(Number(e.target.value))}
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-lg border border-[#E0E4E8] focus:outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 font-bold">Depth (Z)</label>
                  <input
                    type="number"
                    value={hallDepth}
                    onChange={(e) => setHallDepth(Number(e.target.value))}
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-lg border border-[#E0E4E8] focus:outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2 font-bold">Height (Y)</label>
                  <input
                    type="number"
                    value={hallHeight}
                    onChange={(e) => setHallHeight(Number(e.target.value))}
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-lg border border-[#E0E4E8] focus:outline-none text-center"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveHall}
              className="w-full bg-[#1A1D21] hover:bg-[#2C3036] text-white font-semibold text-sm py-3 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Apply & Save Hall scale</span>
            </button>

            {/* Auto Layout */}
            <div className="border border-[#E0E4E8] rounded-md p-4 bg-[#F8F9FA]">
              <div className="flex items-start gap-3 mb-3">
                <LayoutGrid className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#1A1D21]">Auto-Arrange All Booths</p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    Calculates optimal positions for all {booths.length} booths
                  </p>
                </div>
              </div>
              <button
                onClick={handleAutoLayout}
                className="w-full bg-white hover:bg-neutral-50 text-[#1A1D21] border border-[#E0E4E8] font-semibold text-xs py-2.5 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Auto-Arrange All Booths</span>
              </button>
            </div>
          </div>
        )}        {/* B. BOOTHS DIRECTORIES */}
        {activeTab === 'booth-list' && (
          <div className="space-y-4">

            {/* ── Quick Setup banner ─────────────────────────────────────── */}
            <button
              onClick={() => setShowWizard(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[#1A1D21] hover:bg-[#2C3036] text-white transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-white/10">
                <Sparkles className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-bold tracking-wide">Quick Hall Setup</p>
                <p className="text-[10px] text-white/50 font-mono">
                  {booths.length > 0
                    ? `${booths.length} غرفه موجود — بازسازی با wizard`
                    : 'تعداد غرفه را بزن، بقیه خودکار می‌شه'}
                </p>
              </div>
              <Plus className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
            </button>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
                Manage Space Zones
              </span>
            </div>

            {booths.length > 0 ? (
              <div className="space-y-2.5">
                {booths.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-white border border-[#E0E4E8] rounded-md flex items-center justify-between group hover:border-neutral-400"
                  >
                    <div className="min-w-0 flex-1 cursor-pointer pr-4" onClick={() => onSelectBooth(b)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-[#F0F2F5] text-neutral-600 px-1.5 py-0.5 rounded uppercase border border-[#E0E4E8]">
                          {b.boothNumber}
                        </span>
                        <h4 className="text-sm font-bold text-[#1A1D21] truncate group-hover:text-neutral-500 transition-colors">
                          {b.companyName}
                        </h4>
                      </div>
                      <p className="text-[10px] font-mono text-neutral-400 mt-1 font-bold uppercase tracking-wider">
                        X: {b.posX}m, Z: {b.posZ}m • Dimensions: {b.width}m × {b.depth}m
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditBoothClick(b)}
                        className="p-2 rounded-md bg-white border border-[#E0E4E8] hover:bg-[#F0F2F5] text-[#1A1D21] transition-all cursor-pointer"
                        title="Edit stall details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBooth(b.id)}
                        className="p-2 rounded-md bg-white border border-[#E0E4E8] text-red-500 hover:bg-neutral-50 transition-all cursor-pointer"
                        title="Delete space"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-[#E0E4E8] rounded-md bg-[#F8F9FA]">
                <p className="text-sm text-neutral-400 font-mono">No booths exist inside the hall plan</p>
                <div className="flex flex-col gap-2 mt-4 px-6">
                  <button
                    onClick={handleAddNewBoothClick}
                    className="text-xs bg-[#1A1D21] hover:bg-[#2C3036] text-white font-semibold py-2 rounded-md transition-all font-mono"
                  >
                    Set up custom Booth
                  </button>
                  <button
                    onClick={onAddSampleData}
                    className="text-xs bg-white hover:bg-neutral-50 text-[#1A1D21] font-semibold py-2 rounded border border-[#E0E4E8] transition-all font-mono"
                  >
                    Load Default Blueprint Template
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* C. EDIT / ADD BOOTH FORM */}
        {activeTab === 'booth-form' && (
          <div className="space-y-6 font-sans pb-6">
            <div className="flex items-center justify-between border-b border-[#E0E4E8] pb-3">
              <h3 className="text-sm font-bold text-[#1A1D21] flex items-center gap-1.5 font-mono uppercase tracking-wider">
                {selectedBoothId ? 'Configuring Stand' : 'New Space Zone'}
              </h3>
              <button
                onClick={() => setActiveTab('booth-list')}
                className="text-xs font-mono text-neutral-500 hover:text-[#1A1D21] cursor-pointer font-bold"
              >
                Cancel
              </button>
            </div>

            {/* FORM INPUTS */}
            <div className="space-y-4">
              {/* Company & Number */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Company Name</label>
                  <input
                    type="text"
                    required
                    value={bCompany}
                    onChange={(e) => setBCompany(e.target.value)}
                    placeholder="e.g. Lockheed Space"
                    className="w-full bg-white text-[#1A1D21] text-sm px-3.5 py-2.5 rounded-md border border-[#E0E4E8] focus:outline-none focus:border-[#1A1D21]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Booth No.</label>
                  <input
                    type="text"
                    value={bNumber}
                    onChange={(e) => setBNumber(e.target.value)}
                    placeholder="A01"
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-md border border-[#E0E4E8] text-center font-mono focus:outline-none focus:border-[#1A1D21]"
                  />
                </div>
              </div>

              {/* Category & Style Preset */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Industry Category</label>
                  <input
                    type="text"
                    value={bCategory}
                    onChange={(e) => setBCategory(e.target.value)}
                    placeholder="e.g. AI & Robotics"
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-md border border-[#E0E4E8] focus:outline-none focus:border-[#1A1D21]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Style Preset</label>
                  <select
                    value={bPreset}
                    onChange={(e: any) => setBPreset(e.target.value)}
                    className="w-full bg-white text-[#1A1D21] text-sm px-3 py-2.5 rounded-md border border-[#E0E4E8] focus:outline-none font-sans cursor-pointer focus:border-[#1A1D21]"
                  >
                    <option value="classic">Classic Stand</option>
                    <option value="modern">Modern Suite</option>
                    <option value="minimalist">Minimalist Podium</option>
                    <option value="futuristic">Futuristic Dome</option>
                  </select>
                </div>
              </div>

              {/* Theme Color, description */}
              <div className="grid grid-cols-4 gap-4 items-end">
                <div className="col-span-3">
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Exhibitor Pitch Profile</label>
                  <textarea
                    rows={2}
                    value={bDesc}
                    onChange={(e) => setBDesc(e.target.value)}
                    placeholder="Briefly pitch company trade items..."
                    className="w-full bg-white text-[#1A1D21] text-xs px-3 py-2 rounded-md border border-[#E0E4E8] focus:outline-none focus:border-[#1A1D21]"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Theme Color</label>
                  <input
                    type="color"
                    value={bColor}
                    onChange={(e) => setBColor(e.target.value)}
                    className="w-10 h-10 bg-transparent border-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* SIZES ZONE */}
              <div className="p-4 bg-[#F8F9FA] border border-[#E0E4E8] rounded-md space-y-4">
                <h4 className="text-[11px] font-mono font-bold text-[#1A1D21] uppercase tracking-widest">
                  Stand Geometry Measurements (meters)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-550 uppercase mb-1 font-bold">Width (X)</label>
                    <input
                      type="number"
                      value={bWidth}
                      onChange={(e) => setBWidth(Number(e.target.value))}
                      className="w-full bg-white border border-[#E0E4E8] text-xs rounded p-2 text-center text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-550 uppercase mb-1 font-bold">Depth (Z)</label>
                    <input
                      type="number"
                      value={bDepth}
                      onChange={(e) => setBDepth(Number(e.target.value))}
                      className="w-full bg-white border border-[#E0E4E8] text-xs rounded p-2 text-center text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-550 uppercase mb-1 font-bold">Height (Y)</label>
                    <input
                      type="number"
                      value={bHeight}
                      onChange={(e) => setBHeight(Number(e.target.value))}
                      className="w-full bg-white border border-[#E0E4E8] text-xs rounded p-2 text-center text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* COORDINATES LIVE PLACEMENT ZONE */}
              <div className="p-4 bg-[#F8F9FA] border border-[#E0E4E8] rounded-md space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-mono font-bold text-[#1A1D21] uppercase tracking-widest">
                    3D World Coordinates Layout
                  </h4>
                  <span className="text-[9px] font-mono text-neutral-455">
                    Floor grid center is (0,0)
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-neutral-500 font-bold">Position X (Horizontal slider)</span>
                      <span className="text-[#1A1D21] font-bold">{bPosX}m</span>
                    </div>
                    <input
                      type="range"
                      min={-hall.width/2 + bWidth/2}
                      max={hall.width/2 - bWidth/2}
                      step={0.5}
                      value={bPosX}
                      onChange={(e) => setBPosX(Number(e.target.value))}
                      className="w-full accent-[#1A1D21] cursor-ew-resize"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-neutral-500 font-bold">Position Z (Vertical slider)</span>
                      <span className="text-[#1A1D21] font-bold">{bPosZ}m</span>
                    </div>
                    <input
                      type="range"
                      min={-hall.depth/2 + bDepth/2}
                      max={hall.depth/2 - bDepth/2}
                      step={0.5}
                      value={bPosZ}
                      onChange={(e) => setBPosZ(Number(e.target.value))}
                      className="w-full accent-[#1A1D21] cursor-ns-resize"
                    />
                  </div>
                </div>
              </div>

              {/* GLB MODEL IMPORT PANEL */}
              <div className="p-4 bg-[#F8F9FA] border border-[#E0E4E8] rounded-lg space-y-3">
                <h4 className="text-[11px] font-mono font-bold text-[#1A1D21] uppercase tracking-widest flex items-center gap-1.5">
                  <FolderClosed className="w-3.5 h-3.5 text-[#1A1D21]" />
                  GLTF / GLB 3D model uploader
                </h4>
                <p className="text-[10.5px] text-neutral-500 leading-normal font-sans">
                  Choose preset geometry mesh styles or upload your own 3D GLB/GLTF model files to render it live inside the booth!
                </p>

                <div className="flex gap-3 items-center font-sans">
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#E0E4E8] rounded-md p-4 bg-white hover:bg-neutral-50 cursor-pointer group transition-all">
                    <Upload className="w-5 h-5 text-neutral-400 group-hover:text-[#1A1D21] mb-1.5" />
                    <span className="text-[10px] font-mono text-neutral-500 group-hover:text-[#1A1D21]">
                      {customModelFilename ? customModelFilename : 'Upload .glb / .gltf'}
                    </span>
                    <input
                      type="file"
                      id="glb-upload-input"
                      accept=".glb,.gltf"
                      onChange={handleGLBUpload}
                      className="hidden"
                    />
                  </label>
                  
                  {customModelUrl && (
                    <button
                      onClick={() => {
                        setCustomModelUrl('');
                        setCustomModelFilename('');
                      }}
                      className="text-[10px] font-mono text-red-500 bg-white border border-[#E0E4E8] px-3 py-1.5 rounded hover:bg-red-50 transition-all cursor-pointer font-bold"
                    >
                      Clear Model
                    </button>
                  )}
                </div>
              </div>

              {/* MEDIA & GRAPHICS ENRICHMENTS */}
              <div className="p-4 bg-[#F8F9FA] border border-[#E0E4E8] rounded-lg space-y-3.5">
                <h4 className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                  Media & Corporate Attachments
                </h4>
                
                {/* Graphics local file selectors representing logo & banner */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-mono text-neutral-500 mb-1 font-bold">Company Logo (.png)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'logo')}
                      className="bg-white text-[10px] text-[#1A1D21] p-2 rounded border border-[#E0E4E8] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-mono text-neutral-500 mb-1 font-bold">Banner Background</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'banner')}
                      className="bg-white text-[10px] text-[#1A1D21] p-2 rounded border border-[#E0E4E8] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Input URLs */}
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase mb-1 font-bold">Corporate Website URL</label>
                    <input
                      type="url"
                      value={bWebsite}
                      onChange={(e) => setBWebsite(e.target.value)}
                      placeholder="https://company.com"
                      className="w-full bg-white border border-[#E0E4E8] rounded p-2 text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#1a1d21] uppercase mb-1 font-bold">WhatsApp Business Phone</label>
                    <input
                      type="tel"
                      value={bWhatsapp}
                      onChange={(e) => setBWhatsapp(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full bg-white border border-[#E0E4E8] rounded p-2 text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-450 uppercase mb-1 font-bold">Screen Showroom Video URL</label>
                    <input
                      type="url"
                      value={bVideo}
                      onChange={(e) => setBVideo(e.target.value)}
                      placeholder="e.g. https://www.w3schools.com/html/movie.mp4"
                      className="w-full bg-white border border-[#E0E4E8] rounded p-2 text-[#1A1D21] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Action Banner */}
            <div className="pt-2">
              <button
                id="publish-booth-btn"
                onClick={handleSaveBooth}
                className="w-full bg-[#1A1D21] hover:bg-[#2C3036] text-white font-bold text-sm py-3.5 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Publish Stand to Live Expo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Setup Wizard — modal overlay */}
      {showWizard && (
        <QuickSetupWizard
          hall={hall}
          onUpdateHall={(newHall) => { onUpdateHall(newHall); setHallName(newHall.name); }}
          onUpdateBooths={onUpdateBooths}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
