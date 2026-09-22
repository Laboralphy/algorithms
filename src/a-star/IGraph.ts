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
    getDistance(refFrom: T, refTo: T): number;
}
