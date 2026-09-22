/**
 * Fractal ("Perlin-like") value noise generator working on 2D grids.
 *
 * Grids are arrays of rows: `grid[y][x]`. A typical workflow is:
 *  1. build a base grid filled with random values in `[0, 1)`;
 *  2. call {@link Perlin.generate} to smooth it over several octaves;
 *  3. optionally map the result onto a palette with {@link Perlin.colorize}.
 *
 * @example
 * ```ts
 * const size = 64;
 * const base = Array.from({ length: size }, () =>
 *     Float32Array.from({ length: size }, () => Math.random()),
 * );
 * const noise = Perlin.generate(base, Perlin.computeOptimalOctaves(size));
 * const colors = Perlin.colorize(noise, ['#004', '#08f', '#fe8', '#4a4', '#fff']);
 * ```
 */
class Perlin {
    /**
     * Computes the greatest octave count usable for a grid of the given size,
     * i.e. the largest `i` (capped at 10) such that `2^i <= n`.
     *
     * @param n - Grid size (width or height, usually the smallest of the two).
     * @returns Octave count, between 0 and 10.
     */
    static computeOptimalOctaves(n: number): number {
        let i = 10;
        while (i > 0) {
            const i2 = 1 << i;
            if (i2 <= n) {
                break;
            }
            --i;
        }
        return i;
    }

    /**
     * Cosine interpolation between two values.
     *
     * @param x0 - Value returned when `mu` is 0.
     * @param x1 - Value returned when `mu` is 1.
     * @param mu - Interpolation factor in `[0, 1]`.
     * @returns The interpolated value.
     */
    static cosineInterpolate(x0: number, x1: number, mu: number): number {
        const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
        return x0 * (1 - mu2) + x1 * mu2;
    }

    /**
     * Generates one octave of smooth noise: the base grid is sampled every
     * `2^nOctave` cells, and the values in between are cosine-interpolated.
     * Sampling wraps around the edges, so the result tiles seamlessly.
     *
     * @param aBaseNoise - Base noise grid (`grid[y][x]`).
     * @param nOctave - Octave index; the sampling period is `2^nOctave`.
     * @returns A new grid of the same dimensions.
     */
    static generateSmoothNoise(aBaseNoise: Float32Array[], nOctave: number): Float32Array[] {
        const h = aBaseNoise.length;
        const w = aBaseNoise[0].length;
        const aSmoothNoise: Float32Array[] = new Array(h);
        const nSamplePeriod = 1 << nOctave;
        const fSampleFreq = 1 / nSamplePeriod;
        const interpolate = Perlin.cosineInterpolate;
        for (let y = 0; y < h; ++y) {
            const ys0 = y - (y % nSamplePeriod);
            const ys1 = (ys0 + nSamplePeriod) % h;
            const hBlend = (y - ys0) * fSampleFreq;
            const r = new Float32Array(w);
            const bny0 = aBaseNoise[ys0];
            const bny1 = aBaseNoise[ys1];
            for (let x = 0; x < w; ++x) {
                const xs0 = x - (x % nSamplePeriod);
                const xs1 = (xs0 + nSamplePeriod) % w;
                const vBlend = (x - xs0) * fSampleFreq;
                const fTop = interpolate(bny0[xs0], bny1[xs0], hBlend);
                const fBottom = interpolate(bny0[xs1], bny1[xs1], hBlend);
                r[x] = interpolate(fTop, fBottom, vBlend);
            }
            aSmoothNoise[y] = r;
        }
        return aSmoothNoise;
    }

    /**
     * Generates fractal noise by blending `nOctaveCount` octaves of smooth noise.
     * Each lower octave (finer detail) gets half the weight of the one above it
     * (persistence 0.5). The result is normalized, so values stay in the same
     * range as the base noise.
     *
     * @param aBaseNoise - Base noise grid (`grid[y][x]`), usually random values in `[0, 1)`.
     * @param nOctaveCount - Number of octaves to blend (see {@link Perlin.computeOptimalOctaves}).
     * @returns A new grid of the same dimensions.
     */
    static generate(aBaseNoise: Float32Array[], nOctaveCount: number): Float32Array[] {
        const h = aBaseNoise.length;
        const w = aBaseNoise[0].length;
        const aSmoothNoise: Float32Array[][] = new Array(nOctaveCount);
        const fPersist = 0.5;

        for (let i = 0; i < nOctaveCount; ++i) {
            aSmoothNoise[i] = Perlin.generateSmoothNoise(aBaseNoise, i);
        }

        const aPerlinNoise: Float32Array[] = new Array(h);
        let fAmplitude = 1;
        let fTotalAmp = 0;

        for (let y = 0; y < h; ++y) {
            aPerlinNoise[y] = new Float32Array(w);
        }

        for (let iOctave = nOctaveCount - 1; iOctave >= 0; --iOctave) {
            fAmplitude *= fPersist;
            fTotalAmp += fAmplitude;
            const sno = aSmoothNoise[iOctave];
            for (let y = 0; y < h; ++y) {
                const snoy = sno[y];
                const pny = aPerlinNoise[y];
                for (let x = 0; x < w; ++x) {
                    pny[x] += snoy[x] * fAmplitude;
                }
            }
        }
        for (let y = 0; y < h; ++y) {
            const pny = aPerlinNoise[y];
            for (let x = 0; x < w; ++x) {
                pny[x] /= fTotalAmp;
            }
        }
        return aPerlinNoise;
    }

    /**
     * Maps a noise grid onto a palette. A value `v` in `[0, 1)` picks the entry
     * `palette[floor(v * palette.length)]`; values of 1 or more pick the last entry.
     *
     * @param aNoise - Noise grid (`grid[y][x]`) with values in `[0, 1]`.
     * @param aPalette - Colors (or any strings) ordered from lowest to highest value.
     * @returns A flat, row-major array of `width * height` palette entries.
     */
    static colorize(aNoise: Float32Array[], aPalette: string[]): string[] {
        const pl = aPalette.length;
        const data: string[] = [];
        aNoise.forEach((r) =>
            r.forEach((x: number) => {
                const nColor = Math.min(pl - 1, (x * pl) | 0);
                data.push(aPalette[nColor]);
            }),
        );
        return data;
    }
}

export default Perlin;
