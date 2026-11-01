// QR code (ISO/IEC 18004), mode octets, correction M. Sans dépendance : un seul usage, le lien d'invitation.
const EC_PER_BLOCK = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
];
const BLOCKS = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33,
  35, 37, 38, 40, 43, 45, 47, 49,
];
const FORMAT_BITS_M = 0;

const rawModules = (version: number): number => {
  let bits = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    bits -= (25 * align - 10) * align - 55;
    if (version >= 7) bits -= 36;
  }
  return bits;
};

const dataCodewords = (version: number): number =>
  Math.floor(rawModules(version) / 8) - EC_PER_BLOCK[version]! * BLOCKS[version]!;

const gfMultiply = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const rsDivisor = (degree: number): number[] => {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < degree) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMultiply(root, 2);
  }
  return result;
};

const rsRemainder = (data: number[], divisor: number[]): number[] => {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = result[i]! ^ gfMultiply(coef, factor);
    });
  }
  return result;
};

const withErrorCorrection = (data: number[], version: number): number[] => {
  const blockCount = BLOCKS[version]!;
  const ecLength = EC_PER_BLOCK[version]!;
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blockCount - (raw % blockCount);
  const shortLength = Math.floor(raw / blockCount);
  const divisor = rsDivisor(ecLength);
  const blocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const length = shortLength - ecLength + (i < shortBlocks ? 0 : 1);
    const part = data.slice(k, k + length);
    k += length;
    const ec = rsRemainder(part, divisor);
    if (i < shortBlocks) part.push(0);
    blocks.push([...part, ...ec]);
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - ecLength || j >= shortBlocks) result.push(block[i]!);
    });
  }
  return result;
};

const utf8Bytes = (text: string): number[] => {
  const encoded = encodeURI(text);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === "%" && /^[0-9A-Fa-f]{2}$/.test(encoded.slice(i + 1, i + 3))) {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
};

const encodeData = (bytes: number[]): { version: number; data: number[] } => {
  for (let version = 1; version <= 40; version += 1) {
    const capacity = dataCodewords(version) * 8;
    const lengthBits = version <= 9 ? 8 : 16;
    if (4 + lengthBits + bytes.length * 8 > capacity) continue;
    const bits: number[] = [];
    const push = (value: number, count: number) => {
      for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    push(4, 4);
    push(bytes.length, lengthBits);
    bytes.forEach((byte) => push(byte, 8));
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
    }
    return { version, data };
  }
  throw new Error("qr_too_long");
};

const alignmentPositions = (version: number, size: number): number[] => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
};

const maskAt = (mask: number, x: number, y: number): boolean => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
};

const penaltyOf = (modules: boolean[][]): number => {
  const size = modules.length;
  let penalty = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 0;
    let previous = false;
    let window = 0;
    for (let i = 0; i < size; i += 1) {
      const dark = get(i);
      if (i > 0 && dark === previous) {
        run += 1;
        if (run === 5) penalty += 3;
        else if (run > 5) penalty += 1;
      } else {
        run = 1;
        previous = dark;
      }
      window = ((window << 1) & 0x7ff) | (dark ? 1 : 0);
      if (i >= 10 && (window === 0b10111010000 || window === 0b00001011101)) penalty += 40;
    }
  };
  for (let y = 0; y < size; y += 1) line((x) => modules[y]![x]!);
  for (let x = 0; x < size; x += 1) line((y) => modules[y]![x]!);
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y]![x]) dark += 1;
      if (
        y + 1 < size &&
        x + 1 < size &&
        modules[y]![x] === modules[y]![x + 1] &&
        modules[y]![x] === modules[y + 1]![x] &&
        modules[y]![x] === modules[y + 1]![x + 1]
      ) {
        penalty += 3;
      }
    }
  }
  const total = size * size;
  penalty += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return penalty;
};

// Vrai = module sombre. Lignes puis colonnes, sans la zone de silence (4 modules, à laisser autour).
export const qrMatrix = (text: string): boolean[][] => {
  const { version, data } = encodeData(utf8Bytes(text));
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y]![x] = dark;
    reserved[y]![x] = true;
  };

  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const positions = alignmentPositions(version, size);
  positions.forEach((py, i) => {
    positions.forEach((px, j) => {
      const corner =
        (i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0);
      if (corner) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  const drawFormat = (mask: number) => {
    const value = (FORMAT_BITS_M << 3) | mask;
    let rem = value;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((value << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  const codewords = withErrorCorrection(data, version);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y]![x] && i < codewords.length * 8) {
          modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i += 1;
        }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!reserved[y]![x] && maskAt(mask, x, y)) modules[y]![x] = !modules[y]![x];
      }
    }
  };
  let best = 0;
  let lowest = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormat(mask);
    const penalty = penaltyOf(modules);
    if (penalty < lowest) {
      lowest = penalty;
      best = mask;
    }
    applyMask(mask);
  }
  applyMask(best);
  drawFormat(best);
  return modules;
};
