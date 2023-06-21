import { plainToInstance } from 'class-transformer';
import {
    AiXpandDataCaptureThread,
    AiXpandDCTRate,
    AiXpandDCTStats,
    AiXpandPluginInstance,
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
import { AiXpandAlerter } from '../models/aixpand.alerter';
import { decode } from './aixp.pseudopy.helpers';

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
        ee: {
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

    for (const streamId of Object.keys(rawMessage.metadata.dct_stats)) {
        const config = findDCTConfig(streamId, rawMessage.metadata.config_streams);

        if (!registeredDCTs[`${rawMessage.metadata.dct_stats[streamId].TYPE}`]) {
            console.log(`Found unknown DCT type: "${rawMessage.metadata.dct_stats[streamId].TYPE}"`);
            continue;
        }

        heartbeat.ee.dataCaptureThreads[streamId] = new AiXpandDataCaptureThread(
            streamId,
            deserialize(config, registeredDCTs[`${rawMessage.metadata.dct_stats[streamId].TYPE}`]),
            config['INITIATOR_ID'],
        )
            .setTime(rawMessage.metadata.dct_stats[streamId].NOW)
            .setDPS(<AiXpandDCTRate>{
                actual: rawMessage.metadata.dct_stats[streamId].DPS,
                configured: rawMessage.metadata.dct_stats[streamId].CFG_DPS,
                target: rawMessage.metadata.dct_stats[streamId].TGT_DPS,
            })
            .setStatus(<AiXpandDCTStats>{
                flow: rawMessage.metadata.dct_stats[streamId].FLOW,
                collecting: rawMessage.metadata.dct_stats[streamId].COLLECTING,
                idle: rawMessage.metadata.dct_stats[streamId].IDLE,
                fails: rawMessage.metadata.dct_stats[streamId].FAILS,
                log: rawMessage.metadata.dct_stats[streamId].RUNSTATS,
            });
    }

    for (const rawPluginInfo of rawMessage.metadata.active_plugins) {
        if (!plugins[rawPluginInfo.SIGNATURE]) {
            continue;
        }

        // extract the instance config from the heartbeat pipelines
        const rawPluginConfig = findPluginConfig(
            { signature: rawPluginInfo.SIGNATURE, id: rawPluginInfo.INSTANCE_ID },
            rawMessage.metadata.config_streams,
        );

        if (
            !rawPluginConfig || // skip if no config is found
            (rawPluginInfo.SIGNATURE === REST_CUSTOM_EXEC_SIGNATURE && // or untagged rest exec
                rawPluginConfig.ID_TAGS?.CUSTOM_SIGNATURE === undefined)
        ) {
            continue;
        }

        let instanceClass;
        if (rawPluginConfig.ID_TAGS?.CUSTOM_SIGNATURE) {
            if (!plugins[rawPluginConfig.ID_TAGS.CUSTOM_SIGNATURE]?.instanceConfig) {
                continue;
            }

            instanceClass = plugins[rawPluginConfig.ID_TAGS.CUSTOM_SIGNATURE]?.instanceConfig;
        } else {
            instanceClass = plugins[rawPluginInfo.SIGNATURE].instanceConfig;
        }

        const pluginInstance = new AiXpandPluginInstance(
            rawPluginInfo.INSTANCE_ID,
            deserialize(rawPluginConfig, instanceClass),
            null,
            deserialize(rawPluginConfig, AiXpandAlerter),
        );

        if (rawPluginConfig['ID_TAGS']) {
            Object.keys(rawPluginConfig['ID_TAGS']).forEach((key) => {
                pluginInstance.addTag(key, rawPluginConfig['ID_TAGS'][key]);
            });
        }

        pluginInstance
            .updateMetadata(rawPluginInfo.FREQUENCY, rawPluginInfo.OUTSIDE_WORKING_HOURS, {
                init: new Date(rawPluginInfo.INIT_TIMESTAMP),
                exec: new Date(rawPluginInfo.EXEC_TIMESTAMP),
                config: new Date(rawPluginInfo.LAST_CONFIG_TIMESTAMP),
                error: {
                    first: rawPluginInfo.FIRST_ERROR_TIME ? new Date(rawPluginInfo.FIRST_ERROR_TIME) : null,
                    last: rawPluginInfo.LAST_ERROR_TIME ? new Date(rawPluginInfo.LAST_ERROR_TIME) : null,
                },
            })
            .setStreamId(rawPluginInfo.STREAM_ID);

        heartbeat.ee.activePlugins.push(pluginInstance);

        if (rawPluginConfig['LINKED_INSTANCES']) {
            heartbeat.ee.links[pluginInstance.id] = {
                ownPipeline: rawPluginInfo.STREAM_ID,
                instances: rawPluginConfig['LINKED_INSTANCES'],
            };
        }
    }

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

const findDCTConfig = (needle: string, haystack: any[]) => {
    let returnable = {};

    haystack.forEach((config) => {
        // TODO: for ... of
        if (config.NAME === needle) {
            returnable = config;
        }
    });

    return returnable;
};

const findPluginConfig = (needle: { signature: string; id: string }, haystack: any[]) => {
    let returnable = null;

    haystack.forEach((config) => {
        const plugin = config.PLUGINS.find((plugin) => plugin.SIGNATURE === needle.signature);
        if (plugin) {
            const instance = plugin.INSTANCES.find((instance) => instance.INSTANCE_ID === needle.id);
            if (instance) {
                returnable = instance;
            }
        }
    });

    return returnable;
};
