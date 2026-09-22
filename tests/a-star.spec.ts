import { describe, expect, it } from 'vitest';
import { AStar, IGraph, IGraphCell, OrthonormalGrid, XYCoords } from '../src';

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Checks that every step follows an open link and returns the total cost of the path. */
function pathCost<T>(graph: IGraph<T>, path: T[]): number {
    let cost = 0;
    for (let i = 1; i < path.length; ++i) {
        const from = graph.getCell(path[i - 1]);
        const to = graph.getCell(path[i]);
        expect(from.getLinkStatus(to)).toBe(true);
        cost += from.getLinkCost(to);
    }
    return cost;
}

/** Plain Dijkstra over every cell of a grid: the reference for the cheapest cost. */
function referenceCost(
    grid: OrthonormalGrid,
    width: number,
    height: number,
    from: XYCoords,
    to: XYCoords,
): number {
    const costs = new Map<IGraphCell<XYCoords>, number>();
    const unvisited = new Set<IGraphCell<XYCoords>>();
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const cell = grid.getCell({ x, y });
            costs.set(cell, Infinity);
            unvisited.add(cell);
        }
    }
    costs.set(grid.getCell(from), 0);
    while (unvisited.size > 0) {
        let current: IGraphCell<XYCoords> | undefined;
        for (const cell of unvisited) {
            if (!current || costs.get(cell)! < costs.get(current)!) {
                current = cell;
            }
        }
        if (!current || costs.get(current) === Infinity) {
            break;
        }
        unvisited.delete(current);
        for (const link of current.getLinks()) {
            if (link.status) {
                const cost = costs.get(current)! + link.cost;
                if (cost < costs.get(link.cell)!) {
                    costs.set(link.cell, cost);
                }
            }
        }
    }
    return costs.get(grid.getCell(to))!;
}

/** Minimal graph identified by names, with no heuristic. */
class NamedCell implements IGraphCell<string> {
    private readonly _links = new Map<IGraphCell<string>, { status: boolean; cost: number }>();
    constructor(public readonly ref: string) {}
    createLink(cell: IGraphCell<string>, cost: number) {
        this._links.set(cell, { status: true, cost });
    }
    destroyLink(cell: IGraphCell<string>) {
        this._links.delete(cell);
    }
    setLinkStatus(cell: IGraphCell<string>, status: boolean) {
        this._links.get(cell)!.status = status;
    }
    getLinkStatus(cell: IGraphCell<string>) {
        return this._links.get(cell)!.status;
    }
    setLinkCost(cell: IGraphCell<string>, cost: number) {
        this._links.get(cell)!.cost = cost;
    }
    getLinkCost(cell: IGraphCell<string>) {
        return this._links.get(cell)!.cost;
    }
    getLinks() {
        return [...this._links].map(([cell, { status, cost }]) => ({ cell, status, cost }));
    }
}

class NamedGraph implements IGraph<string> {
    private readonly _cells = new Map<string, NamedCell>();
    getCell(ref: string) {
        const cell = this._cells.get(ref);
        if (!cell) {
            throw new Error(`No cell ${ref}`);
        }
        return cell;
    }
    createCell(ref: string) {
        const cell = new NamedCell(ref);
        this._cells.set(ref, cell);
        return cell;
    }
    destroyCell(ref: string) {
        this._cells.delete(ref);
    }
    existCell(ref: string) {
        return this._cells.has(ref);
    }
    link(from: string, to: string, cost: number) {
        [from, to].filter((ref) => !this.existCell(ref)).forEach((ref) => this.createCell(ref));
        this.getCell(from).createLink(this.getCell(to), cost);
    }
}

