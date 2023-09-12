import { AiXPMessageType } from '../models';
import { decode } from '../utils';

const mappedKeys = [
    'EE_TIMESTAMP',
    'EE_TIMEZONE',
    'EE_TZ',
    'EE_MESSAGE_ID',
    'EE_TOTAL_MESSAGES',
    'EE_ID',
    'SB_ID',
    'EE_EVENT_TYPE',
    'SB_EVENT_TYPE',
    'EE_VERSION',
    'debug_payload_saved',
    'TIMESTAMP_EXECUTION',
    'STREAM',
    'PIPELINE',
    'STREAM_NAME',
    'SIGNATURE',
    'INSTANCE_ID',
    'INITIATOR_ID',
    'SESSION_ID',
    'ID_TAGS',
    'COLLECTED',
    'ID',
    'DATASET_BUILDER_USED',
    'PLUGIN_CATEGORY',
    'EE_FORMATTER',
    'SB_IMPLEMENTATION',
    'EE_PAYLOAD_PATH',
    'EE_SIGN',
    'EE_SENDER',
    'EE_HASH',
];

export type AiXpandInternalMessage = {
    id: number;
    host: {
        id: string;
        sender: string;
        totalMessages: number;
        version: string;
    };
    initiator: string | null;
    type: string;
    path: string[];
    time: {
        date: Date;
        timezone: {
            utc: string;
            name: string;
        };
    };
    metadata: {
        message: {
            signature: string;
            hash: string;
        };
    };
    data: AiXpandInternalNotificationData | AiXpandInternalPayloadData | AiXpandInternalHeartbeatData;
};

export type AiXpandInternalNotificationData = {
    module: string;
    type: string;
    message: string;
    info: string;
    timestamp: Date;
    trace: any;
    displayed: boolean;
    identifiers: {
        initiator: string;
        session: string;
        stream: string;
        instance: string;
        signature: string;
    };
};

export type AiXpandInternalPayloadData = {
    plugin: {
        signature: string;
        category: string;
    };
    identifiers: {
        initiatorId: string;
        pipeline: string;
        instance: string;
        payload: number;
        session: string;
        tags: any;
        collected: string[] | null | boolean;
    };
    metadata: {
        executionTimestamp: Date;
        plugin: any;
        capture: any;
        datasetBuilderUsed: boolean;
        debugPayloadSaved: boolean;
    };
    data: any;
};

export type AiXpandInternalHeartbeatData = {
    heartbeatVersion: string;
    status: string;
    ip: string;
    uptime: number;
    timestamp: number;
    time: Date;
    memory: {
        machine: number;
        available: number;
        process: number;
    };
    disk: {
        available: number;
        total: number;
    };
    cpu: {
        name: string;
        used: number;
    };
    gpus: {
        defaultCuda: string | null;
        info: string;
        list: any[];
    };
    node: {
        address: string;
        isAlertRam: boolean;
        isSupervisor: boolean;
        heartbeatInterval: number;
        version: {
            full: string;
            python: string;
            logger: string;
        };
        branch: string;
        conda: string;
        counters: {
            inferences: number;
            payloads: number;
            streams: number;
        };
        network: {
            in: number;
            out: number;
        };
        servingPids: number[];
        loopsTimings: any;
        timers: string;
        logs: {
            device: string;
            error: string;
        };
    };
    activePlugins: ActivePluginData[];
    stopLog: StopLogData[];
    commStats: Map<string, CommunicationStatsData>;
    dctStats: Map<string, DCTStatsData>;
    pipelinesConfig: Map<string, PipelineConfigData>;
};

export type ActivePluginData = {
    signature: string;
    pipelineId: string;
    instanceId: string;
    frequency: number;
    totalPayloads: number;
    outsideWorkingHours: boolean;
    timers: {
        init: Date;
        exec: Date;
        config: Date;
        lastPayload: Date;
        firstError: Date;
        lastError: Date;
    };
    info: any;
    currentProcessIteration: number;
    currentExecIteration: number;
};

