import { AiXpandCommandAction } from './aixpand.command';
import { AiXpandPluginInstance } from './aixpand.plugin.instance';
import { AiXpandDataCaptureThread } from '../dct';
import { serialize } from '../../utils';
import { Pipeline } from '../../decorators';
import { AiXpandClient } from '../../aixpand.client';
import { AiXPMessage, AiXPNotificationData } from '../message';
import { Dictionary } from '../dictionary';

export enum NotificationMessagesParts {
    ARCHIVE_SUCCESS = 'Successfully archived pipeline',
    DELETE_SUCCESS = 'Successfully deleted pipeline',
}

@Pipeline()
export class AiXpandPipeline {
    /**
     * The list of instances associated with this pipeline.
     *
     * @private
     */
    private instances: AiXpandPluginInstance<any>[] = [];

    /**
     * The Data Capture Thread that feeds this pipeline with data.
     *
     * @private
     */
    private readonly dct: AiXpandDataCaptureThread<any>;

    /**
     * The node this specific pipeline belongs to.
     *
     * @private
     */
    private readonly node: string;

    /**
     * Back-reference to the AiXpand Client, for allowing the publishing of instance commands.
     *
     * @private
     */
    readonly client: AiXpandClient;

    /**
     * Watches to be added when deploying the pipeline.
     */
    private watches: Dictionary<string[]> = {};

    constructor(dct: AiXpandDataCaptureThread<any> = null, node: string, client: AiXpandClient) {
        this.node = node;
        this.dct = dct;
        this.client = client;
    }

    getInitiator() {
        return this.dct.initiator;
    }

    getNode() {
        return this.node;
    }

    getDataCaptureThread(): AiXpandDataCaptureThread<any> {
        return this.dct;
    }

    getPluginInstances() {
        return this.instances;
    }

    getPluginInstance(instanceId: string): AiXpandPluginInstance<any> | null {
        return this.instances.filter((instance) => instance.id === instanceId).pop() ?? null;
    }

    addInstanceWatch(path: string[]) {
        console.log('adding watch:', path);

        this.watches[path.join(':')] = path;

        return this;
    }

    getInstanceWatches() {
        return Object.keys(this.watches).map((watchKey) => this.watches[watchKey]);
    }

    removeInstanceWatch(path: string[]) {
        console.log('removing watch:', path);


        if (this.watches[path.join(':')]) {
            delete this.watches[path.join(':')];
        }

        return this;
    }

    removeAllInstanceWatches() {
        console.log('clearing watches!!!!!');

        this.watches = {};

        return this;
    }

    attachPluginInstance(candidate: AiXpandPluginInstance<any>, nowatch = false) {
        const existingInstance = this.getPluginInstance(candidate.id);

        if (!existingInstance) {
            candidate.setStreamId(this.dct.id).setPipeline(this);

            if (!nowatch) {
                this.addInstanceWatch([this.node, this.dct.id, candidate.signature, candidate.id]);
            }

            this.instances.push(candidate);
        } else {
            // this is the internal route, instances added when parsing the heartbeat
            existingInstance
                .setConfig(candidate.getConfig(false))
                .resetTags()
                .bulkSetTags(candidate.getTags())
                .updateMetadata(candidate.frequency, candidate.outsideWorkingHours, candidate.timers);
        }

        return this;
    }

    removePluginInstance(instance: AiXpandPluginInstance<any>): string[] {
        const affectedPipelines: string[] = [this.dct.id];
        if (instance.isLinked()) {
            const mainInstance = instance.getCollectorInstance();
            if (!mainInstance) {
                // removing main instance; recalculate linking map
                const linkedInstances = instance.getLinkedInstances();
                linkedInstances[0].setCollectorInstance(null);
                affectedPipelines.push(linkedInstances[0].getStreamId());

                for (let i = 1; i < linkedInstances.length; i++) {
                    linkedInstances[0].link(linkedInstances[i]);
                    affectedPipelines.push(linkedInstances[i].getStreamId());
                }
            } else {
                // removing linked instance
                mainInstance.unlink(instance);
                affectedPipelines.push(mainInstance.getStreamId());
            }
        }

        this.removeFromInstanceArray(instance);
        this.removeInstanceWatch([this.node, this.dct.id, instance.signature, instance.id]);

        instance = null;

        return affectedPipelines;
    }

