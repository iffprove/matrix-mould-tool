export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Face {
  id: number;
  vertices: [number, number, number];
  normal: Point3D;
  center: Point3D;
}

export interface ParsedMesh {
  points: Point3D[];
  faces: Face[];
}

/**
 * Parses an ArrayBuffer of an STL file (handles both ASCII and Binary)
 */
export function parseSTL(buffer: ArrayBuffer): ParsedMesh {
  const isBinary = checkIfBinary(buffer);
  if (isBinary) {
    return parseBinarySTL(buffer);
  } else {
    return parseASCIISTL(buffer);
  }
}

function checkIfBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  
  // Read first 80 bytes (header) and then the face count (4 bytes)
  const reader = new DataView(buffer);
  const faceCount = reader.getUint32(80, true);
  
  // If faceCount matches the file size formula: 80 + 4 + faceCount * 50 = byteLength
  const expectedSize = 80 + 4 + faceCount * 50;
  if (expectedSize === buffer.byteLength) {
    return true;
  }
  
  // Fallback: Check if there are any non-ASCII characters in the first 500 bytes
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 500));
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] > 127) return true;
  }
  
  return false;
}

function parseBinarySTL(buffer: ArrayBuffer): ParsedMesh {
  const reader = new DataView(buffer);
  const faceCount = reader.getUint32(80, true);
  
  const points: Point3D[] = [];
  const faces: Face[] = [];
  
  // Map to deduplicate points and save memory/improve render speed
  const pointMap = new Map<string, number>();
  
  let offset = 84;
  
  for (let i = 0; i < faceCount; i++) {
    if (offset + 50 > buffer.byteLength) break;
    
    // Normal (12 bytes)
    const nx = reader.getFloat32(offset, true);
    const ny = reader.getFloat32(offset + 4, true);
    const nz = reader.getFloat32(offset + 8, true);
    offset += 12;
    
    const vertexIndices: number[] = [];
    
    // 3 Vertices (36 bytes)
    for (let v = 0; v < 3; v++) {
      const vx = reader.getFloat32(offset, true);
      const vy = reader.getFloat32(offset + 4, true);
      const vz = reader.getFloat32(offset + 8, true);
      offset += 12;
      
      // Deduplicate key
      const key = `${vx.toFixed(4)},${vy.toFixed(4)},${vz.toFixed(4)}`;
      let idx = pointMap.get(key);
      if (idx === undefined) {
        idx = points.length;
        points.push({ x: vx, y: vy, z: vz });
        pointMap.set(key, idx);
      }
      vertexIndices.push(idx);
    }
    
    // Attribute byte count (2 bytes)
    offset += 2;
    
    const p1 = points[vertexIndices[0]];
    const p2 = points[vertexIndices[1]];
    const p3 = points[vertexIndices[2]];
    
    const center = {
      x: (p1.x + p2.x + p3.x) / 3,
      y: (p1.y + p2.y + p3.y) / 3,
      z: (p1.z + p2.z + p3.z) / 3
    };
    
    faces.push({
      id: faces.length,
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      normal: { x: nx, y: ny, z: nz },
      center
    });
  }
  
  // Center and normalize scale of the loaded mesh to fit nicely in viewport [-1, 1]
  normalizeMesh(points, faces);
  
  return { points, faces };
}

function parseASCIISTL(buffer: ArrayBuffer): ParsedMesh {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);
  
  const points: Point3D[] = [];
  const faces: Face[] = [];
  const pointMap = new Map<string, number>();
  
  const lines = text.split('\n');
  let currentNormal = { x: 0, y: 1, z: 0 };
  let currentVertices: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      currentNormal = {
        x: parseFloat(parts[2]) || 0,
        y: parseFloat(parts[3]) || 0,
        z: parseFloat(parts[4]) || 0
      };
      currentVertices = [];
    } else if (line.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      const vx = parseFloat(parts[1]) || 0;
      const vy = parseFloat(parts[2]) || 0;
      const vz = parseFloat(parts[3]) || 0;
      
      const key = `${vx.toFixed(4)},${vy.toFixed(4)},${vz.toFixed(4)}`;
      let idx = pointMap.get(key);
      if (idx === undefined) {
        idx = points.length;
        points.push({ x: vx, y: vy, z: vz });
        pointMap.set(key, idx);
      }
      currentVertices.push(idx);
    } else if (line.startsWith('endfacet')) {
      if (currentVertices.length === 3) {
        const p1 = points[currentVertices[0]];
        const p2 = points[currentVertices[1]];
        const p3 = points[currentVertices[2]];
        
        const center = {
          x: (p1.x + p2.x + p3.x) / 3,
          y: (p1.y + p2.y + p3.y) / 3,
          z: (p1.z + p2.z + p3.z) / 3
        };
        
        faces.push({
          id: faces.length,
          vertices: [currentVertices[0], currentVertices[1], currentVertices[2]],
          normal: currentNormal,
          center
        });
      }
    }
  }
  
  normalizeMesh(points, faces);
  
  return { points, faces };
}

function normalizeMesh(points: Point3D[], faces: Face[]) {
  if (points.length === 0) return;
  
  // Find bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });
  
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  
  const maxDim = Math.max(sizeX, sizeY, sizeZ);
  const scale = maxDim > 0 ? 1.8 / maxDim : 1; // Normalize to roughly fit [-0.9, 0.9] range
  
  // Apply translation and scaling
  points.forEach(p => {
    p.x = (p.x - cx) * scale;
    p.y = (p.y - cy) * scale;
    p.z = (p.z - cz) * scale;
  });
  
  // Recalculate face centers and normals (if normal is 0,0,0)
  faces.forEach(face => {
    const p1 = points[face.vertices[0]];
    const p2 = points[face.vertices[1]];
    const p3 = points[face.vertices[2]];
    
    face.center = {
      x: (p1.x + p2.x + p3.x) / 3,
      y: (p1.y + p2.y + p3.y) / 3,
      z: (p1.z + p2.z + p3.z) / 3
    };
    
    // Recalculate normal just in case it was missing/incorrect in STL
    if (face.normal.x === 0 && face.normal.y === 0 && face.normal.z === 0) {
      const ux = p2.x - p1.x;
      const uy = p2.y - p1.y;
      const uz = p2.z - p1.z;
      
      const vx = p3.x - p1.x;
      const vy = p3.y - p1.y;
      const vz = p3.z - p1.z;
      
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      if (len > 0) {
        face.normal = { x: nx / len, y: ny / len, z: nz / len };
      }
    }
  });
}
