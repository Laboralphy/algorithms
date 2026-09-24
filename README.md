# @laboralphy/algorithms

A versioned home for reusable algorithms, usable from both TypeScript and JavaScript
(ES modules and CommonJS), with bundled type declarations.

## Installation

```bash
npm install @laboralphy/algorithms
```

## Usage

```ts
// ES modules / TypeScript
import { AStar, Bresenham, FractalNoise, OrthonormalGrid, Perlin } from '@laboralphy/algorithms';
```

```js
// CommonJS
const {
  AStar,
  Bresenham,
  FractalNoise,
  OrthonormalGrid,
  Perlin,
} = require('@laboralphy/algorithms');
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

### `FractalNoise`

Seeded, tileable fractal value noise that can be sampled at any point. Coordinates are in
**tile units**: the noise repeats every 1 on both axes, so the same noise can be rendered at
any pixel size (including non power-of-two sizes) and keeps its features, only larger or
smaller.

| Option        | Default | Description                                                                    |
| ------------- | ------- | ------------------------------------------------------------------------------ |
| `seed`        | `0`     | Same seed, same noise.                                                         |
| `period`      | `4`     | Lattice cells across one tile at the first octave (`n` or `[x, y]`, integers). |
| `octaves`     | `4`     | Number of octaves; each one doubles the frequency.                             |
| `persistence` | `0.5`   | Weight ratio between an octave and the previous one, in `(0, 1]`.              |

| Method                  | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `sample(u, v)`          | Noise value in `[0, 1)` at a point, in tile units.            |
| `render(width, height)` | One tile as a grid of rows (`grid[y][x]`), tiling seamlessly. |

```ts
const noise = new FractalNoise({ seed: 42, period: 4, octaves: 5, persistence: 0.6 });
const grid = noise.render(64, 64);
const same = noise.render(128, 128); // same features, twice as large
```

### `AStar`

Finds the cheapest path in any graph implementing `IGraph<T>`, where `T` is whatever identifies
a cell (coordinates, a name, ...). Links between cells are directed and have a status
(open or closed) and a cost (non-negative). A* only follows open links.

#### `AStar.findPath(graph, from, to): T[] | null`

Returns the refs of the cells along the cheapest path, start and goal included (`[from]` when
they are the same cell), or `null` when the goal can't be reached. Throws if the start or goal
cell doesn't exist.

The graph can provide `estimateCost(from, to)`, the heuristic that guides the search. It must
never exceed the real cost of the cheapest path, or A* may return a more expensive path. Graphs
without it are searched as with Dijkstra's algorithm: still the cheapest path, more cells
explored.

#### `OrthonormalGrid`

A `width × height` grid of cells identified by `{ x, y }`, linked to their 4 neighbors, or 8
with `diagonal` set. Links cost 1 across a side and √2 across a corner. `estimateCost` is the
Manhattan distance (4 neighbors) or the octile distance (8 neighbors), which is the exact cost
on a grid with no walls.

```ts
const grid = new OrthonormalGrid(10, 10, true);
grid.setCellSolid({ x: 5, y: 5 }); // closes every link leading into the cell
grid.closeLink({ x: 2, y: 0 }, { x: 1, y: 0 }, true); // one-way: (1,0) -> (2,0) only
grid.getCell({ x: 3, y: 3 }).setLinkCost(grid.getCell({ x: 4, y: 3 }), 5); // costly step

const path = AStar.findPath(grid, { x: 0, y: 0 }, { x: 9, y: 9 });
```

If you lower a link cost below the distance between its two cells (1, or √2 diagonally),
`estimateCost` can overestimate and paths may no longer be the cheapest.

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
| `npm run check`      | Runs all of the above at once: the release gate.         |

`npm run check` is what CI runs on every push and pull request, and what `npm publish` runs
first through `prepublishOnly`.

## Releasing

Publishing is automated: pushing a GitHub release runs
[`.github/workflows/publish.yml`](.github/workflows/publish.yml), which builds the package and
stages it on npm.

1. **Bump the version** and push it, tag included:

   ```bash
   npm version patch   # or minor / major
   git push --follow-tags
   ```

2. **Create the GitHub release** on that tag (`gh release create v1.2.3 --generate-notes`, or
   the website). The workflow checks that the tag matches the version in `package.json` and
   fails if they differ, then runs `npm run check` and `npm stage publish`.

3. **Approve the staged version**, which is what actually puts it on npm:

   ```bash
   npm stage list @laboralphy/algorithms   # shows the pending version and its stage id
   npm stage approve <stage-id>            # or npm stage reject <stage-id>
   ```

   You can also approve it from the package page on npmjs.com, and inspect the tarball first
   with `npm stage download <stage-id>`.

Staging is what lets CI publish without a long-lived npm token: the workflow authenticates
through OIDC (npm trusted publishing), and the 2FA confirmation happens at approval time.
It needs npm 12, which the workflow installs, since Node 24 still ships npm 11.

## License

MIT
