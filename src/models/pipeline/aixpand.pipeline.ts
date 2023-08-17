import { AiXpandCommandAction } from './aixpand.command';
import { AiXpandPluginInstance } from './aixpand.plugin.instance';
import { AiXpandDataCaptureThread } from '../dct';
import { serialize } from '../../utils';
import { Pipeline } from '../../decorators';
import { AiXpandClient } from '../../aixpand.client';
import { AiXPMessage, AiXPNotificationData } from '../message';

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
    private readonly client: AiXpandClient;

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

    attachPluginInstance(candidate: AiXpandPluginInstance<any>) {
        const existingInstance = this.getPluginInstance(candidate.id);

        if (!existingInstance) {
            candidate.setStreamId(this.dct.id).setPipeline(this);

            this.instances.push(candidate);
        } else {
            existingInstance
                .updateConfig(candidate.getConfig())
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

        instance = null;

        return affectedPipelines;
    }

    sendInstanceCommand(message: any) {
        return this.client.publish(this.node, message);
    }

    updateInstance(instance: AiXpandPluginInstance<any>) {
        const instanceConfig = serialize(instance.getConfig(), null, instance.getTags(), null, instance.getConfig().getChangeset());
        const message = {
            PAYLOAD: {
                NAME: instance.getStreamId(),
                INSTANCE_ID: instance.id,
                SIGNATURE: instance.signature,
                INSTANCE_CONFIG: instanceConfig,
            },
            ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE,
        };

        return this.client.publish(this.node, message);
    }

    deploy(session: string | null = null) {
        const message = {
            PAYLOAD: this.compile(session),
            ACTION: AiXpandCommandAction.UPDATE_CONFIG,
        };

        return this.client.publish(this.node, message);
    }

    close() {
        const pipelineName = this.getDataCaptureThread().id;
        const message = {
            PAYLOAD: pipelineName,
            ACTION: AiXpandCommandAction.ARCHIVE_CONFIG,
        };

        return this.client.publish(this.node, message).then(
            (notif: AiXPMessage<AiXPNotificationData>) => {
                const messageText = notif.data.notification;

                if (
                    (!!messageText.match(NotificationMessagesParts.ARCHIVE_SUCCESS) ||
                        !!messageText.match(NotificationMessagesParts.DELETE_SUCCESS)) &&
                    !!messageText.match(pipelineName)
                ) {
                    this.client.removePipeline(this);

                    return {
                        message: messageText,
                        pipeline: pipelineName,
                    };
                }

                return notif;
            },
            (err: AiXPMessage<AiXPNotificationData>) => {
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

            const config = serialize(plugin.config, null, plugin.getTags(), linkInfo);
            const alerter = plugin.getAlerter() ? serialize(plugin.getAlerter()) : {};
            collection[plugin.signature].push({
                ...config,
                ...alerter,
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
}
