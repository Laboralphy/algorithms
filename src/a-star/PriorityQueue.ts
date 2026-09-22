/**
 * Binary min-heap: {@link PriorityQueue.pop} always returns the smallest item
 * according to the comparison function. `push` and `pop` run in O(log n).
 */
export class PriorityQueue<T> {
    private readonly _items: T[] = [];

    /**
     * @param _compare - Returns a negative number when `a` must come out before `b`,
     * a positive number when `b` must come out first, 0 when either order is fine.
     */
    constructor(private readonly _compare: (a: T, b: T) => number) {}

    get size(): number {
        return this._items.length;
    }

    push(item: T): void {
        const items = this._items;
        items.push(item);
        let i = items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this._compare(items[i], items[parent]) >= 0) {
                break;
            }
            [items[i], items[parent]] = [items[parent], items[i]];
            i = parent;
        }
    }

    /**
     * Removes and returns the smallest item, or `undefined` if the queue is empty.
     */
    pop(): T | undefined {
        const items = this._items;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0 && last !== undefined) {
            items[0] = last;
            let i = 0;
            while (true) {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;
                if (left < items.length && this._compare(items[left], items[smallest]) < 0) {
                    smallest = left;
                }
                if (right < items.length && this._compare(items[right], items[smallest]) < 0) {
                    smallest = right;
                }
                if (smallest === i) {
                    break;
                }
                [items[i], items[smallest]] = [items[smallest], items[i]];
                i = smallest;
            }
        }
        return top;
    }
}
