# @ralphy/algorithm

A versioned home for reusable algorithms, usable from both TypeScript and JavaScript
(ES modules and CommonJS), with bundled type declarations.

## Installation

```bash
npm install @ralphy/algorithm
```

## Usage

```ts
// ES modules / TypeScript
import { Bresenham, Perlin } from '@ralphy/algorithm';
```

```js
// CommonJS
const { Bresenham, Perlin } = require('@ralphy/algorithm');
```

## Algorithms

### `Bresenham`

Enumerates the integer grid cells forming a straight line between two points.

#### `Bresenham.line(x0, y0, x1, y1, callback?): boolean`

Walks every cell from `(x0, y0)` to `(x1, y1)`, both ends included. Coordinates are
truncated to integers. `callback(x, y, n)` is called for every cell (`n` is the
zero-based cell index); returning `false` stops the walk. Returns `true` if the whole
line was walked, `false` if the callback stopped it.

```ts
// Collect the cells of a line
const cells: [number, number][] = [];
Bresenham.line(0, 0, 4, 2, (x, y) => {
    cells.push([x, y]);
});
// [[0,0],[1,0],[2,1],[3,1],[4,2]]

// Line of sight: stop at the first wall
const visible = Bresenham.line(px, py, tx, ty, (x, y) => !isWall(x, y));
```

### `Perlin`

Fractal ("Perlin-like") value noise on 2D grids. Grids are arrays of rows
(`grid[y][x]`) of `Float32Array`. Sampling wraps around the edges, so the output tiles
seamlessly.

| Method                                   | Description                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `generate(baseNoise, octaveCount)`       | Blends `octaveCount` octaves of smooth noise (persistence 0.5), normalized to the base range. |
| `generateSmoothNoise(baseNoise, octave)` | One octave: samples every `2^octave` cells, cosine-interpolating in between.                  |
| `computeOptimalOctaves(size)`            | Largest `i` (capped at 10) such that `2^i <= size`.                                           |
| `cosineInterpolate(a, b, mu)`            | Cosine interpolation between `a` and `b`, `mu` in `[0, 1]`.                                   |
| `colorize(noise, palette)`               | Maps each value `v` to `palette[floor(v * palette.length)]`; returns a flat row-major array.  |

```ts
const size = 64;
const base = Array.from({ length: size }, () =>
    Float32Array.from({ length: size }, () => Math.random()),
);
const noise = Perlin.generate(base, Perlin.computeOptimalOctaves(size));
const colors = Perlin.colorize(noise, ['#004', '#08f', '#fe8', '#4a4', '#fff']);
```

## Adding an algorithm

1. Create `src/<name>/index.ts` with a documented (TSDoc) default-exported class.
2. Re-export it from `src/index.ts`: `export { default as Name } from './<name>';`
3. Add tests in `tests/<name>.spec.ts`.
4. Bump the version (`npm version minor`) before publishing.

## Development

| Script               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `npm run build`      | Builds ESM + CJS bundles and `.d.ts` files into `dist/`. |
| `npm test`           | Runs the unit tests (Vitest).                            |
| `npm run test:watch` | Runs the tests in watch mode.                            |
| `npm run coverage`   | Runs the tests with a coverage report.                   |
| `npm run lint`       | Lints with ESLint (typescript-eslint).                   |
| `npm run typecheck`  | Type-checks sources and tests.                           |
| `npm run format`     | Formats with Prettier.                                   |

`npm publish` runs lint, type-check, tests and build first (`prepublishOnly`).

## License

MIT
