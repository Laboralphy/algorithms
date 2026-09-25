import { describe, expect, it } from 'vitest';
import { Voronoi, type VoronoiOptions } from '../src';

/**
 * Reference: every center of the tile and of its 8 copies, the nearest one, and the
 * nearest bisector, computed by brute force.
 */
function bruteForce(options: VoronoiOptions, x: number, y: number) {
    const voronoi = new Voronoi(options);
    const [w, h] = options.size;
    const px = ((x % w) + w) % w;
    const py = ((y % h) + h) % h;
    const centers: { id: number; x: number; y: number }[] = [];
    for (let row = 0; row < voronoi.rows; ++row) {
        for (let column = 0; column < voronoi.columns; ++column) {
            // the center of the cell, through the private method, then its 8 copies
            const probe = voronoi['centerOf'](column, row) as [number, number];
            for (let ty = -1; ty <= 1; ++ty) {
                for (let tx = -1; tx <= 1; ++tx) {
                    centers.push({
                        id: row * voronoi.columns + column,
                        x: probe[0] + tx * w,
                        y: probe[1] + ty * h,
                    });
                }
            }
        }
    }
    const d2 = (c: { x: number; y: number }) => (px - c.x) ** 2 + (py - c.y) ** 2;
    const a = centers.reduce((best, c) => (d2(c) < d2(best) ? c : best));
    let border = Infinity;
    for (const b of centers) {
        const gap = Math.hypot(b.x - a.x, b.y - a.y);
        if (gap > 0) {
            border = Math.min(border, (d2(b) - d2(a)) / (2 * gap));
        }
    }
    return { cell: a.id, distance: Math.sqrt(d2(a)), border };
}

/** deterministic pseudo-random points */
function points(count: number, w: number, h: number): [number, number][] {
    let s = 12345;
    const next = () => {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        return s / 4294967296;
    };
    return Array.from({ length: count }, () => [next() * w, next() * h]);
}

describe('Voronoi', () => {
    it('matches a brute force search, cells, distances and borders', () => {
        const cases: VoronoiOptions[] = [
            { seed: 1, size: [64, 64], cells: 5, jitter: 1 },
            { seed: 2, size: [100, 60], cells: [7, 4], jitter: 0.7 },
            { seed: 3, size: [64, 64], cells: [6, 6], jitter: 1, stagger: 0.5 },
            { seed: 4, size: [32, 96], cells: [2, 8], jitter: 0.3, stagger: 0.25 },
        ];
        for (const options of cases) {
            for (const [x, y] of points(300, options.size[0], options.size[1])) {
                const s = new Voronoi(options).sample(x, y);
                const ref = bruteForce(options, x, y);
                expect(s.cell).toBe(ref.cell);
                expect(s.distance).toBeCloseTo(ref.distance, 9);
                expect(s.border).toBeCloseTo(ref.border, 9);
            }
        }
    });

    it('is deterministic for a given seed', () => {
        const a = new Voronoi({ seed: 42, size: [32, 32], cells: 4 }).render(16, 16);
        const b = new Voronoi({ seed: 42, size: [32, 32], cells: 4 }).render(16, 16);
        const c = new Voronoi({ seed: 43, size: [32, 32], cells: 4 }).render(16, 16);
        expect(a).toEqual(b);
        expect(a.border).not.toEqual(c.border);
    });

    it('repeats every tile size on both axes', () => {
        const voronoi = new Voronoi({ seed: 7, size: [50, 30], cells: [5, 4], stagger: 0.5 });
        for (const [x, y] of points(100, 50, 30)) {
            const s = voronoi.sample(x, y);
            for (const [dx, dy] of [
                [50, 0],
                [0, 30],
                [-100, -60],
            ]) {
                const t = voronoi.sample(x + dx, y + dy);
                expect(t.cell).toBe(s.cell);
                expect(t.border).toBeCloseTo(s.border, 9);
            }
        }
    });

    it('gives a regular grid without jitter: square cells, exact borders', () => {
        const voronoi = new Voronoi({ size: [64, 64], cells: 4, jitter: 0 });
        const s = voronoi.sample(5, 8);
        expect(s.cell).toBe(0);
        expect(s.center).toEqual([8, 8]);
        expect(s.distance).toBeCloseTo(3, 9);
        // the nearest border is the left one, 5 units away, shared with the last column
        expect(s.border).toBeCloseTo(5, 9);
        expect(s.neighbor).toBe(3);
        // cells cross the edges: the left border of the first column is at x = 0
        expect(voronoi.sample(63.5, 8).cell).toBe(3);
    });

    it('gives hexagonal cells with a half stagger', () => {
        const voronoi = new Voronoi({ size: [60, 60], cells: [6, 6], jitter: 0, stagger: 0.5 });
        // odd rows are shifted by half a cell
        expect(voronoi.sample(15, 5).center).toEqual([15, 5]);
        expect(voronoi.sample(20, 15).center).toEqual([20, 15]);
        // six neighbors around a cell: sample around its center
        const neighbors = new Set<number>();
        for (let a = 0; a < 360; a += 5) {
            const r = (a * Math.PI) / 180;
            neighbors.add(voronoi.sample(35 + Math.cos(r) * 9, 25 + Math.sin(r) * 9).cell);
        }
        neighbors.delete(voronoi.sample(35, 25).cell);
        expect(neighbors.size).toBe(6);
    });

    it('renders grids sampled at pixel centers', () => {
        const voronoi = new Voronoi({ seed: 5, size: [64, 32], cells: [4, 2] });
        const grids = voronoi.render(16, 8);
        expect(grids.cell).toHaveLength(8);
        expect(grids.cell[0]).toHaveLength(16);
        const s = voronoi.sample(4 * 3.5, 4 * 2.5);
        expect(grids.cell[2][3]).toBe(s.cell);
        expect(grids.border[2][3]).toBeCloseTo(s.border, 5);
    });

    it('rejects invalid options', () => {
        const size: [number, number] = [64, 64];
        expect(() => new Voronoi({ size: [0, 64], cells: 4 })).toThrow(RangeError);
        expect(() => new Voronoi({ size, cells: 2.5 })).toThrow(RangeError);
        expect(() => new Voronoi({ size, cells: 4, jitter: 1.5 })).toThrow(RangeError);
        expect(() => new Voronoi({ size, cells: 4, stagger: 1 })).toThrow(RangeError);
        expect(() => new Voronoi({ size, cells: [4, 3], stagger: 0.5 })).toThrow(RangeError);
    });
});
