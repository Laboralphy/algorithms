import { describe, expect, it } from 'vitest';
import { PriorityQueue } from '../src/a-star/PriorityQueue';

describe('PriorityQueue', () => {
    it('returns undefined when empty', () => {
        const queue = new PriorityQueue<number>((a, b) => a - b);
        expect(queue.size).toBe(0);
        expect(queue.pop()).toBeUndefined();
    });

    it('pops items in ascending order', () => {
        const queue = new PriorityQueue<number>((a, b) => a - b);
        const values = [5, 3, 9, 1, 7, 3, 0, 8, 2, 6, 4];
        values.forEach((v) => queue.push(v));
        expect(queue.size).toBe(values.length);
        const popped: number[] = [];
        for (let v = queue.pop(); v !== undefined; v = queue.pop()) {
            popped.push(v);
        }
        expect(popped).toEqual([...values].sort((a, b) => a - b));
        expect(queue.size).toBe(0);
    });

    it('stays ordered when pushes and pops are interleaved', () => {
        const queue = new PriorityQueue<number>((a, b) => a - b);
        const reference: number[] = [];
        let seed = 7;
        for (let i = 0; i < 500; ++i) {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            if (seed % 3 === 0 && reference.length > 0) {
                reference.sort((a, b) => a - b);
                expect(queue.pop()).toBe(reference.shift());
            } else {
                queue.push(seed % 100);
                reference.push(seed % 100);
            }
        }
        expect(queue.size).toBe(reference.length);
    });

    it('uses the comparison function', () => {
        const queue = new PriorityQueue<{ name: string; rank: number }>((a, b) => b.rank - a.rank);
        queue.push({ name: 'low', rank: 1 });
        queue.push({ name: 'high', rank: 10 });
        queue.push({ name: 'mid', rank: 5 });
        expect(queue.pop()?.name).toBe('high');
        expect(queue.pop()?.name).toBe('mid');
        expect(queue.pop()?.name).toBe('low');
    });
});