export type StopLogData = {
    nr: number;
    fromStart: string;
    when: Date;
    stage: string;
    resume: Date;
    duration: string;
    iter: number;
};

export type CommunicationStatsData = {
    svr: boolean;
    rcv: boolean;
    snd: boolean;
    act: number;
    addr: string;
    fails: number;
    error: any;
    errtm: any;
    in: number;
    out: number;
};

export type DCTStatsData = {
    type: string;
    flow: string;
    idle: number;
    idleAlert: boolean;
    DPS: number;
    cfgDPS: number;
    tgtDPS: number;
    stats: string;
    collecting: any | any[];
    fails: number;
    now: string;
};

export type PipelineConfigData = {
    config: any;
    plugins: any[];
};

export const edgeNodeMessageParser = async (message, initatorId): Promise<AiXpandInternalMessage> => {
    let parsedMessage: AiXpandInternalMessage = {
        id: message.EE_MESSAGE_ID,
        host: {
            id: message.EE_ID,
            sender: message.EE_SENDER,
            totalMessages: message.EE_TOTAL_MESSAGES,
            version: message.EE_VERSION,
        },
        initiator: message.INITIATOR_ID ?? null,
        type: message.EE_EVENT_TYPE ? message.EE_EVENT_TYPE.toLowerCase() : 'unknown',
        path: message.EE_PAYLOAD_PATH,
        time: {
            date: new Date(message.EE_TIMESTAMP),
            timezone: {
                utc: message.EE_TIMEZONE.toLowerCase(),
                name: message.EE_TZ,
            },
        },
        metadata: {
            message: {
                signature: message.EE_SIGN,
                hash: message.EE_HASH,
            },
        },
        data: null,
    };

    switch (parsedMessage.type) {
        case AiXPMessageType.HEARTBEAT:
            parsedMessage = await rawNetworkHeartbeatFormatter(parsedMessage, message, initatorId);
            break;
        case AiXPMessageType.NOTIFICATION:
            parsedMessage = rawNetworkNotificationFormatter(parsedMessage, message);
            break;
        case AiXPMessageType.PAYLOAD:
            parsedMessage = rawNetworkPayloadFormatter(parsedMessage, message);
            break;
    }

    return parsedMessage;
};

