import { describe, expect, it } from 'vitest';
import { IGraphCell } from '../src/a-star/IGraph';
import { OrthonormalGrid, OrthonormalGridCell, XYCoords } from '../src/a-star/OrthonormalGrid';

/** Coordinates of the cells linked to `cell` (optionally only open or closed ones), sorted. */
function linkedCoords(cell: IGraphCell<XYCoords>, status?: boolean): string[] {
    return cell
        .getLinks()
        .filter((link) => status === undefined || link.status === status)
        .map(({ cell }) => `${cell.ref.x}:${cell.ref.y}`)
        .sort();
}

describe('OrthonormalGridCell', () => {
    it('exposes its coordinates', () => {
        expect(new OrthonormalGridCell({ x: 2, y: 5 }).ref).toEqual({ x: 2, y: 5 });
    });

    it('keeps its own copy of the coordinates', () => {
        const coords = { x: 2, y: 5 };
        const cell = new OrthonormalGridCell(coords);
        coords.x = 9;
        expect(cell.ref).toEqual({ x: 2, y: 5 });
    });

    it('has read-only coordinates', () => {
        const cell = new OrthonormalGridCell({ x: 2, y: 5 });
        expect(() => {
            (cell.ref as { x: number }).x = 9;
        }).toThrow(TypeError);
        expect(cell.ref).toEqual({ x: 2, y: 5 });
    });

    it('rejects negative or invalid costs', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        expect(() => a.createLink(b, -1)).toThrow(RangeError);
        expect(() => a.createLink(b, NaN)).toThrow(RangeError);
        expect(a.getLinks()).toEqual([]);
        a.createLink(b, 0);
        expect(() => a.setLinkCost(b, -0.5)).toThrow(RangeError);
        expect(a.getLinkCost(b)).toBe(0);
    });

    it('has no links when created', () => {
        expect(new OrthonormalGridCell({ x: 0, y: 0 }).getLinks()).toEqual([]);
    });

    it('creates open links', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        a.createLink(b, 1);
        expect(a.getLinkStatus(b)).toBe(true);
        expect(a.getLinks()).toEqual([{ cell: b, status: true, cost: 1 }]);
    });

    it('creates one-way links', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        a.createLink(b, 1);
        expect(b.getLinks()).toEqual([]);
    });

    it('changes the status of a link', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        a.createLink(b, 1);
        a.setLinkStatus(b, false);
        expect(a.getLinkStatus(b)).toBe(false);
        a.setLinkStatus(b, true);
        expect(a.getLinkStatus(b)).toBe(true);
    });

    it('destroys links', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        const c = new OrthonormalGridCell({ x: 0, y: 1 });
        a.createLink(b, 1);
        a.createLink(c, 1);
        a.destroyLink(b);
        expect(a.getLinks()).toEqual([{ cell: c, status: true, cost: 1 }]);
    });

    it('throws a ReferenceError when asking the status of a missing link', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        expect(() => a.getLinkStatus(b)).toThrow(ReferenceError);
        a.createLink(b, 1);
        a.destroyLink(b);
        expect(() => a.getLinkStatus(b)).toThrow(ReferenceError);
    });
    it('stores the cost of a link', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 1 });
        a.createLink(b, 2.5);
        expect(a.getLinkCost(b)).toBe(2.5);
        expect(a.getLinks()).toEqual([{ cell: b, status: true, cost: 2.5 }]);
    });

    it('changes the cost of a link without changing its status', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        a.createLink(b, 1);
        a.setLinkStatus(b, false);
        a.setLinkCost(b, 4);
        expect(a.getLinkCost(b)).toBe(4);
        expect(a.getLinkStatus(b)).toBe(false);
    });

    it('resets status and cost when a link is created again', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        a.createLink(b, 1);
        a.setLinkStatus(b, false);
        a.createLink(b, 3);
        expect(a.getLinks()).toEqual([{ cell: b, status: true, cost: 3 }]);
    });

    it('throws a ReferenceError when changing a missing link', () => {
        const a = new OrthonormalGridCell({ x: 0, y: 0 });
        const b = new OrthonormalGridCell({ x: 1, y: 0 });
        expect(() => a.setLinkStatus(b, true)).toThrow(ReferenceError);
        expect(() => a.setLinkCost(b, 1)).toThrow(ReferenceError);
        expect(() => a.getLinkCost(b)).toThrow(ReferenceError);
        expect(a.getLinks()).toEqual([]);
    });
});

