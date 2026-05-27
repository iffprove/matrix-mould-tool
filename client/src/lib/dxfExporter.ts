import { ParsedMesh, Point3D } from './stlParser';

/**
 * Generates a standard 2D DXF string containing the flange outlines and bolt holes.
 * This is suitable for laser cutters or CNC routers.
 */
export function generateFlangeDXF(
  mesh: ParsedMesh | null,
  shutterAssignments: { [faceId: number]: number },
  flangeWidth: number,
  boltSpacing: number
): string {
  let dxf = '';

  // DXF Header
  dxf += '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
  
  // DXF Tables (Layers)
  dxf += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nENDTAB\n';
  dxf += '0\nTABLE\n2\nLAYER\n70\n2\n';
  // Layer 1: Flange Outline (Cyan)
  dxf += '0\nLAYER\n2\nFLANGE_OUTLINE\n70\n0\n62\n4\n6\nCONTINUOUS\n';
  // Layer 2: Bolt Holes (Yellow)
  dxf += '0\nLAYER\n2\nBOLT_HOLES\n70\n0\n62\n2\n6\nCONTINUOUS\n';
  dxf += '0\nENDTAB\n0\nENDSEC\n';

  // DXF Entities Section
  dxf += '0\nSECTION\n2\nENTITIES\n';

  // If no mesh is loaded, generate a generic 2D flange blueprint template
  if (!mesh) {
    // Generate a stylized circular/rectangular rabbit flange template
    const centerX = 150;
    const centerY = 150;
    const radius = 100;
    const outerRadius = radius + flangeWidth / 2;

    // Draw Outer Flange (Circle)
    dxf += writeCircle(centerX, centerY, outerRadius, 'FLANGE_OUTLINE');
    // Draw Inner Boundary (Circle)
    dxf += writeCircle(centerX, centerY, radius, 'FLANGE_OUTLINE');

    // Draw Bolt Holes along the flange
    const circumference = 2 * Math.PI * radius;
    const boltCount = Math.max(4, Math.floor(circumference / boltSpacing));
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      const bx = centerX + radius * Math.cos(angle);
      const by = centerY + radius * Math.sin(angle);
      dxf += writeCircle(bx, by, 4, 'BOLT_HOLES'); // 8mm diameter bolt holes (4mm radius)
    }
  } else {
    // Extract boundary split-line edges between different shutters
    // To do this in 2D, we project the 3D boundary points onto the XY plane
    const boundaryPoints: Point3D[] = [];
    
    mesh.faces.forEach(face => {
      const shutterId = shutterAssignments[face.id] || 1;
      
      // Check if this face borders a different shutter
      face.vertices.forEach(vIndex => {
        const point = mesh.points[vIndex];
        const isBoundary = mesh.faces.some(otherFace => {
          if (otherFace.id !== face.id && otherFace.vertices.includes(vIndex)) {
            const otherShutter = shutterAssignments[otherFace.id];
            return otherShutter !== undefined && otherShutter !== shutterId;
          }
          return false;
        });

        if (isBoundary) {
          boundaryPoints.push(point);
        }
      });
    });

    // Scale and shift boundary points to a nice 2D layout area (e.g. 300x300mm sheet)
    const scale = 150; // Scale factor for layout
    const offsetX = 200;
    const offsetY = 200;

    // Draw boundary segments as 2D lines in DXF
    // For simplicity and clean cutting vectors, we connect sequential boundary points
    for (let i = 0; i < boundaryPoints.length - 1; i += 2) {
      const p1 = boundaryPoints[i];
      const p2 = boundaryPoints[i + 1];
      
      const x1 = p1.x * scale + offsetX;
      const y1 = p1.y * scale + offsetY;
      const x2 = p2.x * scale + offsetX;
      const y2 = p2.y * scale + offsetY;

      // Draw main split line
      dxf += writeLine(x1, y1, x2, y2, 'FLANGE_OUTLINE');

      // Draw offset flange lines (representing the flange width)
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const nx = -dy / len; // Normal vector
        const ny = dx / len;
        
        // Offset boundary lines
        const ox1 = x1 + nx * (flangeWidth / 2);
        const oy1 = y1 + ny * (flangeWidth / 2);
        const ox2 = x2 + nx * (flangeWidth / 2);
        const oy2 = y2 + ny * (flangeWidth / 2);

        dxf += writeLine(ox1, oy1, ox2, oy2, 'FLANGE_OUTLINE');
      }

      // Draw Bolt Holes along the flange at intervals
      if (i % Math.max(2, Math.floor(boltSpacing / 30)) === 0) {
        const bx = (x1 + x2) / 2;
        const by = (y1 + y2) / 2;
        
        // Add bolt hole circle (4mm radius for M8 bolts)
        dxf += writeCircle(bx, by, 4, 'BOLT_HOLES');
      }
    }
  }

  // DXF Footer
  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

function writeLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  let s = '';
  s += '0\nLINE\n';
  s += `8\n${layer}\n`;
  s += `10\n${x1.toFixed(3)}\n`;
  s += `20\n${y1.toFixed(3)}\n`;
  s += `30\n0.0\n`;
  s += `11\n${x2.toFixed(3)}\n`;
  s += `21\n${y2.toFixed(3)}\n`;
  s += `31\n0.0\n`;
  return s;
}

function writeCircle(cx: number, cy: number, r: number, layer: string): string {
  let s = '';
  s += '0\nCIRCLE\n';
  s += `8\n${layer}\n`;
  s += `10\n${cx.toFixed(3)}\n`;
  s += `20\n${cy.toFixed(3)}\n`;
  s += `30\n0.0\n`;
  s += `40\n${r.toFixed(3)}\n`;
  return s;
}