describe('AStar.findPath', () => {
    describe('on an orthonormal grid', () => {
        it('returns the start alone when start and goal are the same cell', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(AStar.findPath(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
        });

        it('includes the start and the goal', () => {
            const grid = new OrthonormalGrid(5, 5);
            const path = AStar.findPath(grid, { x: 0, y: 0 }, { x: 4, y: 3 })!;
            expect(path[0]).toEqual({ x: 0, y: 0 });
            expect(path[path.length - 1]).toEqual({ x: 4, y: 3 });
        });

        it('finds a straight line', () => {
            const grid = new OrthonormalGrid(5, 1);
            expect(AStar.findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 3, y: 0 },
                { x: 4, y: 0 },
            ]);
        });

        it('costs the Manhattan distance without diagonals and without walls', () => {
            const grid = new OrthonormalGrid(10, 10);
            const path = AStar.findPath(grid, { x: 1, y: 2 }, { x: 8, y: 6 })!;
            expect(path).toHaveLength(12);
            expect(pathCost(grid, path)).toBe(11);
        });

        it('costs the octile distance with diagonals and without walls', () => {
            const grid = new OrthonormalGrid(10, 10, true);
            const path = AStar.findPath(grid, { x: 1, y: 2 }, { x: 8, y: 6 })!;
            expect(path).toHaveLength(8);
            expect(pathCost(grid, path)).toBeCloseTo(3 + 4 * Math.SQRT2);
        });

        it('goes around a wall', () => {
            // . . # . .
            // . . # . .
            // . . # . .
            // . . . . .
            const grid = new OrthonormalGrid(5, 4);
            [0, 1, 2].forEach((y) => grid.setCellSolid({ x: 2, y }));
            const path = AStar.findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 })!;
            expect(path).toContainEqual({ x: 2, y: 3 });
            expect(path).not.toContainEqual({ x: 2, y: 0 });
            expect(pathCost(grid, path)).toBe(10);
        });

        it('returns null when the goal is walled in', () => {
            const grid = new OrthonormalGrid(5, 5, true);
            grid.getNeighborCells({ x: 4, y: 4 }).forEach((cell) => grid.setCellSolid(cell.ref));
            expect(AStar.findPath(grid, { x: 0, y: 0 }, { x: 4, y: 4 })).toBeNull();
        });

        it('returns null when the goal is solid', () => {
            const grid = new OrthonormalGrid(5, 5);
            grid.setCellSolid({ x: 4, y: 4 });
            expect(AStar.findPath(grid, { x: 0, y: 0 }, { x: 4, y: 4 })).toBeNull();
        });

        it('can leave a solid start cell', () => {
            const grid = new OrthonormalGrid(3, 1);
            grid.setCellSolid({ x: 0, y: 0 });
            expect(AStar.findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(3);
        });

        it('follows one-way links in their direction only', () => {
            // A corridor with a one-way door from (1,0) to (2,0), and a longer detour below.
            const grid = new OrthonormalGrid(4, 3);
            [0, 1, 2, 3].forEach((x) => grid.setCellSolid({ x, y: 1 }));
            grid.setCellWalkable({ x: 0, y: 1 });
            grid.setCellWalkable({ x: 3, y: 1 });
            grid.closeLink({ x: 2, y: 0 }, { x: 1, y: 0 }, true);
            const forward = AStar.findPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 })!;
            const backward = AStar.findPath(grid, { x: 3, y: 0 }, { x: 0, y: 0 })!;
            expect(pathCost(grid, forward)).toBe(3);
            expect(pathCost(grid, backward)).toBe(7);
        });

        it('prefers a longer but cheaper path when links are weighted', () => {
            const grid = new OrthonormalGrid(3, 2);
            // Make the direct row expensive in both directions.
            [
                [0, 1],
                [1, 2],
            ].forEach(([a, b]) => {
                grid.getCell({ x: a, y: 0 }).setLinkCost(grid.getCell({ x: b, y: 0 }), 10);
            });
            const path = AStar.findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 })!;
            expect(path).toEqual([
                { x: 0, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 2, y: 0 },
            ]);
        });

        it('goes around a destroyed cell', () => {
            const grid = new OrthonormalGrid(3, 2);
            grid.destroyCell({ x: 1, y: 0 });
            expect(AStar.findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual([
                { x: 0, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 2, y: 0 },
            ]);
        });

        it('throws when the start or goal cell does not exist', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(() => AStar.findPath(grid, { x: -1, y: 0 }, { x: 2, y: 2 })).toThrow();
            expect(() => AStar.findPath(grid, { x: 0, y: 0 }, { x: 3, y: 3 })).toThrow();
        });

        it.each([
            ['4 neighbors', false, false],
            ['8 neighbors', true, false],
            ['4 neighbors, weighted links', false, true],
            ['8 neighbors, weighted links', true, true],
        ])('finds the cheapest path on random grids (%s)', (_label, diagonal, weighted) => {
            const random = rng(diagonal ? 11 : 22);
            const size = 12;
            for (let run = 0; run < 60; ++run) {
                const grid = new OrthonormalGrid(size, size, diagonal);
                for (let y = 0; y < size; ++y) {
                    for (let x = 0; x < size; ++x) {
                        const cell = grid.getCell({ x, y });
                        if (weighted) {
                            // Costs never below the distance, so the heuristic stays valid.
                            cell.getLinks().forEach((link) =>
                                cell.setLinkCost(link.cell, link.cost * (1 + random() * 3)),
                            );
                        }
                        if (random() < 0.3) {
                            grid.setCellSolid({ x, y });
                        }
                    }
                }
                const from = { x: (random() * size) | 0, y: (random() * size) | 0 };
                const to = { x: (random() * size) | 0, y: (random() * size) | 0 };
                const expected = referenceCost(grid, size, size, from, to);
                const path = AStar.findPath(grid, from, to);
                if (expected === Infinity) {
                    expect(path).toBeNull();
                } else {
                    expect(path).not.toBeNull();
                    expect(path![0]).toEqual(from);
                    expect(path![path!.length - 1]).toEqual(to);
                    expect(pathCost(grid, path!)).toBeCloseTo(expected, 9);
                }
            }
        });
    });

    describe('on a graph without heuristic', () => {
        it('does not fall for the cheapest first link', () => {
            // S -1-> A -10-> G  and  S -2-> B -2-> G
            const graph = new NamedGraph();
            graph.link('S', 'A', 1);
            graph.link('A', 'G', 10);
            graph.link('S', 'B', 2);
            graph.link('B', 'G', 2);
            expect(AStar.findPath(graph, 'S', 'G')).toEqual(['S', 'B', 'G']);
        });

        it('ignores closed links', () => {
            const graph = new NamedGraph();
            graph.link('S', 'A', 1);
            graph.link('A', 'G', 1);
            graph.link('S', 'B', 5);
            graph.link('B', 'G', 5);
            graph.getCell('A').setLinkStatus(graph.getCell('G'), false);
            expect(AStar.findPath(graph, 'S', 'G')).toEqual(['S', 'B', 'G']);
        });

        it('handles zero-cost links and cycles', () => {
            const graph = new NamedGraph();
            graph.link('S', 'A', 0);
            graph.link('A', 'S', 0);
            graph.link('A', 'B', 0);
            graph.link('B', 'A', 0);
            graph.link('B', 'G', 1);
            expect(AStar.findPath(graph, 'S', 'G')).toEqual(['S', 'A', 'B', 'G']);
        });

        it('returns null when the goal is not reachable', () => {
            const graph = new NamedGraph();
            graph.link('S', 'A', 1);
            graph.link('G', 'A', 1);
            expect(AStar.findPath(graph, 'S', 'G')).toBeNull();
        });
    });
});
