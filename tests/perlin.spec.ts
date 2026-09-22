import { describe, expect, it } from 'vitest';
import { Perlin } from '../src';

/** Deterministic pseudo-random generator (mulberry32) for reproducible grids. */
function rng(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomGrid(width: number, height: number, seed = 1): Float32Array[] {
    const random = rng(seed);
    return Array.from({ length: height }, () =>
        Float32Array.from({ length: width }, () => random()),
    );
}

describe('Perlin.computeOptimalOctaves', () => {
    it('returns the largest i such that 2^i <= n', () => {
        expect(Perlin.computeOptimalOctaves(1)).toBe(0);
        expect(Perlin.computeOptimalOctaves(2)).toBe(1);
        expect(Perlin.computeOptimalOctaves(63)).toBe(5);
        expect(Perlin.computeOptimalOctaves(64)).toBe(6);
        expect(Perlin.computeOptimalOctaves(100)).toBe(6);
    });

    it('is capped at 10', () => {
        expect(Perlin.computeOptimalOctaves(1 << 12)).toBe(10);
    });

    it('returns 0 for sizes below 1', () => {
        expect(Perlin.computeOptimalOctaves(0)).toBe(0);
    });
});

describe('Perlin.cosineInterpolate', () => {
    it('returns the bounds at mu = 0 and mu = 1', () => {
        expect(Perlin.cosineInterpolate(2, 8, 0)).toBeCloseTo(2);
        expect(Perlin.cosineInterpolate(2, 8, 1)).toBeCloseTo(8);
    });

    it('returns the midpoint at mu = 0.5', () => {
        expect(Perlin.cosineInterpolate(2, 8, 0.5)).toBeCloseTo(5);
    });

    it('is monotonic between the bounds', () => {
        let previous = -Infinity;
        for (let mu = 0; mu <= 1; mu += 0.05) {
            const v = Perlin.cosineInterpolate(0, 1, mu);
            expect(v).toBeGreaterThanOrEqual(previous);
            previous = v;
        }
    });
});

describe('Perlin.generateSmoothNoise', () => {
    it('returns a copy of the base noise at octave 0', () => {
        const base = randomGrid(8, 8);
        const smooth = Perlin.generateSmoothNoise(base, 0);
        expect(smooth).toEqual(base);
        expect(smooth[0]).not.toBe(base[0]);
    });

    it('keeps the base values on sample points', () => {
        const base = randomGrid(16, 16);
        const smooth = Perlin.generateSmoothNoise(base, 2);
        for (let y = 0; y < 16; y += 4) {
            for (let x = 0; x < 16; x += 4) {
                expect(smooth[y][x]).toBeCloseTo(base[y][x]);
            }
        }
    });

    it('supports non-square grids', () => {
        const base = randomGrid(12, 5);
        const smooth = Perlin.generateSmoothNoise(base, 1);
        expect(smooth).toHaveLength(5);
        smooth.forEach((row) => {
            expect(row).toHaveLength(12);
            row.forEach((v) => expect(Number.isFinite(v)).toBe(true));
        });
    });
});

describe('Perlin.generate', () => {
    it('keeps the grid dimensions', () => {
        const noise = Perlin.generate(randomGrid(20, 10), 3);
        expect(noise).toHaveLength(10);
        noise.forEach((row) => expect(row).toHaveLength(20));
    });

    it('keeps values within the base noise range', () => {
        const noise = Perlin.generate(randomGrid(32, 32), Perlin.computeOptimalOctaves(32));
        noise.forEach((row) =>
            row.forEach((v) => {
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(1);
            }),
        );
    });

    it('returns the base noise when using a single octave', () => {
        const base = randomGrid(8, 8);
        const noise = Perlin.generate(base, 1);
        for (let y = 0; y < 8; ++y) {
            for (let x = 0; x < 8; ++x) {
                expect(noise[y][x]).toBeCloseTo(base[y][x], 5);
            }
        }
    });

    it('is deterministic for a given base noise', () => {
        const a = Perlin.generate(randomGrid(16, 16, 42), 4);
        const b = Perlin.generate(randomGrid(16, 16, 42), 4);
        expect(a).toEqual(b);
    });

    it('is smoother than the base noise', () => {
        const roughness = (grid: Float32Array[]) => {
            let sum = 0;
            for (const row of grid) {
                for (let x = 1; x < row.length; ++x) {
                    sum += Math.abs(row[x] - row[x - 1]);
                }
            }
            return sum;
        };
        const base = randomGrid(64, 64);
        const noise = Perlin.generate(base, 5);
        expect(roughness(noise)).toBeLessThan(roughness(base) / 2);
    });
});

describe('Perlin.colorize', () => {
    it('maps values to palette entries in row-major order', () => {
        const noise = [Float32Array.from([0, 0.3, 0.6]), Float32Array.from([0.99, 0.5, 0.1])];
        expect(Perlin.colorize(noise, ['a', 'b', 'c'])).toEqual(['a', 'a', 'b', 'c', 'b', 'a']);
    });

    it('clamps values of 1 or more to the last entry', () => {
        const noise = [Float32Array.from([1, 1.5])];
        expect(Perlin.colorize(noise, ['a', 'b'])).toEqual(['b', 'b']);
    });
});
