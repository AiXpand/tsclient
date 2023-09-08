import { plainToInstance } from 'class-transformer';
import {
    AiXpandDataCaptureThread,
    AiXpandDCTRate,
    AiXpandDCTStats,
    AiXpandPluginInstance,
    AiXPHeartbeatData,
    AiXPMessage,
    AiXPMessageIdentifiers,
    AiXPMessageType,
    AiXPNotificationData,
    AiXPPayloadData,
    Dictionary,
    PluginRegistration,
} from '../models';
import { deserialize } from './aixp.deserializer';
import { REST_CUSTOM_EXEC_SIGNATURE } from '../abstract.rest.custom.exec.plugin';
import { FORCE_PAUSE, ID_TAGS, WORKING_HOURS } from '../decorators';
import {
    AiXpandInternalHeartbeatData,
    AiXpandInternalMessage,
    AiXpandInternalNotificationData,
    AiXpandInternalPayloadData,
} from '../decoders/edge.node.message.parser';
import { ADMIN_PLUGIN_CLASSES, ADMIN_PLUGIN_SIGNATURES } from '../constants';

export const transformer = async (
    internalMessage: AiXpandInternalMessage,
    plugins: Dictionary<PluginRegistration>,
    registeredDCTs: Dictionary<any>,
): Promise<AiXPMessage<any>> => {
    let message = <AiXPMessage<any>>{
        id: internalMessage.id,
        host: internalMessage.host,
        type: internalMessage.type,
        path: internalMessage.path,
        time: internalMessage.time,
        metadata: internalMessage.metadata,
        data: {},
    };

    switch (internalMessage.type) {
        case AiXPMessageType.HEARTBEAT:
            message.data = <AiXPHeartbeatData>heartbeatTransformer(internalMessage, plugins, registeredDCTs);
            break;
        case AiXPMessageType.NOTIFICATION:
            message.data = <AiXPNotificationData>notificationTransformer(internalMessage);
            break;
        default:
            message = <AiXPMessage<AiXPPayloadData>>payloadTransformer(message, internalMessage);
    }

    return message;
};

