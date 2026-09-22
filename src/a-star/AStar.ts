import { IGraph, IGraphCell } from './IGraph';
import { PriorityQueue } from './PriorityQueue';

type OpenEntry<T> = {
    cell: IGraphCell<T>;
    /** Cost of the cheapest known path from the start to `cell`. */
    g: number;
    /** `g` plus the estimated cost from `cell` to the goal. */
    f: number;
};

/**
 * A* path finding on any {@link IGraph}.
 *
 * Only open links are followed, and the path returned is the one with the lowest total
 * link cost, as long as the graph's {@link IGraph.estimateCost} never overestimates.
 *
 * @example
 * ```ts
 * const grid = new OrthonormalGrid(10, 10, true);
 * grid.setCellSolid({ x: 5, y: 5 });
 * const path = AStar.findPath(grid, { x: 0, y: 0 }, { x: 9, y: 9 });
 * // path: [{ x: 0, y: 0 }, { x: 1, y: 1 }, ..., { x: 9, y: 9 }], or null if unreachable
 * ```
 */
export class AStar {
    /**
     * Finds the cheapest path between two cells.
     *
     * @param graph - Graph to search.
     * @param refFrom - Start cell.
     * @param refTo - Goal cell.
     * @returns The refs of the cells along the path, start and goal included
     * (`[refFrom]` when both are the same cell), or `null` if the goal can't be reached.
     * @throws Whatever `graph.getCell` throws when the start or goal cell doesn't exist.
     */
    static findPath<T>(graph: IGraph<T>, refFrom: T, refTo: T): T[] | null {
        const start = graph.getCell(refFrom);
        const goal = graph.getCell(refTo);
        const estimate = (cell: IGraphCell<T>): number =>
            graph.estimateCost ? graph.estimateCost(cell.ref, goal.ref) : 0;

        const bestCosts = new Map<IGraphCell<T>, number>([[start, 0]]);
        const parents = new Map<IGraphCell<T>, IGraphCell<T>>();
        // Lowest f first; on equal f, highest g first: those cells are closer to the goal.
        const open = new PriorityQueue<OpenEntry<T>>((a, b) => a.f - b.f || b.g - a.g);
        open.push({ cell: start, g: 0, f: estimate(start) });

        for (let entry = open.pop(); entry; entry = open.pop()) {
            const { cell, g } = entry;
            // A cheaper path to this cell was found after this entry was queued.
            if (g > (bestCosts.get(cell) ?? Infinity)) {
                continue;
            }
            // The goal is only final when it leaves the queue, not when it is first reached.
            if (cell === goal) {
                return AStar.buildPath(parents, goal);
            }
            for (const link of cell.getLinks()) {
                if (!link.status) {
                    continue;
                }
                const gNext = g + link.cost;
                if (gNext < (bestCosts.get(link.cell) ?? Infinity)) {
                    bestCosts.set(link.cell, gNext);
                    parents.set(link.cell, cell);
                    open.push({ cell: link.cell, g: gNext, f: gNext + estimate(link.cell) });
                }
            }
        }
        return null;
    }

    private static buildPath<T>(
        parents: Map<IGraphCell<T>, IGraphCell<T>>,
        goal: IGraphCell<T>,
    ): T[] {
        const path: T[] = [];
        for (let cell: IGraphCell<T> | undefined = goal; cell; cell = parents.get(cell)) {
            path.push(cell.ref);
        }
        return path.reverse();
    }
}
