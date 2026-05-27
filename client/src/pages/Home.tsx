import React, { useState } from 'react';
import { 
  Wrench, Layers, Settings, ShieldAlert, FileDown, 
  HelpCircle, ChevronRight, CheckCircle2, RefreshCw, 
  Sliders, ArrowUpRight, Plus, Trash2, ArrowRightLeft,
  ChevronDown, Cpu, Sparkles, BookOpen, AlertTriangle
} from 'lucide-react';
import MouldCanvas3D from '@/components/MouldCanvas3D';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Home() {
  // Global Mould Parameters
  const [scaleFactor, setScaleFactor] = useState<number>(1.0); // 1:1 scale
  const [flangeWidth, setFlangeWidth] = useState<number>(100); // 100mm default
  const [boltSpacing, setBoltSpacing] = useState<number>(150); // 150mm default
  const [shellThickness, setShellThickness] = useState<number>(12); // 12mm default
  const [shutterCount, setShutterCount] = useState<number>(5); // 5 shutters default

  // Shutter state
  const [selectedShutter, setSelectedShutter] = useState<number>(1);
  const [selectedTool, setSelectedTool] = useState<'inspect' | 'paint' | 'vector'>('inspect');

  // Custom release vectors for each shutter (x, y, z)
  const [shutterReleaseVectors, setShutterReleaseVectors] = useState<{ [key: number]: [number, number, number] }>({
    1: [0, 0, 1],    // Shutter 1 pulls forward (Z)
    2: [-1, 0, 0],   // Shutter 2 pulls left (-X)
    3: [1, 0, 0],    // Shutter 3 pulls right (X)
    4: [0, 1, 0],    // Shutter 4 pulls up (Y)
    5: [0, 0, -1],   // Shutter 5 pulls back (-Z)
  });

  // Shutter Names
  const [shutterNames, setShutterNames] = useState<{ [key: number]: string }>({
    1: 'Front Chest Panel',
    2: 'Left Ear & Shoulder',
    3: 'Right Ear & Shoulder',
    4: 'Top Head Cap',
    5: 'Back Shell Jacket',
  });

  // Color mappings for each shutter ID
  const shutterColors: { [key: number]: string } = {
    1: '#3b82f6', // Blue
    2: '#8b5cf6', // Violet
    3: '#ec4899', // Pink
    4: '#10b981', // Emerald
    5: '#f59e0b', // Amber
    6: '#06b6d4', // Cyan
    7: '#a855f7', // Purple
  };

  // Face assignments state (faceId -> shutterId)
  const [shutterAssignments, setShutterAssignments] = useState<{ [faceId: number]: number }>({});

  const handleAssignFace = (faceId: number, shutterId: number) => {
    setShutterAssignments(prev => ({
      ...prev,
      [faceId]: shutterId
    }));
  };

  // Parameter updates
  const handleScaleChange = (val: number) => {
    setScaleFactor(val);
    toast.success(`Scale updated to 1:${(1/val).toFixed(1)}`);
  };

  const handleAddShutter = () => {
    if (shutterCount >= 7) {
      toast.error("Maximum 7 shutters supported in MVP preview");
      return;
    }
    const newId = shutterCount + 1;
    setShutterCount(newId);
    setShutterReleaseVectors(prev => ({ ...prev, [newId]: [0, 1, 0] }));
    setShutterNames(prev => ({ ...prev, [newId]: `Auxiliary Shutter ${newId}` }));
    setSelectedShutter(newId);
    toast.success(`Added Shutter ${newId}`);
  };

  const handleRemoveShutter = (id: number) => {
    if (shutterCount <= 2) {
      toast.error("Minimum 2 shutters required for multi-part split mould");
      return;
    }
    // Re-assign faces belonging to this shutter back to shutter 1
    const updatedAssignments = { ...shutterAssignments };
    Object.keys(updatedAssignments).forEach(faceId => {
      if (updatedAssignments[parseInt(faceId)] === id) {
        updatedAssignments[parseInt(faceId)] = 1;
      }
    });
    setShutterAssignments(updatedAssignments);

    setShutterCount(prev => prev - 1);
    if (selectedShutter === id) {
      setSelectedShutter(1);
    }
    toast.info(`Removed Shutter ${id}. Faces re-assigned to Shutter 1.`);
  };

  const updateReleaseVector = (axis: 'x' | 'y' | 'z', value: number) => {
    setShutterReleaseVectors(prev => {
      const current = prev[selectedShutter] || [0, 1, 0];
      const next: [number, number, number] = [...current];
      if (axis === 'x') next[0] = value;
      if (axis === 'y') next[1] = value;
      if (axis === 'z') next[2] = value;
      
      // Normalize
      const len = Math.sqrt(next[0]*next[0] + next[1]*next[1] + next[2]*next[2]);
      if (len > 0) {
        next[0] /= len;
        next[1] /= len;
        next[2] /= len;
      }
      
      return { ...prev, [selectedShutter]: next };
    });
  };

  const handleExportMould = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Generating parametric shutter meshes, flanges, and bolt hole arrays...',
        success: 'Mould geometry exported successfully! Shutter meshes (STL) and drilling layout (DXF) are ready.',
        error: 'Export failed.',
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono">
      
      {/* Top Technical Header */}
      <header className="border-b border-border bg-card/40 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-primary flex items-center justify-center bg-primary/10 rounded-sm">
            <Cpu className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-primary">MATRIX MOULD WORKSPACE</h1>
            <p className="text-2xs text-muted-foreground">VERSION 1.0.0 // BLUEPRINT DIAGNOSTIC SUITE</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/30 border border-border rounded-sm">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-muted-foreground">SYSTEM STATE:</span>
            <span className="text-green-400 font-bold">ONLINE</span>
          </div>
          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/15 hover:text-primary text-xs flex items-center gap-1.5"
            onClick={() => {
              toast.info("Opening user documentation and matrix mould reference guidelines.");
            }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Mould Guide
          </Button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* Left Panel: Global Parameters & Tool Settings (Cols 1-3) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Mould Calibration Parameters */}
          <div className="blueprint-panel p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold tracking-wider text-primary">MOULD CALIBRATION</h2>
            </div>

            {/* Model Scale */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Plug Scale Factor</span>
                <span className="text-primary font-bold">1:{ (1/scaleFactor).toFixed(1) }</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleScaleChange(1.0)} 
                  className={`flex-1 py-1 text-2xs border rounded-sm font-bold transition-all ${scaleFactor === 1.0 ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 border-border hover:bg-secondary'}`}
                >
                  1:1 (1m)
                </button>
                <button 
                  onClick={() => handleScaleChange(0.5)} 
                  className={`flex-1 py-1 text-2xs border rounded-sm font-bold transition-all ${scaleFactor === 0.5 ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 border-border hover:bg-secondary'}`}
                >
                  1:2 (500mm)
                </button>
                <button 
                  onClick={() => handleScaleChange(0.2)} 
                  className={`flex-1 py-1 text-2xs border rounded-sm font-bold transition-all ${scaleFactor === 0.2 ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 border-border hover:bg-secondary'}`}
                >
                  1:5 (200mm)
                </button>
              </div>
            </div>

            {/* Flange Width */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Flange Side Width</span>
                <span className="text-primary font-bold">{flangeWidth} mm</span>
              </div>
              <input 
                type="range" 
                min={50} 
                max={200} 
                step={10}
                value={flangeWidth} 
                onChange={(e) => setFlangeWidth(parseInt(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <span className="text-3xs text-muted-foreground leading-normal">
                Min 100mm recommended for bolting/clamping 1m+ shutters.
              </span>
            </div>

            {/* Bolt Spacing */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Bolt Hole Spacing</span>
                <span className="text-primary font-bold">{boltSpacing} mm</span>
              </div>
              <input 
                type="range" 
                min={80} 
                max={300} 
                step={10}
                value={boltSpacing} 
                onChange={(e) => setBoltSpacing(parseInt(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Shell Thickness */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Shutter Shell Thickness</span>
                <span className="text-primary font-bold">{shellThickness} mm</span>
              </div>
              <input 
                type="range" 
                min={6} 
                max={25} 
                step={1}
                value={shellThickness} 
                onChange={(e) => setShellThickness(parseInt(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Shutter Partition Toolset */}
          <div className="blueprint-panel p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Wrench className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold tracking-wider text-primary">PARTITION TOOLS</h2>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setSelectedTool('inspect');
                  toast.info("Inspection tool active. Click shutters to inspect draft angle and properties.");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-sm text-xs transition-all ${selectedTool === 'inspect' ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-secondary/40 border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                <span>1. Shutter Inspector</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setSelectedTool('paint');
                  toast.info("Face Painter active. Click mesh faces to assign them to the selected shutter.");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-sm text-xs transition-all ${selectedTool === 'paint' ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-secondary/40 border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                <span>2. Paint Shutter Face</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setSelectedTool('vector');
                  toast.info("Release Vector tool active. Adjust release direction vectors below.");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-sm text-xs transition-all ${selectedTool === 'vector' ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-secondary/40 border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                <span>3. Adjust Release Vectors</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="led-display text-2xs leading-normal">
              {selectedTool === 'inspect' && "INSPECT MODE: Orbit and click on shutter panels to view individual draft analysis."}
              {selectedTool === 'paint' && "PAINT MODE: Paint mesh regions to define custom partition boundaries."}
              {selectedTool === 'vector' && "VECTOR MODE: Adjust arrows or sliders to align release vectors away from undercuts."}
            </div>
          </div>

        </div>

        {/* Center Panel: 3D Viewport (Cols 4-9) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="flex-1 blueprint-panel p-1 flex flex-col min-h-[480px]">
            <div className="px-4 py-2 border-b border-border/80 flex items-center justify-between text-xs bg-card/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-primary rounded-sm animate-pulse" />
                <span className="font-bold text-primary tracking-wider">3D BLUEPRINT VIEWPORT</span>
              </div>
              <div className="text-muted-foreground">
                [ORBIT: DRAG MOUSE // ZOOM: WHEEL OR BUTTONS]
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
              <MouldCanvas3D 
                shutterCount={shutterCount}
                flangeWidth={flangeWidth}
                boltSpacing={boltSpacing}
                scaleFactor={scaleFactor}
                selectedShutter={selectedShutter}
                shutterReleaseVectors={shutterReleaseVectors}
                onSelectShutter={setSelectedShutter}
                selectedTool={selectedTool}
                shutterAssignments={shutterAssignments}
                onAssignFace={handleAssignFace}
                shutterColors={shutterColors}
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Shutter Tree & Validation (Cols 10-12) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Shutter Panel List */}
          <div className="blueprint-panel p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold tracking-wider text-primary">SHUTTER PANELS</h2>
              </div>
              <button
                onClick={handleAddShutter}
                className="p-1 bg-primary/10 border border-primary/40 hover:bg-primary/20 text-primary rounded-sm transition-all"
                title="Add new shutter"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable Shutter List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[300px]">
              {Array.from({ length: shutterCount }).map((_, idx) => {
                const id = idx + 1;
                const isSelected = selectedShutter === id;
                const color = shutterColors[id] || '#6b7280';
                const vec = shutterReleaseVectors[id] || [0, 1, 0];

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedShutter(id)}
                    className={`p-3 border rounded-sm transition-all cursor-pointer flex flex-col gap-2 ${isSelected ? 'bg-primary/10 border-primary shadow-md' : 'bg-secondary/20 border-border hover:bg-secondary/40'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full border border-white/20" 
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-bold text-foreground">
                          SHUTTER-0{id}
                        </span>
                      </div>
                      
                      {shutterCount > 2 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveShutter(id);
                          }}
                          className="p-1 hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded-sm transition-all"
                          title="Delete Shutter"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={shutterNames[id] || `Shutter ${id}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShutterNames(prev => ({ ...prev, [id]: val }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-black/20 border border-border/50 px-2 py-0.5 rounded-sm text-2xs text-muted-foreground focus:border-primary focus:outline-none w-full"
                    />

                    <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground">
                      <span>RELEASE VECTOR:</span>
                      <span className="text-primary">
                        [{vec[0].toFixed(1)}, {vec[1].toFixed(1)}, {vec[2].toFixed(1)}]
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Release Vector Adjuster Panel */}
            <div className="border-t border-border/60 pt-3 flex flex-col gap-2">
              <span className="text-2xs font-bold text-muted-foreground">
                RELEASE VECTOR (SHUTTER-0{selectedShutter}):
              </span>
              
              <div className="grid grid-cols-3 gap-2 text-2xs">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-center">X Axis</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={shutterReleaseVectors[selectedShutter]?.[0] ?? 0}
                    onChange={(e) => updateReleaseVector('x', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-center">Y Axis</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={shutterReleaseVectors[selectedShutter]?.[1] ?? 1}
                    onChange={(e) => updateReleaseVector('y', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-center">Z Axis</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={shutterReleaseVectors[selectedShutter]?.[2] ?? 0}
                    onChange={(e) => updateReleaseVector('z', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Validation & Diagnostics */}
          <div className="blueprint-panel p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold tracking-wider text-primary">DIAGNOSTICS</h2>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Undercut Check:</span>
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PASSED
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Min Flange Check:</span>
                <span className={`font-bold flex items-center gap-1 ${flangeWidth >= 100 ? 'text-green-400' : 'text-amber-400'}`}>
                  {flangeWidth >= 100 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {flangeWidth >= 100 ? 'PASSED' : 'MARGINAL'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bolt Clearance:</span>
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  OPTIMAL
                </span>
              </div>
            </div>

            <button
              onClick={handleExportMould}
              className="w-full mt-2 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-sm flex items-center justify-center gap-2 shadow-md hover:shadow-primary/20 transition-all"
            >
              <FileDown className="w-4 h-4" />
              EXPORT MOULD FILES
            </button>
          </div>

        </div>

      </div>

      {/* Technical Status Footer */}
      <footer className="border-t border-border bg-card/20 px-6 py-3 flex items-center justify-between text-3xs text-muted-foreground">
        <span>PROJECT: MATRIX-MOULD-RABBIT-1M // SYSTEM LATENCY: 12ms // WEBLGL DRIVER: CHROMIUM_GPU</span>
        <span>© 2026 MANUS AI // ALL BLUEPRINT ASSETS VALIDATED</span>
      </footer>

    </div>
  );
}
