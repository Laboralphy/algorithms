import { IGraph, IGraphCell } from './IGraph';

export type XYCoords = { x: number; y: number };

export class OrthonormalGridCell implements IGraphCell<XYCoords> {
    private readonly _ref: Readonly<XYCoords>;
    private readonly _links = new Map<IGraphCell<XYCoords>, { cost: number; status: boolean }>();

    constructor(ref: XYCoords) {
        // Copied and frozen: the coordinates identify the cell inside its grid and must not change.
        this._ref = Object.freeze({ x: ref.x, y: ref.y });
    }

    private static checkCost(cost: number) {
        if (!(cost >= 0)) {
            throw new RangeError(`Link cost must be a non-negative number (got ${cost})`);
        }
    }

    createLink(cell: IGraphCell<XYCoords>, cost: number) {
        OrthonormalGridCell.checkCost(cost);
        this._links.set(cell, { cost, status: true });
    }

    destroyLink(cell: IGraphCell<XYCoords>) {
        this._links.delete(cell);
    }

    getLinks(): { cell: IGraphCell<XYCoords>; status: boolean; cost: number }[] {
        return Array.from(this._links.entries()).map(([cell, { cost, status }]) => ({
            cell,
            status,
            cost,
        }));
    }

    private _getLink(cell: IGraphCell<XYCoords>): { status: boolean; cost: number } {
        const link = this._links.get(cell);
        if (link) {
            return link;
        } else {
            throw new ReferenceError(
                `This cell (${this.ref.x}:${this.ref.y}) is not linked to (${cell.ref.x}:${cell.ref.y})`,
            );
        }
    }

    setLinkStatus(cell: IGraphCell<XYCoords>, status: boolean) {
        this._getLink(cell).status = status;
    }

    getLinkStatus(cell: IGraphCell<XYCoords>): boolean {
        return this._getLink(cell).status;
    }

    setLinkCost(cell: IGraphCell<XYCoords>, cost: number) {
        OrthonormalGridCell.checkCost(cost);
        this._getLink(cell).cost = cost;
    }

    getLinkCost(cell: IGraphCell<XYCoords>): number {
        return this._getLink(cell).cost;
    }

    get ref(): XYCoords {
        return this._ref;
    }
}

export class OrthonormalGrid implements IGraph<XYCoords> {
    private readonly _cells = new Map<string, IGraphCell<XYCoords>>();

    private static key(ref: XYCoords): string {
        return `${ref.x}:${ref.y}`;
    }

    constructor(
        width: number,
        height: number,
        public readonly diagonal: boolean = false,
    ) {
        const DIAG_COST = Math.sqrt(2);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.createCell({ x, y });
            }
        }
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = this.getCell({ x, y });
                this.getNeighborCells({ x, y }).forEach((ocell) => {
                    const cost = x === ocell.ref.x || y === ocell.ref.y ? 1 : DIAG_COST;
                    cell.createLink(ocell, cost);
                });
            }
        }
    }

    openLink(ref1: XYCoords, ref2: XYCoords, oneWay: boolean = false) {
        if (!this.existCell(ref1) || !this.existCell(ref2)) {
            return;
        }
        const c1 = this.getCell(ref1);
        const c2 = this.getCell(ref2);
        c1.setLinkStatus(c2, true);
        if (oneWay) {
            return;
        }
        c2.setLinkStatus(c1, true);
    }

    closeLink(ref1: XYCoords, ref2: XYCoords, oneWay: boolean = false) {
        if (!this.existCell(ref1) || !this.existCell(ref2)) {
            return;
        }
        const c1 = this.getCell(ref1);
        const c2 = this.getCell(ref2);
        c1.setLinkStatus(c2, false);
        if (oneWay) {
            return;
        }
        c2.setLinkStatus(c1, false);
    }

    getNeighborCells(ref1: XYCoords) {
        const aCells: IGraphCell<XYCoords>[] = [];
        for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                if (!this.diagonal && dx !== 0 && dy !== 0) {
                    continue;
                }
                const coords = { x: ref1.x + dx, y: ref1.y + dy };
                if (this.existCell(coords)) {
                    aCells.push(this.getCell(coords));
                }
            }
        }
        return aCells;
    }

    /**
     * Mark a cell as a solid block: the links leading into it from its neighbors are closed,
     * so it can no longer be entered. Its outgoing links are left untouched; they don't
     * matter since the cell can't be reached, and closing them would make a later
     * {@link setCellWalkable} on a neighbor reopen this cell.
     * @param ref
     */
    setCellSolid(ref: XYCoords) {
        this.getNeighborCells(ref).forEach((cell: IGraphCell<XYCoords>) => {
            this.closeLink(cell.ref, ref, true);
        });
    }

    /**
     * Mark a cell as walkable: the links leading into it from its neighbors are opened.
     * @param ref
     */
    setCellWalkable(ref: XYCoords) {
        this.getNeighborCells(ref).forEach((cell: IGraphCell<XYCoords>) => {
            this.openLink(cell.ref, ref, true);
        });
    }

    getCell(ref: XYCoords): IGraphCell<XYCoords> {
        const cell = this._cells.get(OrthonormalGrid.key(ref));
        if (!cell) {
            throw new Error(`Unable to get cell ${ref.x}:${ref.y}`);
        }
        return cell;
    }
    createCell(ref: XYCoords): IGraphCell<XYCoords> {
        const cell = new OrthonormalGridCell(ref);
        this._cells.set(OrthonormalGrid.key(ref), cell);
        return cell;
    }
    destroyCell(ref: XYCoords): void {
        this._cells.delete(OrthonormalGrid.key(ref));
    }
    existCell(ref: XYCoords): boolean {
        return this._cells.has(OrthonormalGrid.key(ref));
    }
    getDistance(refFrom: XYCoords, refTo: XYCoords): number {
        return Math.hypot(refTo.x - refFrom.x, refTo.y - refFrom.y);
    }
}
