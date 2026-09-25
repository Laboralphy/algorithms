/**
 * Options of a {@link Voronoi} diagram.
 */
export type VoronoiOptions = {
    /** Seed of the cell centers: same seed, same diagram. Defaults to 0. */
    seed?: number;
    /**
     * Size of the tile, in the caller's units (pixels, for instance). The diagram repeats
     * every `size[0]` horizontally and `size[1]` vertically, and distances are expressed in
     * these units.
     */
    size: [number, number];
    /**
     * Number of cells across the tile: one value for both axes, or `[columns, rows]`.
     * Positive integers, so that the diagram tiles.
     */
    cells: number | [number, number];
    /**
     * How far each cell center may move from the center of its grid cell, in `[0, 1]`:
     * `0` gives a regular grid, `1` lets a center go anywhere in its grid cell. Defaults to 1.
     */
    jitter?: number;
    /**
     * Shift of every other row, in fraction of a cell width, in `[0, 1)`. With a jitter of
     * 0, a stagger of 0.5 gives hexagonal cells. Needs an even number of rows. Defaults to 0.
     */
    stagger?: number;
};

/**
 * What a {@link Voronoi} diagram knows about a point.
 */
export type VoronoiSample = {
    /** Id of the cell holding the point, stable across the tile: `row * columns + column`. */
    cell: number;
    /** Center of that cell, in `[0, size[0]) × [0, size[1])`. */
    center: [number, number];
    /** Distance from the point to the center of its cell. */
    distance: number;
    /**
     * Perpendicular distance from the point to the nearest border of its cell: 0 on the
     * border, growing towards the center.
     */
    border: number;
    /** Id of the cell across that nearest border. */
    neighbor: number;
};

/**
 * Grids rendered by {@link Voronoi.render}, as arrays of rows: `grid[y][x]`.
 */
export type VoronoiGrids = {
    cell: Int32Array[];
    distance: Float32Array[];
    border: Float32Array[];
};

/**
 * Murmur3 finalizer: scrambles the bits of a 32-bit integer.
 */
