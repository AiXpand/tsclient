import { AiXpandCommandAction } from './aixpand.command';
import { AiXpandPluginInstance } from './aixpand.plugin.instance';
import { AiXpandDataCaptureThread } from '../dct';
import { serialize } from '../../utils';
import { Pipeline } from '../../decorators';

@Pipeline()
export class AiXpandPipeline {
    private instances: AiXpandPluginInstance<any>[] = [];

    private readonly dct: AiXpandDataCaptureThread<any>;

    private node: string;

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

    compile(session: string | null = null) {
        const instancesBySignature = this.instances.reduce((collection, plugin) => {
            if (!collection[plugin.signature]) {
                collection[plugin.signature] = [];
            }

            const config = serialize(plugin.config);
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
}
