/**
 * AiXpand Data Capture Thread information rate metrics.
 */
export type AiXpandDCTRate = {
    /**
     * The actual readings per second.
     */
    actual: number;

    /**
     * The originally configured readings per second.
     */
    configured: number;

    /**
     * The target readings per second.
     */
    target: number;
};
