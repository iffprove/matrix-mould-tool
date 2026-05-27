import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Play, RotateCcw, ShieldCheck, AlertTriangle, Eye, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

import { Point3D, Face, ParsedMesh } from '@/lib/stlParser';

interface MouldCanvas3DProps {
  shutterCount: number;
  flangeWidth: number;
  boltSpacing: number;
  scaleFactor: number;
  selectedShutter: number;
  shutterReleaseVectors: { [key: number]: [number, number, number] };
  onSelectShutter: (id: number) => void;
  selectedTool: 'inspect' | 'paint' | 'vector';
  shutterAssignments: { [faceId: number]: number };
  onAssignFace: (faceId: number, shutterId: number) => void;
  shutterColors: { [key: number]: string };
  customMesh: ParsedMesh | null;
  meshName: string;
}

// Point3D and Face imported from stlParser

export default function MouldCanvas3D({
  shutterCount,
  flangeWidth,
  boltSpacing,
  scaleFactor,
  selectedShutter,
  shutterReleaseVectors,
  onSelectShutter,
  selectedTool,
  shutterAssignments,
  onAssignFace,
  shutterColors,
  customMesh,
  meshName
}: MouldCanvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Camera & Interaction State
  const [rotation, setRotation] = useState({ x: -0.5, y: 0.6 });
  const [zoom, setZoom] = useState(180);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSimulatingRelease, setIsSimulatingRelease] = useState(false);
  const [releaseProgress, setReleaseProgress] = useState(0);
  const [showUndercuts, setShowUndercuts] = useState(true);
  const [showFlanges, setShowFlanges] = useState(true);

  // Generate a realistic "Rabbit" mesh procedural model if no custom mesh is uploaded
  const rabbitMesh = useMemo(() => {
    if (customMesh) return customMesh;
    const points: Point3D[] = [];
    const faces: Face[] = [];
    
    // Procedural generation of a stylized bunny-like model
    // Head, ears, body, legs
    const addSphere = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, segmentsU: number, segmentsV: number) => {
      const startIndex = points.length;
      for (let i = 0; i <= segmentsU; i++) {
        const theta = (i * Math.PI) / segmentsU;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        
        for (let j = 0; j < segmentsV; j++) {
          const phi = (j * 2 * Math.PI) / segmentsV;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);
          
          points.push({
            x: cx + rx * sinTheta * cosPhi,
            y: cy + ry * cosTheta,
            z: cz + rz * sinTheta * sinPhi
          });
        }
      }
      
      // Connect vertices into triangular faces
      for (let i = 0; i < segmentsU; i++) {
        for (let j = 0; j < segmentsV; j++) {
          const nextI = i + 1;
          const nextJ = (j + 1) % segmentsV;
          
          const p1 = startIndex + i * segmentsV + j;
          const p2 = startIndex + nextI * segmentsV + j;
          const p3 = startIndex + nextI * segmentsV + nextJ;
          const p4 = startIndex + i * segmentsV + nextJ;
          
          // Triangle 1
          faces.push({
            id: faces.length,
            vertices: [p1, p2, p3],
            normal: { x: 0, y: 0, z: 0 }, // Will calculate below
            center: { x: 0, y: 0, z: 0 }
          });
          
          // Triangle 2
          faces.push({
            id: faces.length,
            vertices: [p1, p3, p4],
            normal: { x: 0, y: 0, z: 0 },
            center: { x: 0, y: 0, z: 0 }
          });
        }
      }
    };

    // 1. Main body (ellipsoid)
    addSphere(0, -0.2, 0, 0.8, 1.1, 0.7, 10, 12);
    
    // 2. Head (ellipsoid sitting on top-front)
    addSphere(0, 1.0, 0.3, 0.5, 0.5, 0.5, 8, 10);
    
    // 3. Left Ear (long stretched ellipsoid angled outward)
    addSphere(-0.25, 1.8, 0.1, 0.15, 0.7, 0.12, 6, 8);
    
    // 4. Right Ear (long stretched ellipsoid angled outward)
    addSphere(0.25, 1.8, 0.1, 0.15, 0.7, 0.12, 6, 8);
    
    // 5. Tail (small sphere at the back-bottom)
    addSphere(0, -0.9, -0.6, 0.25, 0.25, 0.25, 6, 6);

    // 6. Front paws
    addSphere(-0.3, -1.0, 0.5, 0.18, 0.18, 0.3, 6, 6);
    addSphere(0.3, -1.0, 0.5, 0.18, 0.18, 0.3, 6, 6);

    // Calculate face normals and centers
    faces.forEach(face => {
      const p1 = points[face.vertices[0]];
      const p2 = points[face.vertices[1]];
      const p3 = points[face.vertices[2]];
      
      // Center
      face.center = {
        x: (p1.x + p2.x + p3.x) / 3,
        y: (p1.y + p2.y + p3.y) / 3,
        z: (p1.z + p2.z + p3.z) / 3
      };
      
      // Normal vector using cross product
      const ux = p2.x - p1.x;
      const uy = p2.y - p1.y;
      const uz = p2.z - p1.z;
      
      const vx = p3.x - p1.x;
      const vy = p3.y - p1.y;
      const vz = p3.z - p1.z;
      
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      
      // Normalize
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      if (len > 0) {
        nx /= len;
        ny /= len;
        nz /= len;
      }
      
      face.normal = { x: nx, y: ny, z: nz };
    });

    return { points, faces };
  }, []);

  // Set up face shutter assignments procedurally when mesh or shutter count changes
  useEffect(() => {
    rabbitMesh.faces.forEach(face => {
      // If face doesn't have an assignment, group them by basic spatial partitions
      if (shutterAssignments[face.id] === undefined || shutterAssignments[face.id] > shutterCount) {
        let assignedId = 1;
        if (face.center.x < -0.15) {
          assignedId = 2; // Left side shutter
        } else if (face.center.x > 0.15) {
          assignedId = 3; // Right side shutter
        } else if (face.center.y > 0.6) {
          assignedId = 4; // Top ear cap shutter
        } else if (face.center.z < -0.3) {
          assignedId = 5; // Back shutter
        }
        
        // Ensure it doesn't exceed current shutterCount
        if (assignedId > shutterCount) {
          assignedId = 1;
        }
        
        onAssignFace(face.id, assignedId);
      }
    });
  }, [rabbitMesh, shutterCount, customMesh]);

  // Release simulation tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulatingRelease) {
      interval = setInterval(() => {
        setReleaseProgress(prev => {
          if (prev >= 1) {
            setIsSimulatingRelease(false);
            return 1;
          }
          return prev + 0.02;
        });
      }, 30);
    }
    return () => clearInterval(interval);
  }, [isSimulatingRelease]);

  // Mouse drag handlers for 3D orbit
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setRotation(prev => ({
      x: prev.x + dy * 0.01,
      y: prev.y + dx * 0.01
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 3D Projection & Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw technical grid overlay in the background
    ctx.strokeStyle = 'rgba(48, 80, 160, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Projection matrices / math
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    const project = (p: Point3D) => {
      // Rotate Y
      let x1 = p.x * cosY - p.z * sinY;
      let z1 = p.x * sinY + p.z * cosY;
      
      // Rotate X
      let y2 = p.y * cosX - z1 * sinX;
      let z2 = p.y * sinX + z1 * cosX;
      
      // Scale Factor and Center
      const screenX = canvas.width / 2 + x1 * zoom * scaleFactor;
      const screenY = canvas.height / 2 - y2 * zoom * scaleFactor;
      
      return { x: screenX, y: screenY, depth: z2 };
    };

    // Calculate face release and undercut vectors
    const facesWithProjectedDepth = rabbitMesh.faces.map(face => {
      const shutterId = shutterAssignments[face.id] || 1;
      const releaseVector = shutterReleaseVectors[shutterId] || [0, 1, 0];
      
      // Undercut / Draft check
      // Dot product of face normal and release vector
      const dot = face.normal.x * releaseVector[0] + 
                  face.normal.y * releaseVector[1] + 
                  face.normal.z * releaseVector[2];
      
      // If dot < 0, normal points away from release direction (Undercut!)
      // If dot is close to 0, it's parallel (Marginal/Needs Draft)
      let status: 'safe' | 'marginal' | 'undercut' = 'safe';
      if (dot < -0.05) {
        status = 'undercut';
      } else if (dot < 0.2) {
        status = 'marginal';
      }

      // Calculate simulated release translation offset
      let translationOffset = { x: 0, y: 0, z: 0 };
      if (isSimulatingRelease) {
        const dist = releaseProgress * 0.8;
        translationOffset = {
          x: releaseVector[0] * dist,
          y: releaseVector[1] * dist,
          z: releaseVector[2] * dist
        };
      }

      // Project vertices
      const p1 = project({
        x: rabbitMesh.points[face.vertices[0]].x + translationOffset.x,
        y: rabbitMesh.points[face.vertices[0]].y + translationOffset.y,
        z: rabbitMesh.points[face.vertices[0]].z + translationOffset.z
      });
      const p2 = project({
        x: rabbitMesh.points[face.vertices[1]].x + translationOffset.x,
        y: rabbitMesh.points[face.vertices[1]].y + translationOffset.y,
        z: rabbitMesh.points[face.vertices[1]].z + translationOffset.z
      });
      const p3 = project({
        x: rabbitMesh.points[face.vertices[2]].x + translationOffset.x,
        y: rabbitMesh.points[face.vertices[2]].y + translationOffset.y,
        z: rabbitMesh.points[face.vertices[2]].z + translationOffset.z
      });

      // Average depth for painter's algorithm sorting
      const avgDepth = (p1.depth + p2.depth + p3.depth) / 3;

      return {
        face,
        p1,
        p2,
        p3,
        depth: avgDepth,
        status,
        shutterId,
        dot
      };
    });

    // Sort by depth (Painter's algorithm to render back-to-front)
    facesWithProjectedDepth.sort((a, b) => a.depth - b.depth);

    // Draw faces
    facesWithProjectedDepth.forEach(({ face, p1, p2, p3, status, shutterId, dot }) => {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();

      // Determine Fill Color
      let fillColor = 'rgba(100, 100, 100, 0.5)';
      
      if (showUndercuts) {
        if (status === 'undercut') {
          fillColor = 'rgba(239, 68, 68, 0.75)'; // Red Warning
        } else if (status === 'marginal') {
          fillColor = 'rgba(245, 158, 11, 0.6)'; // Amber Warning
        } else {
          // Color based on shutter assignment
          const colorHex = shutterColors[shutterId] || '#3b82f6';
          // Make selected shutter slightly brighter
          if (shutterId === selectedShutter) {
            fillColor = `${colorHex}90`; // 90 opacity
          } else {
            fillColor = `${colorHex}45`; // 45 opacity
          }
        }
      } else {
        const colorHex = shutterColors[shutterId] || '#3b82f6';
        fillColor = shutterId === selectedShutter ? `${colorHex}95` : `${colorHex}50`;
      }

      ctx.fillStyle = fillColor;
      ctx.fill();

      // Draw wireframe/mesh edges
      ctx.strokeStyle = shutterId === selectedShutter ? 'rgba(139, 92, 246, 0.4)' : 'rgba(48, 80, 160, 0.25)';
      ctx.lineWidth = shutterId === selectedShutter ? 1.5 : 0.8;
      ctx.stroke();

      // Draw Flange simulation on boundaries
      if (showFlanges && !isSimulatingRelease) {
        // If this face is near a split line (bordering other shutters)
        const isBoundary = face.vertices.some(vIndex => {
          // Check if neighboring faces have different shutter IDs
          return rabbitMesh.faces.some(otherFace => {
            if (otherFace.id !== face.id && otherFace.vertices.includes(vIndex)) {
              const otherShutter = shutterAssignments[otherFace.id];
              return otherShutter !== undefined && otherShutter !== shutterId;
            }
            return false;
          });
        });

        if (isBoundary) {
          // Draw an extruded boundary outline representing the flange
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)'; // Neon Cyan Flange lines
          ctx.lineWidth = Math.max(2, flangeWidth / 15);
          ctx.stroke();

          // Draw mock bolt holes along flanges occasionally
          if (face.id % 7 === 0) {
            ctx.beginPath();
            ctx.arc((p1.x + p2.x)/2, (p1.y + p2.y)/2, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#22d3ee';
            ctx.fill();
            ctx.strokeStyle = '#0e7490';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    });

    // Draw release vectors (arrows) for active/all shutters
    Object.entries(shutterReleaseVectors).forEach(([idStr, vec]) => {
      const id = parseInt(idStr);
      // Find average center of faces belonging to this shutter
      const assignedFaces = rabbitMesh.faces.filter(f => shutterAssignments[f.id] === id);
      if (assignedFaces.length === 0) return;

      let cx = 0, cy = 0, cz = 0;
      assignedFaces.forEach(f => {
        cx += f.center.x;
        cy += f.center.y;
        cz += f.center.z;
      });
      cx /= assignedFaces.length;
      cy /= assignedFaces.length;
      cz /= assignedFaces.length;

      // Start of vector arrow
      const startProj = project({ x: cx, y: cy, z: cz });
      
      // End of vector arrow
      const arrowLength = 0.6;
      const endProj = project({
        x: cx + vec[0] * arrowLength,
        y: cy + vec[1] * arrowLength,
        z: cz + vec[2] * arrowLength
      });

      // Draw Arrow Line
      ctx.beginPath();
      ctx.moveTo(startProj.x, startProj.y);
      ctx.lineTo(endProj.x, endProj.y);
      ctx.strokeStyle = id === selectedShutter ? '#22d3ee' : '#3b82f6';
      ctx.lineWidth = id === selectedShutter ? 3 : 1.5;
      ctx.stroke();

      // Draw Arrow Head
      ctx.beginPath();
      ctx.arc(endProj.x, endProj.y, id === selectedShutter ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = id === selectedShutter ? '#22d3ee' : '#3b82f6';
      ctx.fill();

      // Text label for Shutter
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`S${id}`, endProj.x + 8, endProj.y + 3);
    });

    // Draw Compass / Technical Legend in corner
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1.5;
    const compassX = 50;
    const compassY = canvas.height - 50;
    
    // X-axis (Red)
    const px = project({ x: 0.3, y: 0, z: 0 });
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX + (px.x - canvas.width/2)/2, compassY - (px.y - canvas.height/2)/2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.font = '9px monospace';
    ctx.fillText('X', compassX + (px.x - canvas.width/2)/2 + 4, compassY - (px.y - canvas.height/2)/2 + 3);

    // Y-axis (Green)
    const py = project({ x: 0, y: 0.3, z: 0 });
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX + (py.x - canvas.width/2)/2, compassY - (py.y - canvas.height/2)/2);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.fillText('Y', compassX + (py.x - canvas.width/2)/2 + 4, compassY - (py.y - canvas.height/2)/2 + 3);

    // Z-axis (Blue)
    const pz = project({ x: 0, y: 0, z: 0.3 });
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX + (pz.x - canvas.width/2)/2, compassY - (pz.y - canvas.height/2)/2);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillText('Z', compassX + (pz.x - canvas.width/2)/2 + 4, compassY - (pz.y - canvas.height/2)/2 + 3);

  }, [rotation, zoom, scaleFactor, rabbitMesh, shutterCount, selectedShutter, shutterReleaseVectors, shutterAssignments, isSimulatingRelease, releaseProgress, showUndercuts, showFlanges, flangeWidth, boltSpacing]);

  // Count undercuts for current configuration
  const undercutCount = useMemo(() => {
    let count = 0;
    rabbitMesh.faces.forEach(face => {
      const shutterId = shutterAssignments[face.id] || 1;
      const releaseVector = shutterReleaseVectors[shutterId] || [0, 1, 0];
      const dot = face.normal.x * releaseVector[0] + 
                  face.normal.y * releaseVector[1] + 
                  face.normal.z * releaseVector[2];
      if (dot < -0.05) count++;
    });
    return count;
  }, [rabbitMesh, shutterAssignments, shutterReleaseVectors]);

  return (
    <div className="flex flex-col h-full relative">
      {/* 3D Canvas */}
      <div className="relative flex-1 bg-black/20 rounded-sm border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Floating Viewport HUD Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="led-display flex items-center gap-2 bg-background/80 border border-border">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>MESH: {meshName.toUpperCase()}</span>
          </div>
          <div className="led-display bg-background/80 border border-border">
            <span>SCALE: {(1000 * scaleFactor).toFixed(0)}mm (1:{scaleFactor.toFixed(1)})</span>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-background/85 border border-border p-2 rounded-sm text-xs">
          <div className="font-bold text-primary mb-1 border-b border-border/50 pb-1">VIEW OPTIONS</div>
          <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={showUndercuts}
              onChange={(e) => setShowUndercuts(e.target.checked)}
              className="accent-primary"
            />
            <span>Draft/Undercut Heatmap</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={showFlanges}
              onChange={(e) => setShowFlanges(e.target.checked)}
              className="accent-primary"
            />
            <span>Show Joint Flanges</span>
          </label>
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setZoom(prev => Math.min(300, prev + 20))}
              className="px-2 py-1 bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground border border-border rounded-sm font-bold"
            >
              Z+
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(80, prev - 20))}
              className="px-2 py-1 bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground border border-border rounded-sm font-bold"
            >
              Z-
            </button>
            <button
              onClick={() => setRotation({ x: -0.5, y: 0.6 })}
              className="px-2 py-1 bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground border border-border rounded-sm font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bottom Simulation & Release Status HUD */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-background/90 border border-border p-3 rounded-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (isSimulatingRelease) {
                  setIsSimulatingRelease(false);
                  setReleaseProgress(0);
                } else {
                  setReleaseProgress(0);
                  setIsSimulatingRelease(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/80 font-bold text-xs rounded-sm transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              {isSimulatingRelease ? 'RESET SIM' : 'SIMULATE RELEASE'}
            </button>

            {isSimulatingRelease && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Progress:</span>
                <div className="w-24 bg-secondary border border-border h-2.5 rounded-sm overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${releaseProgress * 100}%` }}
                  />
                </div>
                <span className="font-mono text-primary font-bold">{(releaseProgress * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {undercutCount === 0 ? (
              <div className="flex items-center gap-1 text-green-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>ALL SHUTTERS SAFE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-destructive font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{undercutCount} UNDERCUT FACES DETECTED</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
