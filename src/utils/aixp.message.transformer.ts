import { plainToInstance } from 'class-transformer';
import {
    AiXpandDataCaptureThread,
    AiXpandDCTRate,
    AiXpandDCTStats,
    AiXpandPluginInstance,
    AiXPEEStats,
    AiXPHeartbeatData,
    AiXPMessage,
    AiXPMessageIdentifiers,
    AiXPMessageMetadata,
    AiXPMessageType,
    AiXPNotificationData,
    AiXPPayloadData,
    Dictionary,
    PluginRegistration,
} from '../models';
import { deserialize } from './aixp.deserializer';
import { REST_CUSTOM_EXEC_SIGNATURE } from '../abstract.rest.custom.exec.plugin';
import { decode } from './aixp.pseudopy.helpers';
import { FORCE_PAUSE, ID_TAGS, WORKING_HOURS } from '../decorators';

export const transformer = async (
    rawMessage,
    plugins: Dictionary<PluginRegistration>,
    registeredDCTs: Dictionary<any>,
): Promise<AiXPMessage<any>> => {
    if (rawMessage.type == AiXPMessageType.HEARTBEAT && rawMessage.metadata.encoded_data !== undefined) {
        const decoded = JSON.parse(await decode(rawMessage.metadata.encoded_data));
        Object.keys(decoded).forEach((key) => {
            rawMessage.metadata[key.toLowerCase()] = decoded[key];
        });
    }

    const message: AiXPMessage<any> = {
        path: rawMessage.EE_PAYLOAD_PATH,
        id: rawMessage.messageID,
        type: rawMessage.type,
        category: rawMessage.category,
        version: rawMessage.version ?? null,
        sender: {
            id: rawMessage.sender.id,
            instance: rawMessage.sender.instanceId,
            host: rawMessage.sender.hostId,
        },
        time: {},
        demoMode: rawMessage.demoMode,
        format: rawMessage.EE_FORMATTER,

        metadata: metadataTransformer(rawMessage),

        data: null,
    };

    switch (message.type) {
        case AiXPMessageType.HEARTBEAT:
            message.time = {
                device:
                    rawMessage.time.deviceTime !== ''
                        ? new Date(`${rawMessage.time.deviceTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                host:
                    rawMessage.time.hostTime !== ''
                        ? new Date(`${rawMessage.time.hostTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                internet:
                    rawMessage.time.internetTime !== ''
                        ? new Date(`${rawMessage.time.internetTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                timezone: {
                    utc: rawMessage.metadata.ee_timezone,
                    name: rawMessage.metadata.ee_tz,
                },
            };

            message.data = <AiXPHeartbeatData>heartbeatTransformer(rawMessage, plugins, registeredDCTs);
            break;
        case AiXPMessageType.NOTIFICATION:
            message.time = {
                device:
                    rawMessage.time.deviceTime !== ''
                        ? new Date(`${rawMessage.time.deviceTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                host:
                    rawMessage.time.hostTime !== ''
                        ? new Date(`${rawMessage.time.hostTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                internet:
                    rawMessage.time.internetTime !== ''
                        ? new Date(`${rawMessage.time.internetTime} ${rawMessage.metadata.ee_timezone}`)
                        : null,
                timezone: {
                    utc: rawMessage.metadata.ee_timezone,
                    name: rawMessage.metadata.ee_tz,
                },
            };

            message.data = <AiXPNotificationData>notificationTransformer(rawMessage);
            break;
        default:
            message.time = {
                device:
                    rawMessage.time.deviceTime !== ''
                        ? new Date(`${rawMessage.time.deviceTime} ${rawMessage.data.specificValue.ee_timezone}`)
                        : null,
                host:
                    rawMessage.time.hostTime !== ''
                        ? new Date(`${rawMessage.time.hostTime} ${rawMessage.data.specificValue.ee_timezone}`)
                        : null,
                internet:
                    rawMessage.time.internetTime !== ''
                        ? new Date(`${rawMessage.time.internetTime} ${rawMessage.data.specificValue.ee_timezone}`)
                        : null,
                timezone: {
                    utc: rawMessage.data.specificValue.ee_timezone,
                    name: rawMessage.data.specificValue.ee_tz,
                },
            };

            message.data = <AiXPPayloadData>payloadTransformer(rawMessage);
    }

    return message;
};

const heartbeatTransformer = (
    rawMessage,
    plugins: Dictionary<PluginRegistration>,
    registeredDCTs: Dictionary<any>,
): AiXPHeartbeatData => {
    const heartbeat = {
        status: rawMessage.metadata.device_status,
        ip: rawMessage.metadata.machine_ip,
        uptime: rawMessage.metadata.uptime,
        memory: {
            machine: rawMessage.metadata.machine_memory,
            available: rawMessage.metadata.available_memory,
            process: rawMessage.metadata.process_memory,
        },
        disk: {
            available: rawMessage.metadata.available_disk,
            total: rawMessage.metadata.total_disk,
        },
        cpu: {
            name: rawMessage.metadata.cpu,
            used: rawMessage.metadata.cpu_used,
        },
        gpus: {
            defaultCuda: rawMessage.metadata.default_cuda,
            info: rawMessage.metadata.gpu_info,
            list: Array.isArray(rawMessage.metadata.gpus)
                ? rawMessage.metadata.gpus.map((gpuDetails) => ({
                      name: gpuDetails.NAME,
                      usedByProcess: gpuDetails.USED_BY_PROCESS,
                      memory: {
                          total: gpuDetails.TOTAL_MEM,
                          allocated: gpuDetails.ALLOCATED_MEM,
                          free: gpuDetails.FREE_MEM,
                          unit: gpuDetails.MEM_UNIT,
                      },
                      stats: {
                          load: gpuDetails.GPU_USED,
                          temperature: gpuDetails.GPU_TEMP,
                          maxTemperature: gpuDetails.GPU_TEMP_MAX,
                      },
                      processes: Array.isArray(gpuDetails.PROCESSES)
                          ? gpuDetails.PROCESSES.map((proc) => ({
                                pid: proc.PID,
                                gpuInstance: proc.GPUINSTANCEID,
                                computeInstance: proc.COMPUTEINSTANCEID,
                                memory: proc.ALLOCATED_MEM,
                            }))
                          : [],
                  }))
                : [],
        },
        ee: <AiXPEEStats>{
            heartbeatInterval: rawMessage.metadata.ee_hb_time,
            version: {
                full: rawMessage.metadata.version,
                engine: rawMessage.version,
                logger: rawMessage.metadata.logger_version,
            },
            branch: rawMessage.metadata.git_branch,
            conda: rawMessage.metadata.conda_env,
            counters: {
                inferences: rawMessage.metadata.nr_inferences,
                payloads: rawMessage.metadata.nr_payloads,
                streams: rawMessage.metadata.nr_streams_data,
            },
            servingPids: rawMessage.metadata.serving_pids,
            dataCaptureThreads: <Dictionary<AiXpandDataCaptureThread<any>>>{},
            activePlugins: <AiXpandPluginInstance<any>[]>[],
            links: {},
        },
    };

    rawMessage.metadata.config_streams.forEach((pipelineInfo) => {
        if (!registeredDCTs[`${pipelineInfo.TYPE}`]) {
            console.log(`Found unknown DCT type: "${pipelineInfo.TYPE}"`);
            return;
        }

        const pipelineId = pipelineInfo['NAME'];
        const pipelineConfig = { ...pipelineInfo };
        delete pipelineConfig['PLUGINS'];
        const stats = rawMessage.metadata.dct_stats[pipelineId];

        heartbeat.ee.dataCaptureThreads[pipelineId] = new AiXpandDataCaptureThread(
            pipelineId,
            deserialize(pipelineConfig, registeredDCTs[`${pipelineInfo.TYPE}`]),
            pipelineConfig['INITIATOR_ID'],
        );

        if (stats) {
            heartbeat.ee.dataCaptureThreads[pipelineId]
                .setTime(stats.NOW)
                .setDPS(<AiXpandDCTRate>{
                    actual: stats.DPS,
                    configured: stats.CFG_DPS,
                    target: stats.TGT_DPS,
                })
                .setStatus(<AiXpandDCTStats>{
                    flow: stats.FLOW,
                    collecting: stats.COLLECTING,
                    idle: stats.IDLE,
                    fails: stats.FAILS,
                    log: stats.RUNSTATS,
                });
        }

        if (pipelineInfo['PLUGINS']) {
            pipelineInfo['PLUGINS'].forEach((pluginType) => {
                if (!plugins[pluginType.SIGNATURE]) {
                    // unknown plugin type
                    return;
                }

                pluginType['INSTANCES'].forEach((instance) => {
                    // skip untagged rest exec
                    if (
                        pluginType.SIGNATURE === REST_CUSTOM_EXEC_SIGNATURE &&
                        instance.ID_TAGS?.CUSTOM_SIGNATURE === undefined
                    ) {
                        return;
                    }

                    let instanceClass;
                    if (instance.ID_TAGS?.CUSTOM_SIGNATURE) {
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

                    const instanceStats = rawMessage.metadata.active_plugins
                        .filter((instanceStats) => instanceStats.INSTANCE_ID === instance.INSTANCE_ID)
                        .pop();

                    if (instanceStats) {
                        pluginInstance
                            .updateMetadata(instanceStats.FREQUENCY, instanceStats.OUTSIDE_WORKING_HOURS, {
                                init: new Date(instanceStats.INIT_TIMESTAMP),
                                exec: new Date(instanceStats.EXEC_TIMESTAMP),
                                config: new Date(instanceStats.LAST_CONFIG_TIMESTAMP),
                                error: {
                                    first: instanceStats.FIRST_ERROR_TIME
                                        ? new Date(instanceStats.FIRST_ERROR_TIME)
                                        : null,
                                    last: instanceStats.LAST_ERROR_TIME
                                        ? new Date(instanceStats.LAST_ERROR_TIME)
                                        : null,
                                },
                            })
                            .setStreamId(instanceStats.STREAM_ID);
                    }

                    heartbeat.ee.activePlugins.push(pluginInstance);

                    if (instance.LINKED_INSTANCES) {
                        heartbeat.ee.links[pluginInstance.id] = {
                            ownPipeline: instanceStats.STREAM_ID,
                            instances: instance.LINKED_INSTANCES,
                        };
                    }
                });
            });
        }
    });

    return plainToInstance(AiXPHeartbeatData, heartbeat);
};

const notificationTransformer = (rawMessage): AiXPNotificationData =>
    plainToInstance(AiXPNotificationData, {
        module: rawMessage.metadata.module,
        version: rawMessage.metadata.version,
        type: rawMessage.metadata.notification_type,
        notification: rawMessage.metadata.notification,
        context: {
            timestamp: rawMessage.metadata.timestamp ?? null,
            initiator: rawMessage.metadata.initiator_id ?? null,
            session: rawMessage.metadata.session_id ?? null,
            stream: rawMessage.metadata.stream_name ?? null,
            displayed: rawMessage.metadata.displayed ?? null,
        },
        plugin:
            rawMessage.metadata.signature !== undefined || rawMessage.metadata.instance_id !== undefined
                ? {
                      instance: rawMessage.metadata.instance_id,
                      signature: rawMessage.metadata.signature,
                  }
                : null,
        trace: rawMessage.metadata.info,
    });

const payloadTransformer = (rawMessage): AiXPPayloadData => {
    return <AiXPPayloadData>plainToInstance(AiXPPayloadData, {
        identifiers: plainToInstance(AiXPMessageIdentifiers, rawMessage.data.identifiers),
        ...rawMessage.data.value,
        ...rawMessage.data.specificValue,
        img: rawMessage.data.img,
        time: new Date(rawMessage.data.time),
    });
};

const metadataTransformer = (rawMessage): AiXPMessageMetadata => {
    const base = {
        event: rawMessage.metadata.sb_event_type ?? rawMessage.data.specificValue.sb_event_type,
        messages: {
            total: rawMessage.metadata.sbTotalMessages,
            current: rawMessage.metadata.sbCurrentMessage,
        },
        captureMetadata: null,
        pluginMetadata: null,
    };

    if (![AiXPMessageType.HEARTBEAT, AiXPMessageType.NOTIFICATION].includes(rawMessage.type)) {
        base.captureMetadata = keysToCamel(rawMessage.metadata.captureMetadata);
        base.pluginMetadata = keysToCamel(rawMessage.metadata.pluginMetadata);
    }

    return base;
};

const isArray = function (a) {
    return Array.isArray(a);
};

const isObject = function (o) {
    return o === Object(o) && !isArray(o) && typeof o !== 'function';
};

const toCamel = (s) => {
    return s.toLowerCase().replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
    });
};

const keysToCamel = function (o) {
    if (isObject(o)) {
        const n = {};

        Object.keys(o).forEach((k) => {
            n[toCamel(k)] = keysToCamel(o[k]);
        });

        return n;
    } else if (isArray(o)) {
        return o.map((i) => {
            return keysToCamel(i);
        });
    }

    return o;
};
