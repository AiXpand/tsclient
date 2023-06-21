import { AiXpandCommandAction } from './aixpand.command';
import { AiXpandPluginInstance } from './aixpand.plugin.instance';
import { AiXpandDataCaptureThread } from '../dct';
import { serialize } from '../../utils';
import { Pipeline } from '../../decorators';

@Pipeline()
export class AiXpandPipeline {
    private instances: AiXpandPluginInstance<any>[] = [];

    private readonly dct: AiXpandDataCaptureThread<any>;

    private readonly node: string;

    constructor(dct: AiXpandDataCaptureThread<any> = null, node: string) {
        this.node = node;
        this.dct = dct;
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

    attachPluginInstance(plugin: AiXpandPluginInstance<any>) {
        const instance = this.getPluginInstance(plugin.id);

        if (!instance) {
            plugin.setStreamId(this.dct.id);

            this.instances.push(plugin);
        } else {
            instance
                .updateConfig(plugin.config)
                .updateMetadata(plugin.frequency, plugin.outsideWorkingHours, plugin.timers);
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

    compile(session: string | null = null) {
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
            const alerter = serialize(plugin.getAlerter());
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

    updateInstance(instance: AiXpandPluginInstance<any>) {
        const instanceConfig = serialize(instance.getConfig(), null, null, null, instance.getConfig().getChangeset());

        return {
            PAYLOAD: {
                NAME: instance.getStreamId(),
                INSTANCE_ID: instance.id,
                SIGNATURE: instance.signature,
                INSTANCE_CONFIG: instanceConfig,
            },
            ACTION: AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE,
        };
    }

    deploy(session: string | null = null) {
        return {
            PAYLOAD: this.compile(session),
            ACTION: AiXpandCommandAction.UPDATE_CONFIG,
        };
    }

    close() {
        return {
            PAYLOAD: this.getDataCaptureThread().id,
            ACTION: AiXpandCommandAction.ARCHIVE_CONFIG,
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
