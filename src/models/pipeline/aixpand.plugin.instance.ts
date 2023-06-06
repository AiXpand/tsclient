import { REST_CUSTOM_EXEC_SIGNATURE } from '../../abstract.rest.custom.exec.plugin';
import { CallbackFunction } from '../callback.function.type';

export type PluginInstanceTimers = {
    init?: Date | null;
    exec?: Date | null;
    config?: Date | null;
    error?: {
        first?: Date | null;
        last?: Date | null;
    };
};

export class AiXpandPluginInstance<T> {
    public readonly id: string;
    public readonly signature: string;
    private streamId: string = null;
    public config: T;
    public timers: PluginInstanceTimers = null;
    public outsideWorkingHours = false;
    public frequency: number | null = null;
    private readonly tags: Map<string, string>;
    private callback: CallbackFunction = null;

    constructor(id: string, config: T, callback: CallbackFunction = null) {
        if (!config) {
            return;
        } // TODO: should throw

        this.id = id;
        this.signature = REST_CUSTOM_EXEC_SIGNATURE;
        if (!Reflect.hasMetadata('is-rest-custom-exec', config.constructor)) {
            this.signature = Reflect.getMetadata('signature', config.constructor);
        }

        this.config = config;
        this.tags = new Map<string, string>();
        this.callback = callback;
    }

    removeTag(key): AiXpandPluginInstance<T> {
        this.tags.delete(key);

        return this;
    }

    addTag(key, value): AiXpandPluginInstance<T> {
        this.tags.set(key, value);

        return this;
    }

    getTags(): Map<string, string> {
        return this.tags;
    }

    getConfig(): T {
        return this.config;
    }

    updateConfig(config: T) {
        this.config = config;

        return this;
    }

    updateMetadata(frequency: number = null, outsideWorkingHours = false, timers: PluginInstanceTimers = null) {
        this.frequency = frequency;
        this.timers = timers;
        this.outsideWorkingHours = outsideWorkingHours;

        return this;
    }

    setStreamId(streamId: string) {
        this.streamId = streamId;

        return this;
    }

    getStreamId() {
        return this.streamId;
    }

    hasCallback(): boolean {
        return !!this.callback;
    }

    setCallback(fn: CallbackFunction) {
        this.callback = fn;

        return this;
    }

    getCallback(): CallbackFunction {
        return this.callback;
    }

    clearCallback() {
        this.callback = null;

        return this;
    }
}