describe('OrthonormalGrid', () => {
    describe('cells', () => {
        it('creates width * height cells', () => {
            const grid = new OrthonormalGrid(4, 3);
            for (let y = 0; y < 3; ++y) {
                for (let x = 0; x < 4; ++x) {
                    expect(grid.existCell({ x, y })).toBe(true);
                    expect(grid.getCell({ x, y }).ref).toEqual({ x, y });
                }
            }
        });

        it('has no cells outside its bounds', () => {
            const grid = new OrthonormalGrid(4, 3);
            expect(grid.existCell({ x: -1, y: 0 })).toBe(false);
            expect(grid.existCell({ x: 0, y: -1 })).toBe(false);
            expect(grid.existCell({ x: 4, y: 0 })).toBe(false);
            expect(grid.existCell({ x: 0, y: 3 })).toBe(false);
        });

        it('finds cells by value, not by object identity', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(grid.getCell({ x: 1, y: 2 })).toBe(grid.getCell({ x: 1, y: 2 }));
        });

        it('throws when getting a missing cell', () => {
            expect(() => new OrthonormalGrid(3, 3).getCell({ x: 5, y: 5 })).toThrow();
        });

        it('creates and destroys cells', () => {
            const grid = new OrthonormalGrid(2, 2);
            const cell = grid.createCell({ x: 10, y: 10 });
            expect(grid.existCell({ x: 10, y: 10 })).toBe(true);
            expect(grid.getCell({ x: 10, y: 10 })).toBe(cell);
            grid.destroyCell({ x: 10, y: 10 });
            expect(grid.existCell({ x: 10, y: 10 })).toBe(false);
        });
    });

    describe('destroyCell', () => {
        it('removes every link leading into the destroyed cell', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            const neighbors = grid.getNeighborCells(center.ref);
            grid.destroyCell(center.ref);
            neighbors.forEach((cell) => {
                expect(() => cell.getLinkStatus(center)).toThrow(ReferenceError);
                expect(cell.getLinks().map((link) => link.cell)).not.toContain(center);
            });
        });

        it('removes links from cells that are not neighbors', () => {
            const grid = new OrthonormalGrid(5, 5);
            const far = grid.getCell({ x: 0, y: 0 });
            const target = grid.getCell({ x: 4, y: 4 });
            far.createLink(target, 1);
            grid.destroyCell(target.ref);
            expect(() => far.getLinkStatus(target)).toThrow(ReferenceError);
        });

        it('removes the links leaving the destroyed cell', () => {
            const grid = new OrthonormalGrid(3, 3);
            const center = grid.getCell({ x: 1, y: 1 });
            grid.destroyCell(center.ref);
            expect(center.getLinks()).toEqual([]);
        });

        it('leaves the other links untouched', () => {
            const grid = new OrthonormalGrid(3, 3);
            grid.destroyCell({ x: 1, y: 1 });
            expect(linkedCoords(grid.getCell({ x: 0, y: 0 }), true)).toEqual(['0:1', '1:0']);
            expect(linkedCoords(grid.getCell({ x: 1, y: 0 }), true)).toEqual(['0:0', '2:0']);
        });

        it('does nothing when the cell does not exist', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(() => grid.destroyCell({ x: 7, y: 7 })).not.toThrow();
            expect(linkedCoords(grid.getCell({ x: 1, y: 1 }))).toHaveLength(4);
        });
    });

    describe('without diagonals', () => {
        const grid = new OrthonormalGrid(3, 3);

        it('links an inner cell to its 4 orthogonal neighbors', () => {
            expect(linkedCoords(grid.getCell({ x: 1, y: 1 }))).toEqual([
                '0:1',
                '1:0',
                '1:2',
                '2:1',
            ]);
        });

        it('links border and corner cells to their existing neighbors only', () => {
            expect(linkedCoords(grid.getCell({ x: 1, y: 0 }))).toEqual(['0:0', '1:1', '2:0']);
            expect(linkedCoords(grid.getCell({ x: 0, y: 0 }))).toEqual(['0:1', '1:0']);
        });

        it('returns orthogonal neighbors', () => {
            const refs = grid.getNeighborCells({ x: 0, y: 0 }).map((cell) => cell.ref);
            expect(refs).toHaveLength(2);
            expect(refs).toContainEqual({ x: 1, y: 0 });
            expect(refs).toContainEqual({ x: 0, y: 1 });
        });
    });

    describe('with diagonals', () => {
        const grid = new OrthonormalGrid(3, 3, true);

        it('links an inner cell to its 8 neighbors', () => {
            expect(linkedCoords(grid.getCell({ x: 1, y: 1 }))).toEqual([
                '0:0',
                '0:1',
                '0:2',
                '1:0',
                '1:2',
                '2:0',
                '2:1',
                '2:2',
            ]);
        });

        it('links border and corner cells to their existing neighbors only', () => {
            expect(linkedCoords(grid.getCell({ x: 1, y: 0 }))).toHaveLength(5);
            expect(linkedCoords(grid.getCell({ x: 0, y: 0 }))).toEqual(['0:1', '1:0', '1:1']);
        });

        it('never links a cell to itself', () => {
            expect(linkedCoords(grid.getCell({ x: 1, y: 1 }))).not.toContain('1:1');
            expect(grid.getNeighborCells({ x: 1, y: 1 })).not.toContain(
                grid.getCell({ x: 1, y: 1 }),
            );
        });
    });

    it('creates open links in both directions', () => {
        const grid = new OrthonormalGrid(4, 4, true);
        for (let y = 0; y < 4; ++y) {
            for (let x = 0; x < 4; ++x) {
                const cell = grid.getCell({ x, y });
                cell.getLinks().forEach((link) => {
                    expect(link.status).toBe(true);
                    expect(link.cell.getLinkStatus(cell)).toBe(true);
                });
            }
        }
    });

    describe('getDistance', () => {
        const grid = new OrthonormalGrid(10, 10);

        it('returns the euclidean distance', () => {
            expect(grid.getDistance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
            expect(grid.getDistance({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe(3);
            expect(grid.getDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(Math.SQRT2);
        });

        it('is symmetric and zero between a cell and itself', () => {
            expect(grid.getDistance({ x: 4, y: 5 }, { x: 1, y: 1 })).toBe(5);
            expect(grid.getDistance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
        });
    });

    describe('link costs', () => {
        it('costs 1 between cells sharing a side', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            for (const ref of [
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: 2, y: 1 },
                { x: 1, y: 2 },
            ]) {
                expect(center.getLinkCost(grid.getCell(ref))).toBe(1);
                expect(grid.getCell(ref).getLinkCost(center)).toBe(1);
            }
        });

        it('costs √2 between cells sharing a corner', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            for (const ref of [
                { x: 0, y: 0 },
                { x: 2, y: 0 },
                { x: 0, y: 2 },
                { x: 2, y: 2 },
            ]) {
                expect(center.getLinkCost(grid.getCell(ref))).toBeCloseTo(Math.SQRT2);
                expect(grid.getCell(ref).getLinkCost(center)).toBeCloseTo(Math.SQRT2);
            }
        });

        it('costs the distance between the two linked cells', () => {
            const grid = new OrthonormalGrid(4, 4, true);
            for (let y = 0; y < 4; ++y) {
                for (let x = 0; x < 4; ++x) {
                    const cell = grid.getCell({ x, y });
                    cell.getLinks().forEach((link) => {
                        expect(cell.getLinkCost(link.cell)).toBeCloseTo(
                            grid.getDistance(cell.ref, link.cell.ref),
                        );
                    });
                }
            }
        });

        it('keeps costs when links are closed and reopened', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const a = grid.getCell({ x: 0, y: 0 });
            const b = grid.getCell({ x: 1, y: 1 });
            grid.closeLink(a.ref, b.ref);
            grid.openLink(a.ref, b.ref);
            expect(a.getLinkCost(b)).toBeCloseTo(Math.SQRT2);
            expect(b.getLinkCost(a)).toBeCloseTo(Math.SQRT2);
        });
    });

    describe('opening and closing links', () => {
        it('closes and reopens a link in both directions', () => {
            const grid = new OrthonormalGrid(3, 3);
            const a = grid.getCell({ x: 0, y: 0 });
            const b = grid.getCell({ x: 1, y: 0 });
            grid.closeLink(a.ref, b.ref);
            expect(a.getLinkStatus(b)).toBe(false);
            expect(b.getLinkStatus(a)).toBe(false);
            grid.openLink(a.ref, b.ref);
            expect(a.getLinkStatus(b)).toBe(true);
            expect(b.getLinkStatus(a)).toBe(true);
        });

        it('closes and reopens a link in one direction only', () => {
            const grid = new OrthonormalGrid(3, 3);
            const a = grid.getCell({ x: 0, y: 0 });
            const b = grid.getCell({ x: 1, y: 0 });
            grid.closeLink(a.ref, b.ref, true);
            expect(a.getLinkStatus(b)).toBe(false);
            expect(b.getLinkStatus(a)).toBe(true);
            grid.closeLink(b.ref, a.ref);
            grid.openLink(a.ref, b.ref, true);
            expect(a.getLinkStatus(b)).toBe(true);
            expect(b.getLinkStatus(a)).toBe(false);
        });

        it('throws a ReferenceError between existing cells that are not adjacent', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(() => grid.openLink({ x: 0, y: 0 }, { x: 2, y: 2 })).toThrow(ReferenceError);
            expect(() => grid.closeLink({ x: 0, y: 0 }, { x: 2, y: 2 })).toThrow(ReferenceError);
        });

        it('ignores missing cells', () => {
            const grid = new OrthonormalGrid(3, 3);
            expect(() => grid.closeLink({ x: 0, y: 0 }, { x: -1, y: 0 })).not.toThrow();
            expect(() => grid.openLink({ x: 9, y: 9 }, { x: 0, y: 0 })).not.toThrow();
            expect(linkedCoords(grid.getCell({ x: 0, y: 0 }), true)).toEqual(['0:1', '1:0']);
        });
    });

    describe('solid and walkable cells', () => {
        it('closes every link leading into a solid cell', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            grid.setCellSolid(center.ref);
            grid.getNeighborCells(center.ref).forEach((cell) => {
                expect(cell.getLinkStatus(center)).toBe(false);
            });
        });

        it('leaves the links leaving a solid cell open', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            grid.setCellSolid(center.ref);
            expect(linkedCoords(center, false)).toEqual([]);
        });

        it('leaves the other links untouched', () => {
            const grid = new OrthonormalGrid(3, 3);
            grid.setCellSolid({ x: 1, y: 1 });
            expect(linkedCoords(grid.getCell({ x: 0, y: 0 }), true)).toEqual(['0:1', '1:0']);
        });

        it('reopens every link leading into a cell made walkable again', () => {
            const grid = new OrthonormalGrid(3, 3, true);
            const center = grid.getCell({ x: 1, y: 1 });
            grid.setCellSolid(center.ref);
            grid.setCellWalkable(center.ref);
            grid.getNeighborCells(center.ref).forEach((cell) => {
                expect(cell.getLinkStatus(center)).toBe(true);
            });
        });

        it('does not reopen a solid cell when a neighbor is made walkable', () => {
            const grid = new OrthonormalGrid(3, 1);
            const solid = grid.getCell({ x: 1, y: 0 });
            grid.setCellSolid(solid.ref);
            grid.setCellWalkable({ x: 0, y: 0 });
            grid.setCellWalkable({ x: 2, y: 0 });
            expect(grid.getCell({ x: 0, y: 0 }).getLinkStatus(solid)).toBe(false);
            expect(grid.getCell({ x: 2, y: 0 }).getLinkStatus(solid)).toBe(false);
        });
    });
});
