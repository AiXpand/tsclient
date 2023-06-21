import { AiXpandDCTRate, AiXpandDCTStats } from '../pipeline';
import { AiXpandException } from '../../aixpand.exception';
import { serialize } from '../../utils';
import { DataCaptureThread } from '../../decorators';

/**
 * The definition of AiXpand network's Execution Engine Data Capture Threads (DCTs). A DCT is a thread responsible for
 * the acquisition of data inside an AI pipeline.
 */
@DataCaptureThread()
export class AiXpandDataCaptureThread<T extends object> {
    /**
     * The DCT id
     */
    id: string;

    /**
     * The DCT config object.
     */
    config: T;

    /**
     * The time of the last update. Relevant for the DPS and Stats readings.
     */
    time: Date = null;

    /**
     * The Data Capture Thread's information rate.
     */
    dps: AiXpandDCTRate = null;

    /**
     * The DCT's statistics, type, fails, etc.
     */
    status: AiXpandDCTStats = null;

    initiator: string;

    constructor(id: string, config: T, initiator: string) {
        this.id = id;
        this.config = config;
        this.initiator = initiator;
    }

    getInitiator() {
        return this.initiator;
    }

    /**
     * Method for updating the values in the context of a DCT without replacing the original object.
     *
     * @param data AiXpandDataCaptureThread, the current reading for this DCT.
     */
    update(data: AiXpandDataCaptureThread<T>) {
        if (data.id !== this.id) {
            throw new AiXpandException(`Attempted to update DCT #${this.id} with data from #${data.id}.`);
        }

        this.config = data.config;
        this.time = data.time;
        this.dps = data.dps;
        this.status = data.status;

        return this;
    }

    setStatus(status: AiXpandDCTStats = null) {
        this.status = status;

        return this;
    }

    setDPS(dps: AiXpandDCTRate = null) {
        this.dps = dps;

        return this;
    }

    setTime(time: string = null) {
        this.time = new Date(time);

        return this;
    }

    /**
     * Method for serializing this object into AiXpand network DCT configuration format.
     *
     * @param session
     */
    compile(session: string | null = null) {
        const config = serialize(this.config);
        config['NAME'] = this.id;

        if (session) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            config['SESSION_ID'] = session;
        }

        return config;
    }
}
