/**
 * Class for generating 2D Halton sequences.
 * From https://observablehq.com/@jrus/halton
 */
export declare class Halton2DSequence {
    private _curIndex;
    private _sequence;
    private _numSamples;
    private _width;
    private _height;
    private _baseX;
    private _baseY;
    /**
     * The x coordinate of the current sample.
     */
    readonly x = 0;
    /**
     * The y coordinate of the current sample.
     */
    readonly y = 0;
    /**
     * Creates a new Halton2DSequence.
     * @param numSamples Number of samples in the sequence.
     * @param baseX The base for the x coordinate (default: 2).
     * @param baseY The base for the y coordinate (default: 3).
     * @param width Factor to scale the x coordinate by (default: 1). The scaling factor is 1/width.
     * @param height Factor to scale the y coordinate by (default: 1). The scaling factor is 1/height.
     */
    constructor(numSamples: number, baseX?: number, baseY?: number, width?: number, height?: number);
    /**
     * Regenerates the sequence with a new number of samples.
     * @param numSamples Number of samples in the sequence.
     */
    regenerate(numSamples: number): void;
    /**
     * Sets the dimensions of the sequence.
     * @param width Factor to scale the x coordinate by. The scaling factor is 1/width.
     * @param height Factor to scale the y coordinate by. The scaling factor is 1/height.
     */
    setDimensions(width: number, height: number): void;
    /**
     * Advances to the next sample in the sequence.
     */
    next(): void;
    private _generateSequence;
    private _halton;
}