const rawNetworkHeartbeatFormatter = async (
    parsedMessage,
    originalMessage,
    initiatorId,
): Promise<AiXpandInternalMessage> => {
    if (originalMessage.ENCODED_DATA) {
        const decoded = JSON.parse(await decode(originalMessage.ENCODED_DATA));
        Object.keys(decoded).forEach((key) => {
            originalMessage[key] = decoded[key];
        });
    }

    const parsed = <AiXpandInternalHeartbeatData>{
        heartbeatVersion: originalMessage.HEARTBEAT_VERSION,
        status: originalMessage.DEVICE_STATUS,
        ip: originalMessage.MACHINE_IP,
        uptime: originalMessage.UPTIME,
        timestamp: parseInt(originalMessage.TIMESTAMP),
        time: new Date(originalMessage.CURRENT_TIME),
        memory: {
            machine: originalMessage.MACHINE_MEMORY,
            available: originalMessage.AVAILABLE_MEMORY,
            process: originalMessage.PROCESS_MEMORY,
        },
        disk: {
            available: originalMessage.AVAILABLE_DISK,
            total: originalMessage.TOTAL_DISK,
        },
        cpu: {
            name: originalMessage.CPU,
            used: originalMessage.CPU_USED,
        },
        gpus: {
            defaultCuda: originalMessage.DEFAULT_CUDA,
            info: originalMessage.GPU_INFO,
            list: Array.isArray(originalMessage.GPUS)
                ? originalMessage.GPUS.map((gpuDetails) => ({
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
        node: {
            address: originalMessage.EE_ADDR,
            isAlertRam: originalMessage.IS_ALERT_RAM,
            isSupervisor: originalMessage.EE_IS_SUPER ?? false,
            heartbeatInterval: originalMessage.EE_HB_TIME,
            version: {
                full: originalMessage.VERSION,
                python: originalMessage.PY_VER,
                logger: originalMessage.LOGGER_VERSION,
            },
            branch: originalMessage.GIT_BRANCH,
            conda: originalMessage.CONDA_ENV,
            counters: {
                inferences: originalMessage.NR_INFERENCES,
                payloads: originalMessage.NR_PAYLOADS,
                streams: originalMessage.NR_STREAMS_DATA,
            },
            network: {
                in: originalMessage.IN_KB,
                out: originalMessage.OUT_KB,
            },
            servingPids: originalMessage.SERVING_PIDS,
            loopsTimings: originalMessage.LOOPS_TIMINGS,
            timers: originalMessage.TIMERS,
            logs: {
                device: originalMessage.DEVICE_LOG,
                error: originalMessage.ERROR_LOG,
            },
        },
        activePlugins: [],
        stopLog: originalMessage.STOP_LOG
            ? originalMessage.STOP_LOG.map(
                  (entry): StopLogData => ({
                      nr: entry.NR,
                      fromStart: entry.FROM_START,
                      when: new Date(entry.WHEN),
                      stage: entry.STAGE,
                      resume: entry.RESUME ? new Date(entry.RESUME) : null,
                      duration: entry.DURATION,
                      iter: entry.ITER,
                  }),
              )
            : [],
        commStats: new Map<string, any>(),
        dctStats: new Map<string, any>(),
        pipelinesConfig: new Map<string, any>(),
    };

    if (originalMessage.COMM_STATS) {
        Object.keys(originalMessage.COMM_STATS).forEach((channel) => {
            const stats = {
                svr: originalMessage.COMM_STATS[channel].SVR,
                rcv: originalMessage.COMM_STATS[channel].RCV,
                snd: originalMessage.COMM_STATS[channel].SND,
                act: originalMessage.COMM_STATS[channel].ACT,
                addr: originalMessage.COMM_STATS[channel].ADDR,
                fails: originalMessage.COMM_STATS[channel].FAILS,
                error: originalMessage.COMM_STATS[channel].ERROR,
                errtm: originalMessage.COMM_STATS[channel].ERRTM,
                in: originalMessage.COMM_STATS[channel].IN_KB,
                out: originalMessage.COMM_STATS[channel].OUT_KB,
            };

            parsed.commStats.set(channel, stats);
        });
    }

    Object.keys(originalMessage.DCT_STATS).forEach((dctData) => {
        parsed.dctStats.set(dctData, <DCTStatsData>{
            type: originalMessage.DCT_STATS[dctData].TYPE,
            flow: originalMessage.DCT_STATS[dctData].FLOW,
            idle: originalMessage.DCT_STATS[dctData].IDLE,
            idleAlert: originalMessage.DCT_STATS[dctData].IDLE_ALERT,
            DPS: originalMessage.DCT_STATS[dctData].DPS,
            cfgDPS: originalMessage.DCT_STATS[dctData].CFG_DPS,
            tgtDPS: originalMessage.DCT_STATS[dctData].TGT_DPS,
            stats: originalMessage.DCT_STATS[dctData].RUNSTATS,
            collecting: originalMessage.DCT_STATS[dctData].COLLECTING,
            fails: originalMessage.DCT_STATS[dctData].FAILS,
            now: originalMessage.DCT_STATS[dctData].NOW,
        });
    });

    originalMessage.CONFIG_STREAMS.forEach((pipelineConfig) => {
        const pipelineName = pipelineConfig.NAME;
        const pluginsConfig = pipelineConfig.PLUGINS || [];
        const config = { ...pipelineConfig };
        delete config.PLUGINS;

        parsed.pipelinesConfig.set(pipelineName, <PipelineConfigData>{
            config: config,
            plugins: pluginsConfig,
        });
    });

    if (originalMessage.ACTIVE_PLUGINS) {
        originalMessage.ACTIVE_PLUGINS.forEach((pluginData) => {
            const parsedPluginInfo = {
                signature: pluginData.SIGNATURE,
                pipelineId: pluginData.STREAM_ID,
                instanceId: pluginData.INSTANCE_ID,
                frequency: pluginData.FREQUENCY,
                totalPayloads: pluginData.TOTAL_PAYLOAD_COUNT,
                outsideWorkingHours: pluginData.OUTSIDE_WORKING_HOURS,
                timers: {
                    init: new Date(pluginData.INIT_TIMESTAMP),
                    exec: new Date(pluginData.EXEC_TIMESTAMP),
                    config: new Date(pluginData.LAST_CONFIG_TIMESTAMP),
                    lastPayload: new Date(pluginData.LAST_PAYLOAD_TIME),
                    firstError: pluginData.FIRST_ERROR_TIME ? new Date(pluginData.FIRST_ERROR_TIME) : null,
                    lastError: pluginData.LAST_ERROR_TIME ? new Date(pluginData.LAST_ERROR_TIME) : null,
                },
                info: pluginData.INFO,
                currentProcessIteration: pluginData.CURRENT_PROCESS_ITERATION,
                currentExecIteration: pluginData.CURRENT_EXEC_ITERATION,
            };

            if (parsed.pipelinesConfig.has(parsedPluginInfo.pipelineId)) {
                parsed.activePlugins.push(parsedPluginInfo);
            }
        });
    }

    parsedMessage.data = parsed;

    return parsedMessage;
};

const rawNetworkNotificationFormatter = (parsedMessage, originalMessage): AiXpandInternalMessage => {
    parsedMessage.data = <AiXpandInternalNotificationData>{
        module: originalMessage.MODULE,
        type: originalMessage.NOTIFICATION_TYPE,
        message: originalMessage.NOTIFICATION,
        info: originalMessage.INFO,
        timestamp: new Date(originalMessage.TIMESTAMP),
        trace: originalMessage.TRACE,
        displayed: originalMessage.DISPLAYED,
        identifiers: {
            initiator: originalMessage.INITIATOR_ID ?? null,
            session: originalMessage.SESSION_ID ?? null,
            stream: originalMessage.STREAM_NAME ?? null,
            instance: originalMessage.INSTANCE_ID ?? null,
            signature: originalMessage.SIGNATURE ?? null,
        },
    };

    return parsedMessage;
};

const rawNetworkPayloadFormatter = (parsedMessage, originalMessage): AiXpandInternalMessage => {
    const pluginData = {
        signature: originalMessage.SIGNATURE.toUpperCase(),
        category: originalMessage.PLUGIN_CATEGORY,
    };

    const pluginMetadata = {
        executionTimestamp: new Date(originalMessage.TIMESTAMP_EXECUTION),
        plugin: {},
        capture: {},
        datasetBuilderUsed: originalMessage.DATASET_BUILDER_USED,
    };

    Object.keys(originalMessage).forEach((key) => {
        if (key.startsWith('_P_')) {
            pluginMetadata.plugin[`${toCamel(key.substring(3))}`] = originalMessage[key];
        }

        if (key.startsWith('_C_')) {
            pluginMetadata.capture[`${toCamel(key.substring(3))}`] = originalMessage[key];
        }
    });

    const parsedData = <AiXpandInternalPayloadData>{
        identifiers: {
            initiatorId: originalMessage.INITIATOR_ID,
            pipeline: originalMessage.PIPELINE,
            instance: originalMessage.INSTANCE_ID,
            payload: parseInt(originalMessage.ID),
            session: originalMessage.SESSION_ID,
            tags: originalMessage.ID_TAGS,
            collected: originalMessage.COLLECTED,
        },
        data: {},
    };

    Object.keys(originalMessage).forEach((key) => {
        if (key.startsWith('_P_') || key.startsWith('_C_') || mappedKeys.includes(key)) {
            return;
        }

        parsedData.data[key] = originalMessage[key];
    });

    parsedMessage.metadata = Object.assign(parsedMessage.metadata, pluginData, pluginMetadata);
    parsedMessage.data = <AiXpandInternalPayloadData>parsedData;

    return parsedMessage;
};

const toCamel = (s) => {
    return s.toLowerCase().replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
    });
};
