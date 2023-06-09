import { REST_CUSTOM_EXEC_SIGNATURE } from '../../abstract.rest.custom.exec.plugin';
import { CallbackFunction } from '../callback.function.type';
import { PluginInstanceOptions } from '../../decorators';
import { AiXpandCommandAction } from './aixpand.command';
import { createChangeTrackingProxy } from '../../utils/aixp.track.changes.proxies';
import { AiXpandAlerter } from '../aixpand.alerter';
import { AiXpandPipeline } from './aixpand.pipeline';

export type PluginInstanceTimers = {
    init?: Date | null;
    exec?: Date | null;
    config?: Date | null;
    error?: {
        first?: Date | null;
        last?: Date | null;
    };
};

export class AiXpandPluginInstance<T extends object> {
    /**
     * The instance id.
     *
     * @public string id
     */
    public readonly id: string;

    /**
     * The instance signature.
     *
     * @public string signature
     */
    public readonly signature: string;

    /**
     * The ID of the pipeline (DCT that feeds the pipeline).
     *
     * @private
     */
    private streamId: string = null;

    /**
     * The instance config.
     */
    public config: T;

    /**
     * The alerter parameters.
     */
    public alerter: AiXpandAlerter;

    /**
     * Plugin timers that measure different aspects of this specific instance.
     */
    public timers: PluginInstanceTimers = null;

    /**
     * Flag signaling whether this specific plugin instance is outside working hours.
     */
    public outsideWorkingHours = false;

    /**
     * The frequency with which this instance receives information.
     */
    public frequency: number | null = null;

    /**
     * Instance Tags.
     *
     * @private
     */
    private readonly tags: Map<string, string>;

    /**
     * Instance callback. Whenever a specific callback is set for an instance, the pipeline response
     * will be directed to that callback instead of being bubbled as a client event.
     *
     * @private
     */
    private callback: CallbackFunction = null;

    /**
     * Linked instances. When an instance is part of a group of instances, the linking information
     * is stored in this property.
     *
     * @private
     */
    private linkedInstances: AiXpandPluginInstance<T>[] = [];

    /**
     * The instance that collects this instance's payloads whenever this instance belongs to a group.
     *
     * @private
     */
    private collectorInstance: AiXpandPluginInstance<T> = null;

    /**
     * Back-reference to the AiXpand Pipeline, for allowing the publishing of instance commands.
     *
     * @private
     */
    private pipeline: AiXpandPipeline;

    constructor(id: string, config: T, callback: CallbackFunction = null, alerter?: AiXpandAlerter) {
        if (!config) {
            return;
        } // TODO: should throw

        this.id = id;
        this.signature = REST_CUSTOM_EXEC_SIGNATURE;
        if (!Reflect.hasMetadata('is-rest-custom-exec', config.constructor)) {
            this.signature = Reflect.getMetadata('signature', config.constructor);
        }

        // if (Reflect.hasMetadata('plugin-instance-alertable', config.constructor) && !alerter) {
        //     throw new Error(`Alertable plugin instance ${id} does not have an alerter attached.`);
        // }

        this.updateConfig(config);
        this.alerter = alerter;
        this.tags = new Map<string, string>();
        this.callback = callback;
    }

    sendCommand(command: any) {
        const message = {
            PAYLOAD: {
                NAME: this.streamId,
                INSTANCE_ID: this.id,
                SIGNATURE: this.signature,
                INSTANCE_CONFIG: {
                    INSTANCE_COMMAND: command,
                },
            },
            ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE,
        };

        return this.pipeline.sendInstanceCommand(message);
    }

    getDecoratorMetadata() {
        return {
            options: <PluginInstanceOptions>Reflect.getMetadata('plugin-instance-options', this.config.constructor),
            signature: this.signature,
        };
    }

    getCollectorInstance() {
        return this.collectorInstance;
    }

    setCollectorInstance(instance: AiXpandPluginInstance<T> | null) {
        this.collectorInstance = instance;

        return this;
    }

    isLinked() {
        return (
            this.getDecoratorMetadata().options.linkable &&
            (this.linkedInstances.length > 0 || this.collectorInstance !== null)
        );
    }

    unlink(linkedInstance: AiXpandPluginInstance<T>) {
        linkedInstance.setCollectorInstance(null);

        for (let i = 0; i < this.linkedInstances.length; i++) {
            if (
                this.linkedInstances[i].getStreamId() === linkedInstance.getStreamId() &&
                this.linkedInstances[i].id === linkedInstance.id
            ) {
                this.linkedInstances.splice(i, 1);
                break;
            }
        }

        return this;
    }

    link(linkedInstance: AiXpandPluginInstance<T>) {
        const targetMetadata = linkedInstance.getDecoratorMetadata();
        const thisMetadata = this.getDecoratorMetadata();

        if (
            targetMetadata.signature === thisMetadata.signature &&
            targetMetadata.options.linkable &&
            thisMetadata.options.linkable
        ) {
            this.linkedInstances.push(linkedInstance);
            linkedInstance.setCollectorInstance(this);
        }

        return this;
    }

    getLinkedInstances(): AiXpandPluginInstance<T>[] {
        return this.linkedInstances;
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

    getConfig() {
        return this.config;
    }

    updateConfig(config: T) {
        this.config = createChangeTrackingProxy(config);

        return this;
    }

    getAlerter(): AiXpandAlerter {
        return this.alerter;
    }

    updateAlerter(alerter: AiXpandAlerter) {
        this.alerter = alerter;

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

    setPipeline(pipeline: AiXpandPipeline) {
        this.pipeline = pipeline;

        return this;
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