const heartbeatTransformer = (
    rawMessage,
    plugins: Dictionary<PluginRegistration>,
    registeredDCTs: Dictionary<any>,
): AiXPHeartbeatData => {
    const heartbeatData = <AiXpandInternalHeartbeatData>rawMessage.data;

    const pipelinesConfig = heartbeatData.pipelinesConfig;
    delete heartbeatData.pipelinesConfig;

    const dctStats = heartbeatData.dctStats;
    delete heartbeatData.dctStats;

    const activePlugins = heartbeatData.activePlugins;
    delete heartbeatData.activePlugins;

    const commStats = {};
    heartbeatData.commStats.forEach((data, channel) => {
        commStats[channel] = heartbeatData.commStats.get(channel);
    });
    delete heartbeatData.commStats;

    const heartbeat = <AiXPHeartbeatData>{
        ...heartbeatData,
        commStats,
        dataCaptureThreads: {},
        activePlugins: [],
        links: {},
    };

    pipelinesConfig.forEach((pipelineDetails, pipelineName) => {
        const pipelineConfig = pipelineDetails.config;
        if (!registeredDCTs[`${pipelineConfig.TYPE}`]) {
            return;
        }

        heartbeat.dataCaptureThreads[pipelineName] = new AiXpandDataCaptureThread(
            pipelineName,
            deserialize(pipelineConfig, registeredDCTs[`${pipelineConfig.TYPE}`]),
            pipelineConfig['INITIATOR_ID'],
        );

        const pipelineStats = dctStats.has(pipelineName) ? dctStats.get(pipelineName) : null;
        if (pipelineStats) {
            heartbeat.dataCaptureThreads[pipelineName]
                .setTime(pipelineStats.now)
                .setDPS(<AiXpandDCTRate>{
                    actual: pipelineStats.DPS,
                    configured: pipelineStats.cfgDPS,
                    target: pipelineStats.tgtDPS,
                })
                .setStatus(<AiXpandDCTStats>{
                    flow: pipelineStats.flow,
                    collecting: pipelineStats.collecting,
                    idle: pipelineStats.idle,
                    idleAlert: pipelineStats.idleAlert,
                    fails: pipelineStats.fails,
                    log: pipelineStats.stats,
                });
        }

        if (pipelineDetails.plugins && pipelineDetails.plugins.length > 0) {
            pipelineDetails.plugins.forEach((pluginType) => {
                if (!plugins[pluginType.SIGNATURE] && !ADMIN_PLUGIN_SIGNATURES.includes(pluginType.SIGNATURE)) {
                    // unknown plugin type
                    return;
                }

                pluginType.INSTANCES.forEach((instance) => {
                    // skip untagged rest exec
                    if (
                        pluginType.SIGNATURE === REST_CUSTOM_EXEC_SIGNATURE &&
                        instance.ID_TAGS?.CUSTOM_SIGNATURE === undefined
                    ) {
                        return;
                    }

                    let instanceClass;
                    if (ADMIN_PLUGIN_SIGNATURES.includes(pluginType.SIGNATURE)) {
                        instanceClass = ADMIN_PLUGIN_CLASSES[pluginType.SIGNATURE];
                    } else if (instance.ID_TAGS?.CUSTOM_SIGNATURE) {
                        if (!plugins[instance.ID_TAGS.CUSTOM_SIGNATURE]?.instanceConfig) {
                            // unknown plugin type
                            return;
                        }

                        instanceClass = plugins[instance.ID_TAGS.CUSTOM_SIGNATURE]?.instanceConfig;
                    } else {
                        instanceClass = plugins[pluginType.SIGNATURE].instanceConfig;
                    }

                    const pluginInstance = new AiXpandPluginInstance(
                        instance.INSTANCE_ID,
                        deserialize(instance, instanceClass),
                        null,
                        null,
                    );

                    if (instance[ID_TAGS]) {
                        Object.keys(instance[ID_TAGS]).forEach((key) => {
                            pluginInstance.addTag(key, instance[ID_TAGS][key]);
                        });
                    }

                    if (instance[WORKING_HOURS]) {
                        pluginInstance.setSchedule(instance[WORKING_HOURS]);
                    }

                    if (instance[FORCE_PAUSE]) {
                        pluginInstance.forcePause();
                    }

                    const instanceStats = activePlugins
                        .filter((instanceStats) => instanceStats.instanceId === instance.INSTANCE_ID)
                        .pop();

                    if (instanceStats) {
                        pluginInstance
                            .updateMetadata(instanceStats.frequency, instanceStats.outsideWorkingHours, {
                                init: new Date(instanceStats.timers.init),
                                exec: new Date(instanceStats.timers.exec),
                                config: new Date(instanceStats.timers.config),
                                error: {
                                    first: instanceStats.timers.firstError,
                                    last: instanceStats.timers.lastError,
                                },
                            })
                            .setStreamId(instanceStats.pipelineId);
                    }

                    heartbeat.activePlugins.push(pluginInstance);

                    if (instance.LINKED_INSTANCES) {
                        heartbeat.links[pluginInstance.id] = {
                            ownPipeline: instanceStats.pipelineId,
                            instances: instance.LINKED_INSTANCES,
                        };
                    }
                });
                // end plugin instances foreach
            });
        }
    });

    return plainToInstance(AiXPHeartbeatData, heartbeat);
};

const notificationTransformer = (message: AiXpandInternalMessage): AiXPNotificationData => {
    const data = <AiXpandInternalNotificationData>message.data;

    return plainToInstance(AiXPNotificationData, {
        module: data.module,
        type: data.type,
        notification: data.message,
        context: {
            timestamp: data.timestamp ?? null,
            initiator: data.identifiers.initiator ?? null,
            session: data.identifiers.session ?? null,
            stream: data.identifiers.stream ?? null,
            signature: data.identifiers.signature ?? null,
            displayed: data.displayed ?? null,
        },
        trace: data.info ?? data.trace,
    });
};

const payloadTransformer = (
    result: AiXPMessage<AiXPPayloadData>,
    message: AiXpandInternalMessage,
): AiXPMessage<AiXPPayloadData> => {
    const data = <AiXpandInternalPayloadData>message.data;

    result.metadata.identifiers = plainToInstance(AiXPMessageIdentifiers, data.identifiers);
    result.metadata.time = message.time.date;

    result.data = <AiXPPayloadData>plainToInstance(AiXPPayloadData, {
        ...data.data,
    });

    return result;
};
