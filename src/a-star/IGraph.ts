export interface IGraphCell<T> {
    readonly ref: T;
    /**
     * Creates an open link towards `cell`, replacing any existing one.
     * @throws RangeError if `cost` is negative or not a number.
     */
    createLink(cell: IGraphCell<T>, cost: number): void;
    destroyLink(cell: IGraphCell<T>): void;
    setLinkStatus(cell: IGraphCell<T>, status: boolean): void;
    getLinkStatus(cell: IGraphCell<T>): boolean;
    /**
     * @throws RangeError if `cost` is negative or not a number.
     * @throws ReferenceError if this cell is not linked to `cell`.
     */
    setLinkCost(cell: IGraphCell<T>, cost: number): void;
    getLinkCost(cell: IGraphCell<T>): number;
    getLinks(): { cell: IGraphCell<T>; status: boolean; cost: number }[];
}

export interface IGraph<T> {
    getCell(ref: T): IGraphCell<T>;
    createCell(ref: T): IGraphCell<T>;
    destroyCell(ref: T): void;
    existCell(ref: T): boolean;
    /**
     * Estimates the cost of the cheapest path between two cells: the heuristic used by A*.
     *
     * The estimate must never exceed the real cost of the cheapest path, otherwise A* may
     * return a path that is not the cheapest. The closer it is to the real cost, the fewer
     * cells A* explores. Graphs without a notion of distance can leave this method out:
     * A* then uses 0, which is always valid but explores more cells.
     */
    estimateCost?(refFrom: T, refTo: T): number;
}
