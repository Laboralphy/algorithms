import { describe, expect, it } from 'vitest';
import { FractalNoise } from '../src';

describe('FractalNoise', () => {
    it('returns values in [0, 1)', () => {
        const noise = new FractalNoise({ seed: 1, octaves: 6 });
        for (let i = 0; i < 1000; ++i) {
            const v = noise.sample(Math.random() * 10 - 5, Math.random() * 10 - 5);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('is deterministic for a given seed', () => {
        const a = new FractalNoise({ seed: 42 }).render(16, 16);
        const b = new FractalNoise({ seed: 42 }).render(16, 16);
        const c = new FractalNoise({ seed: 43 }).render(16, 16);
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it('repeats every 1 on both axes', () => {
        const noise = new FractalNoise({ seed: 7, period: [3, 5], octaves: 3 });
        for (const [u, v] of [
            [0.1, 0.2],
            [0.73, 0.41],
            [0.999, 0.5],
        ]) {
            const s = noise.sample(u, v);
            expect(noise.sample(u + 1, v)).toBeCloseTo(s, 6);
            expect(noise.sample(u, v + 1)).toBeCloseTo(s, 6);
            expect(noise.sample(u - 2, v - 3)).toBeCloseTo(s, 6);
        }
    });

    it('is continuous', () => {
        const noise = new FractalNoise({ seed: 3 });
        for (let u = 0; u < 1; u += 0.01) {
            expect(Math.abs(noise.sample(u + 1e-6, 0.3) - noise.sample(u, 0.3))).toBeLessThan(1e-3);
        }
    });

    it('wraps seamlessly across the tile edge', () => {
        const noise = new FractalNoise({ seed: 5 });
        expect(noise.sample(1 - 1e-9, 0.5)).toBeCloseTo(noise.sample(0, 0.5), 5);
    });

    it('renders the same features at any resolution', () => {
        const noise = new FractalNoise({ seed: 9, period: 4, octaves: 3 });
        const small = noise.render(32, 24);
        const large = noise.render(64, 48);
        for (let y = 0; y < 24; ++y) {
            for (let x = 0; x < 32; ++x) {
                expect(large[2 * y][2 * x]).toBeCloseTo(small[y][x], 6);
            }
        }
    });

    it('renders non power-of-two sizes', () => {
        const grid = new FractalNoise().render(37, 13);
        expect(grid).toHaveLength(13);
        expect(grid[0]).toHaveLength(37);
    });

    it('rejects invalid options', () => {
        expect(() => new FractalNoise({ period: 2.5 })).toThrow(RangeError);
        expect(() => new FractalNoise({ period: [4, 0] })).toThrow(RangeError);
        expect(() => new FractalNoise({ octaves: 0 })).toThrow(RangeError);
        expect(() => new FractalNoise({ persistence: 0 })).toThrow(RangeError);
    });
});
