/**
 * Options of a {@link FractalNoise} generator. Every field is optional.
 */
export type FractalNoiseOptions = {
    /** Seed of the lattice values: same seed, same noise. Defaults to 0. */
    seed?: number;
    /**
     * Number of lattice cells across one tile at the first octave, either one value for
     * both axes or `[x, y]`. Larger values give smaller features. Must be positive
     * integers, so that the noise tiles. Defaults to 4.
     */
    period?: number | [number, number];
    /** Number of octaves to blend; each one doubles the frequency. Defaults to 4. */
    octaves?: number;
    /** Weight ratio between an octave and the previous one, in `(0, 1]`. Defaults to 0.5. */
    persistence?: number;
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

/**
 * Seeded, tileable fractal value noise that can be sampled at any point.
 *
 * Unlike {@link Perlin}, which smooths a precomputed grid, this generator has no
 * memory: lattice values are derived by hashing the seed with the lattice coordinates.
 * Coordinates are expressed in **tile units**: the noise repeats every 1 on both axes,
 * whatever the pixel size it is rendered at. Rendering the same noise at 32x32 and at
 * 64x64 gives the same features, twice as large in the second case.
 *
 * @example
 * ```ts
 * const noise = new FractalNoise({ seed: 42, period: 4, octaves: 5 });
 * const value = noise.sample(0.25, 0.5); // in [0, 1)
 * const grid = noise.render(64, 64); // grid[y][x], tiles seamlessly
 * ```
 */
class FractalNoise {
    readonly seed: number;
    readonly periodX: number;
    readonly periodY: number;
    readonly octaves: number;
    readonly persistence: number;
    private readonly totalAmplitude: number;

    constructor({
        seed = 0,
        period = 4,
        octaves = 4,
        persistence = 0.5,
    }: FractalNoiseOptions = {}) {
        const [periodX, periodY] = typeof period === 'number' ? [period, period] : period;
        if (![periodX, periodY].every((p) => Number.isInteger(p) && p > 0)) {
            throw new RangeError(`FractalNoise: period must be positive integers, got ${period}`);
        }
        if (!Number.isInteger(octaves) || octaves < 1) {
            throw new RangeError(
                `FractalNoise: octaves must be a positive integer, got ${octaves}`,
            );
        }
        if (!(persistence > 0 && persistence <= 1)) {
            throw new RangeError(`FractalNoise: persistence must be in (0, 1], got ${persistence}`);
        }
        this.seed = seed >>> 0;
        this.periodX = periodX;
        this.periodY = periodY;
        this.octaves = octaves;
        this.persistence = persistence;
        let total = 0;
        for (let i = 0, a = 1; i < octaves; ++i, a *= persistence) {
            total += a;
        }
        this.totalAmplitude = total;
    }

    /**
     * Pseudo-random value in `[0, 1)` attached to a lattice point of an octave.
     */
    private lattice(octave: number, ix: number, iy: number): number {
        let h = fmix(this.seed + 0x9e3779b9);
        h = fmix((h ^ octave) + 0x9e3779b9);
        h = fmix((h ^ ix) + 0x9e3779b9);
        h = fmix((h ^ iy) + 0x9e3779b9);
        return h / 4294967296;
    }

    /**
     * Cosine-interpolated noise of a single octave, periodic with period 1.
     */
    private octave(octave: number, u: number, v: number): number {
        const px = this.periodX << octave;
        const py = this.periodY << octave;
        const x = (((u % 1) + 1) % 1) * px;
        const y = (((v % 1) + 1) % 1) * py;
        // the modulo guards against rounding: a tiny negative u wraps to exactly 1
        const x0 = Math.floor(x) % px;
        const y0 = Math.floor(y) % py;
        const x1 = (x0 + 1) % px;
        const y1 = (y0 + 1) % py;
        const fx = (1 - Math.cos((x - Math.floor(x)) * Math.PI)) / 2;
        const fy = (1 - Math.cos((y - Math.floor(y)) * Math.PI)) / 2;
        const top = this.lattice(octave, x0, y0) * (1 - fx) + this.lattice(octave, x1, y0) * fx;
        const bottom = this.lattice(octave, x0, y1) * (1 - fx) + this.lattice(octave, x1, y1) * fx;
        return top * (1 - fy) + bottom * fy;
    }

    /**
     * Samples the noise at a point expressed in tile units. The result repeats every 1 on
     * both axes.
     *
     * @param u - Horizontal coordinate (`0` = left edge of the tile, `1` = right edge).
     * @param v - Vertical coordinate (`0` = top edge of the tile, `1` = bottom edge).
     * @returns A value in `[0, 1)`.
     */
    sample(u: number, v: number): number {
        let sum = 0;
        for (let i = 0, a = 1; i < this.octaves; ++i, a *= this.persistence) {
            sum += this.octave(i, u, v) * a;
        }
        return sum / this.totalAmplitude;
    }

    /**
     * Renders one tile of noise as a grid of the given pixel size.
     *
     * @param width - Grid width, in pixels.
     * @param height - Grid height, in pixels.
     * @returns A grid of rows (`grid[y][x]`) with values in `[0, 1)`.
     */
    render(width: number, height: number): Float32Array[] {
        const grid: Float32Array[] = new Array(height);
        for (let y = 0; y < height; ++y) {
            const row = new Float32Array(width);
            for (let x = 0; x < width; ++x) {
                row[x] = this.sample(x / width, y / height);
            }
            grid[y] = row;
        }
        return grid;
    }
}

export default FractalNoise;
