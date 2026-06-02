import React, { useState } from 'react';
import { Search, MapPin, Compass, Tag, RefreshCw, Layers, Sparkles } from 'lucide-react';
import { Hall, Booth } from '../types';

interface VisitorControlsProps {
  hall: Hall;
  booths: Booth[];
  activeBoothId: string | null;
  onSelectBooth: (booth: Booth) => void;
  visitorPos: [number, number, number];
  setVisitorPos: (pos: [number, number, number]) => void;
  onAddSampleData?: () => void;
}

export default function VisitorControls({
  hall,
  booths,
  activeBoothId,
  onSelectBooth,
  visitorPos,
  setVisitorPos,
  onAddSampleData
}: VisitorControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filter Categories
  const categories = ['All', ...Array.from(new Set(booths.map((b) => b.category)))];

  // Search filter logic
  const filteredBooths = booths.filter((booth) => {
    const matchesSearch =
      booth.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booth.boothNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booth.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === 'All' || booth.category === selectedCategory;
    
    return matchesSearch && matchesCat;
  });

  // Mathematically map 3D coordinates to Minimap 2D percentages
  const getMinimapCoords = (x: number, z: number) => {
    const marginRatio = 1.0; 
    const px = ((x + hall.width / 2) / hall.width) * 100;
    const pz = ((z + hall.depth / 2) / hall.depth) * 100;
    return {
      left: `${Math.max(0, Math.min(100, px))}%`,
      top: `${Math.max(0, Math.min(100, pz))}%`,
    };
  };

  // Teleport clicking directly on the 2D Minimap
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const percentX = clickX / rect.width;
    const percentY = clickY / rect.height;
    
    // Scale back to 3D world coordinates
    const worldX = (percentX - 0.5) * hall.width;
    const worldZ = (percentY - 0.5) * hall.depth;
    
    // Smooth boundary clamp
    setVisitorPos([
      Math.max(-hall.width / 2 + 1, Math.min(hall.width / 2 - 1, worldX)),
      visitorPos[1],
      Math.max(-hall.depth / 2 + 1, Math.min(hall.depth / 2 - 1, worldZ))
    ]);
  };

  return (
    <div id="visitor-navigation-sidebar" className="h-full flex flex-col bg-white text-[#1A1D21] p-6 space-y-6 overflow-y-auto">
      
      {/* 1. INTERACTIVE 2D MINIMAP COMPONENT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-widest text-[#1A1D21] font-bold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#1A1D21]" />
            2D Floorplan Guide
          </h3>
          <span className="text-[9px] font-mono bg-[#F0F2F5] border border-[#E0E4E8] text-neutral-600 px-1.5 py-0.5 rounded uppercase">
            {hall.width}m × {hall.depth}m Hall
          </span>
        </div>

        {/* Scaled Aspect Box for Minimap */}
        <div className="relative border border-[#E0E4E8] bg-white p-2 rounded-lg group/map overflow-hidden shadow-sm">
          <div 
            id="radar-minimap-grid"
            onClick={handleMinimapClick}
            className="relative w-full aspect-[4/3] bg-[#F8F9FA] border border-[#E0E4E8] rounded-md cursor-crosshair overflow-hidden"
          >
            {/* Soft grid guides inside map */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 pointer-events-none opacity-[0.2]">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="border-r border-b border-neutral-300" />
              ))}
            </div>

            {/* Static Booth markers inside minimap */}
            {booths.map((booth) => {
              const coords = getMinimapCoords(booth.posX, booth.posZ);
              const isActive = activeBoothId === booth.id;
              
              // Calculate relative aspect size percentages for visual booth footprint mapping
              const wPercent = (booth.width / hall.width) * 100;
              const dPercent = (booth.depth / hall.depth) * 100;

              return (
                <div
                  key={booth.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBooth(booth);
                  }}
                  className={`absolute rounded-sm border cursor-pointer transition-all flex items-center justify-center text-[7px] font-mono hover:scale-105 hover:brightness-95 select-none ${
                    isActive 
                      ? 'bg-[#1A1D21] border-[#1A1D21] text-white font-bold z-20 shadow-md' 
                      : 'bg-white border-[#E0E4E8] text-neutral-600'
                  }`}
                  style={{
                    left: coords.left,
                    top: coords.top,
                    width: `${Math.max(12, wPercent)}%`,
                    height: `${Math.max(12, dPercent)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={`${booth.companyName} (${booth.boothNumber})`}
                >
                  {booth.boothNumber}
                </div>
              );
            })}

            {/* Blinking Visitor Locator pin */}
            {(() => {
              const visitorCoords = getMinimapCoords(visitorPos[0], visitorPos[2]);
              return (
                <div
                  id="visitor-radar-blip"
                  className="absolute w-4 h-4 rounded-full flex items-center justify-center pointer-events-none transition-all duration-300 z-30"
                  style={{
                    left: visitorCoords.left,
                    top: visitorCoords.top,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white shadow-sm"></span>
                </div>
              );
            })()}
          </div>
          <p className="text-[9px] text-center text-neutral-400 font-mono mt-1.5">
            Click anywhere on the map grid to walk there instantly
          </p>
        </div>
      </div>

      {/* 2. DIRECTORY SEARCH CONTROLS */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-neutral-500" />
          Exhibitor Directory
        </h3>

        {/* Search input bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
          <input
            id="directory-search-input"
            type="text"
            placeholder="Search company, booth or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-sm pl-10 pr-4 py-2.5 rounded-md border border-[#E0E4E8] text-[#1A1D21] placeholder-neutral-400 focus:outline-none focus:border-[#1A1D21] transition-all font-sans"
          />
        </div>

        {/* Category scrolling capsule filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] font-mono tracking-wide font-medium uppercase px-2.5 py-1.5 rounded-full border shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#1A1D21] text-white border-[#1A1D21]'
                  : 'bg-[#F0F2F5] text-neutral-500 border-[#E0E4E8] hover:bg-[#E9ECEF] hover:text-[#1A1D21]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SCROLLABLE SEARCH RESULTS DIRECTORY LIST */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {filteredBooths.length > 0 ? (
          filteredBooths.map((booth) => {
            const isActive = activeBoothId === booth.id;
            return (
              <div
                key={booth.id}
                id={`booth-directory-row-${booth.id}`}
                onClick={() => onSelectBooth(booth)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer group flex items-start gap-3.5 ${
                  isActive
                    ? 'bg-[#F0F2F5] border-[#1A1D21] shadow-sm'
                    : 'bg-white border-[#E0E4E8] hover:border-neutral-450 hover:bg-[#F8F9FA]'
                }`}
              >
                {/* Micro Brand Circle */}
                <div 
                  className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-xs uppercase tracking-tight shadow border shrink-0 relative bg-white"
                  style={{ 
                    border: `1px solid #E0E4E8`
                  }}
                >
                  {booth.logoUrl ? (
                    <img
                      src={booth.logoUrl}
                      alt={booth.companyName}
                      className="w-8 h-8 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="font-bold text-[#1A1D21]">
                      {booth.companyName.substring(0, 2)}
                    </span>
                  )}
                  {/* Floating index */}
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] font-mono px-1 bg-[#1A1D21] text-white border border-[#1A1D21] rounded">
                    {booth.boothNumber}
                  </span>
                </div>

                {/* Info summary */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold tracking-tight text-[#1A1D21] group-hover:text-neutral-600 transition-colors truncate">
                    {booth.companyName}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono mt-1 uppercase">
                    <Tag className="w-3 h-3 text-neutral-400 shrink-0" />
                    <span className="truncate text-neutral-500">{booth.category}</span>
                  </div>
                </div>

                {/* Pinned Action */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetX = booth.posX;
                    const targetZ = booth.posZ + 3.4; // view cushion space
                    setVisitorPos([targetX, 0.8, targetZ]);
                  }}
                  className="p-1.5 rounded-md bg-white hover:bg-[#F0F2F5] text-[#1A1D21] border border-[#E0E4E8] transition-all"
                  title="Teleport to this stall"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 border border-dashed border-[#E0E4E8] rounded-lg bg-[#F8F9FA]">
            <p className="text-sm text-neutral-400 font-mono">No matching exhibitors found</p>
            {onAddSampleData && (
              <button
                onClick={onAddSampleData}
                className="mt-4 text-xs bg-white hover:bg-neutral-50 text-[#1A1D21] font-semibold px-4 py-2 rounded border border-[#E0E4E8] transition-all font-mono"
              >
                Add Sample Exhibitors
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. TOTAL METRICS FOOTER */}
      <div className="pt-3 border-t border-[#E0E4E8] p-2 text-center text-[10px] font-mono text-neutral-400 flex items-center justify-between">
        <span>Active Stands: <strong className="text-[#1A1D21]">{booths.length}</strong></span>
        <span>Registered Industries: <strong className="text-[#1A1D21]">{categories.length - 1}</strong></span>
      </div>
    </div>
  );
}
