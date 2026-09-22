/**
 * Callback invoked for every cell crossed by a {@link Bresenham.line}.
 *
 * @param x - X coordinate of the current cell.
 * @param y - Y coordinate of the current cell.
 * @param n - Zero-based index of the current cell along the line.
 * @returns `false` to stop the walk early; any other value (or nothing) continues.
 */
export type BresenhamCallback = (x: number, y: number, n: number) => boolean | void;

/**
 * Bresenham's line algorithm: enumerates the integer grid cells forming
 * a straight line between two points.
 *
 * @example
 * ```ts
 * const points: [number, number][] = [];
 * Bresenham.line(0, 0, 4, 2, (x, y) => {
 *     points.push([x, y]);
 * });
 * // points: [[0,0],[1,0],[2,1],[3,1],[4,2]]
 * ```
 */
class Bresenham {
    /**
     * Walks every cell of the line going from `(x0, y0)` to `(x1, y1)`, both ends included.
     * Coordinates are truncated to integers.
     *
     * @param x0 - Start X coordinate.
     * @param y0 - Start Y coordinate.
     * @param x1 - End X coordinate.
     * @param y1 - End Y coordinate.
     * @param pCallback - Optional function called for every cell; returning `false`
     * aborts the walk (useful for line-of-sight checks).
     * @returns `true` if the whole line has been walked, `false` if the callback aborted it.
     */
    static line(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        pCallback?: BresenhamCallback,
    ): boolean {
        x0 |= 0;
        y0 |= 0;
        x1 |= 0;
        y1 |= 0;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let n = 0;
        while (true) {
            if (pCallback) {
                if (pCallback(x0, y0, n) === false) {
                    return false;
                }
            }
            if (x0 === x1 && y0 === y1) {
                break;
            }
            const e2 = err << 1;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
            ++n;
        }
        return true;
    }
}

export default Bresenham;