function fmix(h: number): number {
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

function mod(a: number, n: number): number {
    return ((a % n) + n) % n;
}

/** grid cells searched around a point, on each side */
const SEARCH_RADIUS = 3;

/**
 * Seeded, tileable Voronoi diagram, with the exact distance to the cell borders.
 *
 * Cell centers lie on a jittered grid: one center per grid cell, moved at random inside
 * it. The diagram is computed on a torus: distances wrap around the tile, so a cell
 * crossing an edge continues on the opposite one, and the diagram tiles seamlessly. It has
 * no memory: centers are derived by hashing the seed with the grid coordinates.
 *
 * The distance to the border is the exact perpendicular distance to the nearest bisector,
 * not the usual `(F2 − F1) / 2` approximation, so that borders of a constant width can be
 * drawn with `border < width / 2`.
 *
 * @example
 * ```ts
 * const voronoi = new Voronoi({ seed: 42, size: [64, 64], cells: 5, jitter: 0.8 });
 * const { cell, border } = voronoi.sample(10.5, 20.5);
 * const isJoint = border < 1; // a 2-unit joint between cells
 * ```
 */
class Voronoi {
    readonly seed: number;
    readonly width: number;
    readonly height: number;
    readonly columns: number;
    readonly rows: number;
    readonly jitter: number;
    readonly stagger: number;
    private readonly cellWidth: number;
    private readonly cellHeight: number;
    /** jitter of each cell center, in fraction of a cell: x then y, row by row */
    private readonly offsets: Float64Array;
    /** candidates of a sample, reused from one sample to the next */
    private readonly candidateX: Float64Array;
    private readonly candidateY: Float64Array;
    private readonly candidateD2: Float64Array;
    private readonly candidateId: Int32Array;

    constructor({ seed = 0, size, cells, jitter = 1, stagger = 0 }: VoronoiOptions) {
        const [width, height] = size;
        const [columns, rows] = typeof cells === 'number' ? [cells, cells] : cells;
        if (!(width > 0 && height > 0)) {
            throw new RangeError(`Voronoi: size must be positive, got ${size}`);
        }
        if (![columns, rows].every((n) => Number.isInteger(n) && n > 0)) {
            throw new RangeError(`Voronoi: cells must be positive integers, got ${cells}`);
        }
        if (!(jitter >= 0 && jitter <= 1)) {
            throw new RangeError(`Voronoi: jitter must be in [0, 1], got ${jitter}`);
        }
        if (!(stagger >= 0 && stagger < 1)) {
            throw new RangeError(`Voronoi: stagger must be in [0, 1), got ${stagger}`);
        }
        if (stagger > 0 && rows % 2 === 1) {
            throw new RangeError('Voronoi: a stagger needs an even number of rows to tile');
        }
        this.seed = seed >>> 0;
        this.width = width;
        this.height = height;
        this.columns = columns;
        this.rows = rows;
        this.jitter = jitter;
        this.stagger = stagger;
        this.cellWidth = width / columns;
        this.cellHeight = height / rows;
        this.offsets = new Float64Array(2 * columns * rows);
        for (let r = 0; r < rows; ++r) {
            for (let c = 0; c < columns; ++c) {
                const i = 2 * (r * columns + c);
                this.offsets[i] = (this.random(c, r, 0) - 0.5) * jitter;
                this.offsets[i + 1] = (this.random(c, r, 1) - 0.5) * jitter;
            }
        }
        const count = (2 * SEARCH_RADIUS + 1) ** 2;
        this.candidateX = new Float64Array(count);
        this.candidateY = new Float64Array(count);
        this.candidateD2 = new Float64Array(count);
        this.candidateId = new Int32Array(count);
    }

    /**
     * Pseudo-random value in `[0, 1)` attached to a grid cell.
     */
    private random(column: number, row: number, axis: number): number {
        let h = fmix(this.seed + 0x9e3779b9);
        h = fmix((h ^ column) + 0x9e3779b9);
        h = fmix((h ^ row) + 0x9e3779b9);
        h = fmix((h ^ axis) + 0x9e3779b9);
        return h / 4294967296;
    }

    /**
     * Center of the cell of grid coordinates `(column, row)`. Coordinates outside the grid
     * address the copies of the tile around it: the center is then outside the tile too,
     * shifted by whole tile sizes.
     */
    private centerOf(column: number, row: number): [number, number] {
        const c = mod(column, this.columns);
        const r = mod(row, this.rows);
        const shift = r % 2 === 1 ? this.stagger : 0;
        const i = 2 * (r * this.columns + c);
        const jx = this.offsets[i];
        const jy = this.offsets[i + 1];
        return [(column + 0.5 + shift + jx) * this.cellWidth, (row + 0.5 + jy) * this.cellHeight];
    }

    /**
     * Id of the cell of grid coordinates `(column, row)`, wrapped into the grid.
     */
    private idOf(column: number, row: number): number {
        return mod(row, this.rows) * this.columns + mod(column, this.columns);
    }

    /**
     * Samples the diagram at a point. The diagram repeats every `size[0]` and `size[1]`.
     *
     * @param x - Horizontal coordinate, in the units of `size`.
     * @param y - Vertical coordinate, in the units of `size`.
     */
    sample(x: number, y: number): VoronoiSample {
        const px = mod(x, this.width);
        const py = mod(y, this.height);
        const row0 = Math.floor(py / this.cellHeight);

        // the cell centers around the point, and the nearest one
        const xs = this.candidateX;
        const ys = this.candidateY;
        const d2s = this.candidateD2;
        const ids = this.candidateId;
        let count = 0;
        let nearest = 0;
        for (let row = row0 - SEARCH_RADIUS; row <= row0 + SEARCH_RADIUS; ++row) {
            const shift = mod(row, this.rows) % 2 === 1 ? this.stagger : 0;
            const column0 = Math.floor(px / this.cellWidth - shift);
            for (
                let column = column0 - SEARCH_RADIUS;
                column <= column0 + SEARCH_RADIUS;
                ++column
            ) {
                const [cx, cy] = this.centerOf(column, row);
                xs[count] = cx;
                ys[count] = cy;
                d2s[count] = (px - cx) ** 2 + (py - cy) ** 2;
                ids[count] = this.idOf(column, row);
                if (d2s[count] < d2s[nearest]) {
                    nearest = count;
                }
                ++count;
            }
        }

        // the nearest border: the nearest bisector between the cell and another one
        const ax = xs[nearest];
        const ay = ys[nearest];
        const ad2 = d2s[nearest];
        let border = Infinity;
        let neighbor = ids[nearest];
        for (let i = 0; i < count; ++i) {
            if (i === nearest) {
                continue;
            }
            const gap = Math.hypot(xs[i] - ax, ys[i] - ay);
            if (gap === 0) {
                continue;
            }
            const d = (d2s[i] - ad2) / (2 * gap);
            if (d < border) {
                border = d;
                neighbor = ids[i];
            }
        }
        return {
            cell: ids[nearest],
            center: [mod(ax, this.width), mod(ay, this.height)],
            distance: Math.sqrt(ad2),
            border,
            neighbor,
        };
    }

    /**
     * Renders one tile as grids of the given size, sampled at the center of each pixel.
     *
     * @param width - Grid width, in pixels, spanning `size[0]`.
     * @param height - Grid height, in pixels, spanning `size[1]`.
     * @returns Cell ids, distances to the centers and distances to the borders, in the
     *   units of `size`, as arrays of rows (`grid[y][x]`).
     */
    render(width: number, height: number): VoronoiGrids {
        const grids: VoronoiGrids = { cell: [], distance: [], border: [] };
        for (let y = 0; y < height; ++y) {
            const cell = new Int32Array(width);
            const distance = new Float32Array(width);
            const border = new Float32Array(width);
            for (let x = 0; x < width; ++x) {
                const s = this.sample(
                    ((x + 0.5) * this.width) / width,
                    ((y + 0.5) * this.height) / height,
                );
                cell[x] = s.cell;
                distance[x] = s.distance;
                border[x] = s.border;
            }
            grids.cell.push(cell);
            grids.distance.push(distance);
            grids.border.push(border);
        }
        return grids;
    }
}

export default Voronoi;
