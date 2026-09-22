import { describe, expect, it, vi } from 'vitest';
import { Bresenham } from '../src';

function walk(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const points: [number, number][] = [];
    Bresenham.line(x0, y0, x1, y1, (x, y) => {
        points.push([x, y]);
    });
    return points;
}

describe('Bresenham.line', () => {
    it('yields a single cell when start and end are equal', () => {
        expect(walk(3, 4, 3, 4)).toEqual([[3, 4]]);
    });

    it('walks a horizontal line', () => {
        expect(walk(0, 0, 3, 0)).toEqual([
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ]);
    });

    it('walks a vertical line upwards', () => {
        expect(walk(0, 2, 0, -1)).toEqual([
            [0, 2],
            [0, 1],
            [0, 0],
            [0, -1],
        ]);
    });

    it('walks a diagonal line', () => {
        expect(walk(0, 0, 3, 3)).toEqual([
            [0, 0],
            [1, 1],
            [2, 2],
            [3, 3],
        ]);
    });

    it('walks a shallow line', () => {
        expect(walk(0, 0, 4, 2)).toEqual([
            [0, 0],
            [1, 0],
            [2, 1],
            [3, 1],
            [4, 2],
        ]);
    });

    it('produces max(|dx|, |dy|) + 1 connected cells in any direction', () => {
        const cases: [number, number, number, number][] = [
            [0, 0, 10, 3],
            [10, 3, 0, 0],
            [-5, 7, 6, -2],
            [2, -8, -3, 9],
        ];
        for (const [x0, y0, x1, y1] of cases) {
            const points = walk(x0, y0, x1, y1);
            expect(points).toHaveLength(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1);
            expect(points[0]).toEqual([x0, y0]);
            expect(points[points.length - 1]).toEqual([x1, y1]);
            for (let i = 1; i < points.length; ++i) {
                expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThanOrEqual(1);
                expect(Math.abs(points[i][1] - points[i - 1][1])).toBeLessThanOrEqual(1);
            }
        }
    });

    it('truncates non-integer coordinates', () => {
        expect(walk(0.9, 0.2, 2.7, 0.5)).toEqual([
            [0, 0],
            [1, 0],
            [2, 0],
        ]);
    });

    it('passes the cell index to the callback', () => {
        const indices: number[] = [];
        Bresenham.line(0, 0, 3, 1, (_x, _y, n) => {
            indices.push(n);
        });
        expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('returns true when the whole line is walked', () => {
        expect(Bresenham.line(0, 0, 5, 5, () => true)).toBe(true);
        expect(Bresenham.line(0, 0, 5, 5)).toBe(true);
    });

    it('stops and returns false when the callback returns false', () => {
        const cb = vi.fn((x: number) => x < 2);
        expect(Bresenham.line(0, 0, 10, 0, cb)).toBe(false);
        expect(cb).toHaveBeenCalledTimes(3);
    });
});