    sendCommand(command: any) {
        return this.client.publish(this.node, this.getRawPipelineCommandPayload(this.dct.id, command));
    }

    sendInstanceCommand(message: any) {
        return this.client.publish(this.node, message);
    }

    makeUpdateInstancePayload(instance: AiXpandPluginInstance<any>) {
        const instanceConfig = serialize(
            instance.getConfig(false),
            null,
            instance.getTags(),
            null,
            instance.getSchedule(),
            instance.isForcePaused(),
            instance.getChangeSet(),
        );

        return {
            NAME: instance.getStreamId(),
            INSTANCE_ID: instance.id,
            SIGNATURE: instance.signature,
            INSTANCE_CONFIG: instanceConfig,
        };
    }

    updateInstance(instance: AiXpandPluginInstance<any>) {
        const message = {
            PAYLOAD: this.makeUpdateInstancePayload(instance),
            ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE,
        };

        return this.client.publish(this.node, message).then(
            (responses) => {
                instance.clearChangeset();

                return responses;
            },
            (errs) => {
                return errs;
            },
        );
    }

    deploy(session: string | null = null) {
        const message = {
            PAYLOAD: this.compile(session),
            ACTION: AiXpandCommandAction.UPDATE_CONFIG,
        };

        console.log(`DEPLOYING, existing instance watches: ${JSON.stringify(this.getInstanceWatches())}`);

        const response = this.client.publish(this.node, message, this.getInstanceWatches());
        this.removeAllInstanceWatches();

        return response;
    }

    close(): Promise<AiXPMessage<AiXPNotificationData>[]> {
        const pipelineName = this.getDataCaptureThread().id;
        const message = {
            PAYLOAD: pipelineName,
            ACTION: AiXpandCommandAction.ARCHIVE_CONFIG,
        };

        return this.client.publish(this.node, message).then(
            (notifs) => {
                this.client.removePipeline(this);

                return notifs;
            },
            (err) => {
                return err;
            },
        );
    }

    private compile(session: string | null = null) {
        const instancesBySignature = this.instances.reduce((collection, plugin) => {
            if (!collection[plugin.signature]) {
                collection[plugin.signature] = [];
            }

            let linkInfo = null;
            if (plugin.getDecoratorMetadata().options.linkable) {
                linkInfo = {
                    links: {
                        instances: plugin.getLinkedInstances(),
                        collector: plugin.getCollectorInstance(),
                    },
                };
            }

            const config = serialize(
                plugin.config,
                null,
                plugin.getTags(),
                linkInfo,
                plugin.getSchedule(),
                plugin.isForcePaused(),
            );
            collection[plugin.signature].push({
                ...config,
                INSTANCE_ID: plugin.id,
            });

            return collection;
        }, {});

        return {
            ...this.dct.compile(session),
            PLUGINS: Object.keys(instancesBySignature).map((signature) => ({
                INSTANCES: instancesBySignature[signature],
                SIGNATURE: signature,
            })),
        };
    }

    private removeFromInstanceArray(toRemove: AiXpandPluginInstance<any>) {
        for (let i = 0; i < this.instances.length; i++) {
            const instance = this.instances[i];
            if (instance.id === toRemove.id) {
                this.instances.splice(i, 1);
                break;
            }
        }
    }

    private getRawPipelineCommandPayload(pipelineName: string, command: any) {
        return {
            PAYLOAD: {
                NAME: pipelineName,
                PIPELINE_COMMAND : command,
            },
            ACTION: AiXpandCommandAction.PIPELINE_COMMAND,
        };
    }
}
