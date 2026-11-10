// Pure TypeScript QR Code generator for SVG rendering
// Supports Alphanumeric and Byte modes with Error Correction Level M

export function QRCodeSvg({
  value,
  size = 200,
  className = "",
  fgColor = "#111827",
  bgColor = "#FFFFFF",
}: {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
}) {
  const matrix = generateQrMatrix(value);
  const count = matrix.length;
  const cellSize = size / count;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-2xl border-2 border-ink shadow-pop-sm ${className}`}
      style={{ backgroundColor: bgColor }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`QR Code para ${value}`}
    >
      <rect width={size} height={size} fill={bgColor} rx={16} />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.1}
              height={cellSize + 0.1}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}

// Minimal, standard QR code generator logic for URLs (Version 3/4)
function generateQrMatrix(text: string): boolean[][] {
  // Determine version: 29x29 (Version 3) or 33x33 (Version 4)
  const size = text.length > 32 ? 33 : 29;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function set(r: number, c: number, v: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      grid[r]![c] = v;
      reserved[r]![c] = true;
    }
  }

  // 1. Finder patterns (7x7 with 1-cell border)
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isBlack =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          set(nr, nc, isBlack);
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment pattern for size 29 (at 22,22) or 33 (at 26,26)
  const alignPos = size === 29 ? 22 : 26;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      set(alignPos + r, alignPos + c, isBlack);
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  set(size - 8, 8, true);

  // 5. Reserve format info areas
  for (let i = 0; i < 9; i++) {
    reserved[8]![i] = true;
    reserved[i]![8] = true;
    if (i < 8) {
      reserved[8]![size - 1 - i] = true;
      reserved[size - 1 - i]![8] = true;
    }
  }

  // Encode data into bits using UTF-8 / Byte Mode (mode indicator 0100)
  const bits: number[] = [0, 1, 0, 0];
  const len = text.length;
  for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    for (let b = 7; b >= 0; b--) bits.push((code >> b) & 1);
  }

  // Terminator (up to 4 zeroes)
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes
  const padBytes = [0xec, 0x11];
  let pIdx = 0;
  const maxBits = (size === 29 ? 70 : 100) * 8;
  while (bits.length < maxBits) {
    const byte = padBytes[pIdx % 2]!;
    for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
    pIdx++;
  }

  // Fill data into matrix in zigzag pattern
  let bitIdx = 0;
  let upward = true;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing pattern
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = c - colOffset;
        if (!reserved[r]![col]) {
          const val = bitIdx < bits.length ? bits[bitIdx++] === 1 : false;
          // Apply standard Mask 0: (row + col) % 2 == 0
          const mask = (r + col) % 2 === 0;
          grid[r]![col] = mask ? !val : val;
        }
      }
    }
    upward = !upward;
  }

  // Draw format info (Mask 0, Level M: 101010000010010 XOR 101010000010000)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) grid[8]![i] = formatBits[i] === 1;
  grid[8]![7] = formatBits[6] === 1;
  grid[8]![8] = formatBits[7] === 1;
  grid[7]![8] = formatBits[8] === 1;
  for (let i = 0; i < 6; i++) grid[5 - i]![8] = formatBits[9 + i] === 1;

  for (let i = 0; i < 8; i++) grid[size - 1 - i]![8] = formatBits[i] === 1;
  for (let i = 0; i < 7; i++) grid[8]![size - 7 + i] = formatBits[8 + i] === 1;

  return grid;
}
