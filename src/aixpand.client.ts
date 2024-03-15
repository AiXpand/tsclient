import 'reflect-metadata';
import { EventEmitter2 } from 'eventemitter2';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { concatMap, filter, fromEvent, map, Observable, partition, tap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import {
    AiXpandClientEvent,
    AiXpandClientEventContext,
    AiXpandClientOptions,
    AiXpandCommandAction,
    AiXpandDataCaptureThread,
    AiXpandEventType,
    AiXpandPipeline,
    AiXpandPluginInstance,
    AiXpandUniverseHost,
    AiXPHeartbeatData,
    AiXPMessage,
    AiXPMessageType,
    AiXPNotificationData,
    AiXpNotificationType,
    AiXPPayloadData,
    CacheType,
    Dictionary,
    DummyStream, LiteMediaServerStream,
    MetaStream,
    MqttOptions,
    PluginRegistration,
    VideoStream,
    Void
} from "./models";
import { AiXpandException } from './aixpand.exception';
import { deserialize, transformer } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { REST_CUSTOM_EXEC_SIGNATURE } from './abstract.rest.custom.exec.plugin';
import { BufferServiceInterface } from './models/buffer.service.interface';
import { AiXpandMemoryBufferService } from './aixpand.memory.buffer.service';
import { VideoFile } from './models/dct/video.file.dct';
import { SingleCropMetaStream } from './models/dct/single.crop.meta.stream';
import { AiXpandInternalMessage, edgeNodeMessageParser } from './decoders/edge.node.message.parser';
import { cavi2Decoder } from './decoders/cavi2.decoder';
import { AiXpandBlockchainOptions, AiXpBC } from './utils/aixp.bc';
import * as path from 'path';
import { NodeRequestManager } from './models/node.requests/node.request.manager';
import { NodeRequest } from "./models/node.requests/node.request";
import { OnDemandInput } from "./models/dct/on.demand.input.dct";
import { OnDemandTextInput } from "./models/dct/on.demand.text.input.dct";
import { VideoStreamFFMPEG } from "./models/dct/video.stream.ffmpeg.dct";

export enum DataCaptureThreadType {
    DUMMY_STREAM = 'ADummyStructStream',
    VIDEO_STREAM = 'VideoStream',
    VIDEO_STREAM_FFMPEG = 'VideoStreamFfmpeg',
    LITE_MEDIA_SERVER_STREAM = 'LITE_MEDIA_SERVER',
    ON_DEMAND_INPUT = 'OnDemandInput',
    ON_DEMAND_TEXT_INPUT = 'OnDemandTextInput',
    VIDEO_FILE_MAP_REDUCE = 'video_file_map_reduce',
    VIDEO_FILE = 'VideoFile',
    SINGLE_CROP_META_STREAM = 'SingleCropMetaStream',
    META_STREAM = 'MetaStream',
    VOID_STREAM = 'VOID',
}

export type EngineStatus = {
    online: boolean;
    lastSeen: Date | null;
};

export type ClientOptions = {
    offlineTimeout: number;
    debug: boolean;
    secure: boolean;
};

export const ADMIN_PIPELINE_NAME = 'admin_pipeline';

/**
 * The AiXpand client handles all communication with the node network. It extends EventEmitter2 in order to be
 * able to emit messages for the consumer systems.
 */
export class AiXpandClient extends EventEmitter2 {
    /**
     * The network namespace. Can be overwritten in the connection options.
     *
     * @private
     */
    private readonly aixpNamespace: string;

    /**
     * An identifier of the connecting process.
     *
     * @private
     */
    private readonly initiator: string;

    /**
     * The MQTT connection information
     *
     * @private
     */
    private mqttOptions: MqttOptions;

    /**
     * The wrapped MQTT client.
     *
     * @private
     */
    private mqttClient: MqttClient;

    /**
     * The fleet of network nodes in direct control of the connecting application. This can be set in the
     * connection options object.
     *
     * @private
     */
    private fleet: Dictionary<EngineStatus> = {};

    /**
     * The list of all the nodes witnessed while running. It is built based on the heartbeats read from devices outside
     * the fleet.
     *
     * @private
     */
    private readonly universe: Dictionary<AiXpandUniverseHost>;

    /**
     * The AiXpand network system topics. This is where all the communication takes place.
     * There are three types of messages:
     *     - heartbeats, published on the `/ctrl` topic
     *     - payloads, the actual results from the pipelines run in the network, published on the `/payloads` topic
     *     - notifications, system messages concerning pipelines' successes or failures, on the `/notif` topic
     *
     * @private
     */
    private systemTopics: Dictionary<string> = {
        [AiXpandEventType.HEARTBEAT]: ':namespace:/ctrl',
        [AiXpandEventType.NOTIFICATION]: ':namespace:/notif',
        [AiXpandEventType.PAYLOAD]: ':group::namespace:/payloads',
    };

    /**
     * A dictionary of RxJS stream objects that wrap the system topics and enable the internal components to subscribe
     * to messages and transform them if needed.
     *
     * @private
     */
    private streams: Dictionary<Observable<AiXPMessage<any> | any>> = {};

    /**
     * A dictionary of all the Data Capture Threads (DCT) running on the controlled nodes. These are useful if one
     * wants to reuse a DCT for a new plugin instance.
     *
     * @private
     */
    private dataCaptureThreads: Dictionary<Dictionary<AiXpandDataCaptureThread<any>>> = {};

    /**
     * A dictionary of all the pipelines running on the controlled nodes.
     *
     * @private
     */
    private pipelines: Dictionary<Dictionary<AiXpandPipeline>> = {};

    /**
     * The request manager keeping track of all the requests made towards any of the fleet edge nodes.
     *
     * @private
     */
    private requestManager: NodeRequestManager;

    /**
     * Flag for instructing the MQTT client how to connect to the payloads topic.
     *
     * @private
     */
    private sharedSubscription = false;

    /**
     * The consumer group name to use when subscribing to MQTT payloads topic as a shared subscription.
     *
     * @private
     */
    private consumerGroupName: string = null;

    /**
     * Flag to instruct the client to buffer the incoming messages while the client boots.
     *
     * @private
     */
    private bufferMessages = false;

    /**
     * The buffer service implementation to use for buffering the messages.
     *
     * @private
     */
    private bufferService: BufferServiceInterface;

    /**
     * Miscellaneous options for changing client behavior.
     *
     * @private
     */
    private options: ClientOptions = {
        offlineTimeout: 60,
        debug: false,
        secure: true,
    };

    /**
     * Dictionary for keeping track of execution engine timeout callbacks.
     *
     * @private
     */
    private timeoutCallbacks: Dictionary<{ timer: any; timeout: number }> = {};

    /**
     * Dictionary for keeping track of the handlers for each type of observed PluginInstance.
     *
     * @private
     */
    private registeredPlugins: Dictionary<PluginRegistration> = {
        [`${REST_CUSTOM_EXEC_SIGNATURE}`]: {
            instanceConfig: null,
        },
    };

    /**
     * Dictionary for registering the default DataCaptureThread types.
     *
     * @private
     */
    private registeredDCTs: Dictionary<any> = {
        [`${DataCaptureThreadType.VIDEO_STREAM}`]: VideoStream,
        [`${DataCaptureThreadType.LITE_MEDIA_SERVER_STREAM}`]: LiteMediaServerStream,
        [`${DataCaptureThreadType.VIDEO_STREAM_FFMPEG}`]: VideoStreamFFMPEG,
        [`${DataCaptureThreadType.META_STREAM}`]: MetaStream,
        [`${DataCaptureThreadType.SINGLE_CROP_META_STREAM}`]: SingleCropMetaStream,
        [`${DataCaptureThreadType.DUMMY_STREAM}`]: DummyStream,
        [`${DataCaptureThreadType.ON_DEMAND_INPUT}`]: OnDemandInput,
        [`${DataCaptureThreadType.ON_DEMAND_TEXT_INPUT}`]: OnDemandTextInput,
        [`${DataCaptureThreadType.VIDEO_FILE}`]: VideoFile,
        [`${DataCaptureThreadType.VOID_STREAM}`]: Void,
    };

    /**
     * AiXpand Network status cache. This information is compiled from the
     * NET_MON application output from the network supervisor nodes.
     *
     * @private
     */
    private networkStatus: Dictionary<any> = {};

    /**
     * AiXpand Supervisor Node Kubernetes Cluster status cache. This information is compiled from the
     * K8S_MON application output from the network supervisor nodes.
     *
     * @private
     */
    private clusterStatus = {
        supervisor: null,
        status: {},
        timestamp: null,
    };

    private registeredMessageDecoders = {
        cavi2: (message) => {
            return cavi2Decoder(message);
        },
    };

    private blockchainEngine: AiXpBC = null;

    constructor(options: AiXpandClientOptions) {
        super(options.emitterOptions ?? {});

        this.initiator = options.name;
        this.aixpNamespace = options.aixpNamespace || 'lummetry';
        this.bufferMessages = options.options?.bufferPayloadsWhileBooting ?? false;

        if (this.bufferMessages) {
            switch (options.options.cacheType) {
                case CacheType.MEMORY:
                    this.bufferService = new AiXpandMemoryBufferService();
                    break;
                case CacheType.CUSTOM:
                    break;
            }
        }

        if (options?.options?.offlineTimeout) {
            this.options.offlineTimeout = options.options.offlineTimeout;
        }

        if (options?.options?.debug) {
            this.options.debug = options.options.debug;
        }

        if (options?.options?.secure === false) {
            this.options.secure = false;
        }

        options.fleet.forEach((engine: string) => {
            this.fleet[engine] = {
                online: false,
                lastSeen: null,
            };
        });

        this.universe = {};
        this.registeredPlugins = {
            ...this.registeredPlugins,
            ...options.plugins,
        };

        if (options.consumerGroup) {
            this.sharedSubscription = true;
            this.consumerGroupName = options.consumerGroup;
        }

        this.mqttOptions = options.mqtt;

        const blockchainOptions = <AiXpandBlockchainOptions>{
            fromFile: options.options.keyPair?.fromFile !== false,
        };

        if (blockchainOptions.fromFile) {
            console.log(path.join(__dirname, 'aixp.keys.json'));
            blockchainOptions.filePath = options.options.keyPair?.filePath || path.join(__dirname, 'aixp.keys.json');
            blockchainOptions.keyPair = null;
        } else {
            blockchainOptions.keyPair = {
                privateKey: options.options.keyPair.privateKey,
                publicKey: options.options.keyPair.publicKey,
            };
        }

        this.blockchainEngine = new AiXpBC(blockchainOptions);
        this.requestManager = new NodeRequestManager();
    }

    registerMessageDecoder(name, callback) {
        this.registeredMessageDecoders[name] = callback;

        return this;
    }

    /**
     * This method returns the initiator name used for the connection.
     *
     * @return initiator name
     */
    getName(): string {
        return this.initiator;
    }

    getBlockChainAddress() {
        return this.blockchainEngine.getAddress();
    }

    /**
     * This method connects the client to the network and attaches all the necessary callbacks on the network streams.
     */
    boot() {
        this.connectToMqtt(this.mqttOptions);
        this.makeStreams();

        this.streams[AiXpandEventType.HEARTBEAT].subscribe((message: AiXPMessage<AiXPHeartbeatData>) =>
            this.heartbeatProcessor(message),
        );

        this.streams[AiXpandEventType.PAYLOAD].subscribe((message: AiXPMessage<AiXPPayloadData>) =>
            this.payloadsProcessor(message),
        );

        this.streams[AiXpandEventType.NOTIFICATION].subscribe((message: AiXPMessage<AiXPNotificationData>) =>
            this.notificationsProcessor(message),
        );

        this.on(AiXpandClientEvent.AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE, (data) => {
            this.fleet[data.executionEngine] = {
                online: true,
                lastSeen: new Date(),
            };

            if (this.bufferMessages) {
                while (this.bufferService.nodeHasMessages(data.executionEngine)) {
                    const message = this.bufferService.get(data.executionEngine);

                    if (message.type === AiXPMessageType.NOTIFICATION) {
                        this.notificationsProcessor(<AiXPMessage<AiXPNotificationData>>message);
                    } else {
                        this.payloadsProcessor(<AiXPMessage<AiXPPayloadData>>message);
                    }
                }
            }
        });
    }

    /**
     * This method gracefully shuts down the client, removing all the callbacks and clearing the memory.
     */
    shutdown() {
        Object.keys(this.fleet).forEach((engine) => {
            this.deregisterExecutionEngine(engine);

            if (Object.keys(this.fleet).length == 0) {
                // all engines are deregistered, time to unsubscribe
                const topicSubscriptionStatus = {};
                for (const eventName of Object.keys(this.systemTopics)) {
                    topicSubscriptionStatus[eventName] = false;
                }

                const allTopicsUnsubscribed = (topicMap) => {
                    return Object.keys(topicMap).reduce((status, key) => status && topicMap[key], true);
                };

                Object.keys(this.systemTopics).forEach((eventName) => {
                    let groupPrefix = '';
                    if (this.sharedSubscription) {
                        groupPrefix = `$share/${this.consumerGroupName}/`;
                    }
                    const topic = this.systemTopics[eventName]
                        .replace(':namespace:', this.aixpNamespace)
                        .replace(':group:', groupPrefix);

                    this.mqttClient.unsubscribe(topic, { qos: 2 }, () => {
                        topicSubscriptionStatus[eventName] = true;

                        this.emit(AiXpandClientEvent.AIXP_CLIENT_SYS_TOPIC_UNSUBSCRIBE, null, {
                            eventName: eventName,
                            topic: topic,
                        });

                        if (allTopicsUnsubscribed(topicSubscriptionStatus)) {
                            this.mqttClient.end(true, {}, () => {
                                this.emit(AiXpandClientEvent.AIXP_CLIENT_SHUTDOWN, null, true);
                            });
                        }
                    });
                });
            }
        });
    }

    /**
     * Method for registering a new execution engine without rebooting the client.
     *
     * @param engine
     */
    registerExecutionEngine(engine: string) {
        if (!this.fleet[engine]) {
            this.fleet[engine] = {
                online: false,
                lastSeen: null,
            };

            delete this.universe[engine];

            this.emit(AiXpandClientEvent.AIXP_ENGINE_REGISTERED, {
                executionEngine: engine,
            });
        }

        return;
    }

    /**
     * Method for deregistering an execution engine without rebooting the client.
     *
     * @param engine
     */
    deregisterExecutionEngine(engine: string) {
        if (this.fleet[engine]) {
            delete this.fleet[engine];
            delete this.pipelines[engine];
            delete this.dataCaptureThreads[engine];

            if (!!this.timeoutCallbacks[engine]?.timer) {
                clearTimeout(this.timeoutCallbacks[engine].timer);
            }

            delete this.timeoutCallbacks[engine];

            this.emit(AiXpandClientEvent.AIXP_ENGINE_DEREGISTERED, {
                executionEngine: engine,
            });
        }

        return;
    }

    getFleet() {
        return Object.keys(this.fleet).map((engineName) => ({
            name: engineName,
            status: {
                online: this.fleet[engineName].online,
                lastSeen: this.fleet[engineName].lastSeen,
            },
        }));
    }

    restartExecutionEngine(engine: string) {
        if (!this.fleet[engine]) {
            this.emit(AiXpandClientEvent.AIXP_EXCEPTION, {
                error: true,
                message: `Cannot restart an Execution Engine not in your fleet: "${engine}"`,
            });

            return new Promise((resolve, reject) => {
                reject({
                    data: {
                        notification: `Cannot restart an Execution Engine not in your fleet: "${engine}"`,
                    },
                });
            });
        }

        const message = {
            ACTION: 'RESTART',
        };

        return this.publish(engine, message);
    }

    shutdownExecutionEngine(engine: string) {
        if (!this.fleet[engine]) {
            this.emit(AiXpandClientEvent.AIXP_EXCEPTION, {
                error: true,
                message: `Cannot shutdown an Execution Engine not in your fleet: "${engine}"`,
            });

            return new Promise((resolve) => {
                resolve({
                    data: {
                        notification: 'Unknown execution engine.',
                    },
                });
            });
        }

        const message = {
            ACTION: 'STOP',
        };

        return this.publish(engine, message);
    }

    getHeartbeatFromEngine(engine: string) {
        if (!this.fleet[engine]) {
            this.emit(AiXpandClientEvent.AIXP_EXCEPTION, {
                error: true,
                message: `Cannot get heartbeat from an Execution Engine not in your fleet: "${engine}"`,
            });

            return new Promise((resolve) => {
                resolve({
                    data: {
                        notification: 'Unknown execution engine.',
                    },
                });
            });
        }

        const message = {
            ACTION: 'TIMERS_ONLY_HEARTBEAT',
        };

        return this.publish(engine, message);
    }

    getRegisteredDCTTypes() {
        return Object.keys(this.registeredDCTs).map((key) => ({
            type: this.registeredDCTs[key].getSchema().type,
            name: this.registeredDCTs[key].getSchema().name,
            description: this.registeredDCTs[key].getSchema().description,
        }));
    }

    registerDCTType(name, dctClass) {
        this.registeredDCTs[name] = dctClass;

        return this;
    }

    getDCTSchema(dct: string) {
        if (!this.registeredDCTs[dct]) {
            return null;
        }

        return this.registeredDCTs[dct].getSchema();
    }

    getDCTClass(dct: string) {
        if (!this.registeredDCTs[dct]) {
            return null;
        }

        return this.registeredDCTs[dct];
    }

    getRegisteredPluginTypes() {
        return Object.keys(this.registeredPlugins)
            .filter((signature) => signature !== REST_CUSTOM_EXEC_SIGNATURE)
            .map((signature) => ({
                signature,
                name: this.registeredPlugins[signature].instanceConfig.getSchema().name,
                description: this.registeredPlugins[signature].instanceConfig.getSchema().description,
                linkable: this.registeredPlugins[signature].instanceConfig.getSchema().linkable ?? false,
            }));
    }

    getPluginSchema(signature: string) {
        if (!this.registeredPlugins[signature]) {
            return null;
        }

        return this.registeredPlugins[signature].instanceConfig.getSchema();
    }

    getPluginConfigClass(signature: string) {
        if (!this.registeredPlugins[signature]) {
            return null;
        }

        return this.registeredPlugins[signature].instanceConfig;
    }

    getPluginPayloadClass(signature: string) {
        if (!this.registeredPlugins[signature]) {
            return null;
        }

        return this.registeredPlugins[signature].payload;
    }

    /**
     * Returns a specific stream of events in the network. It can offer a window inside all the messages published
     * in a specific message type category.
     *
     * @param stream
     * @return Observable<AiXPMessage> a subscribable stream with the selected event type.
     */
    getStream(stream: AiXpandEventType): Observable<AiXPMessage<any>> {
        return this.streams[stream] ?? null;
    }

    /**
     * Returns the client's observable universe: all the hosts that sent a heartbeat that are outside
     * this client's fleet.
     *
     * @return Dictionary<AiXpandUniverseHost> the observable universe.
     */
    getUniverse(): Dictionary<AiXpandUniverseHost> {
        return this.universe;
    }

    /**
     * Returns all the pipelines associated with a host.
     *
     * @param node the network node for which to return the pipelines
     * @return Dictionary<AiXpandPipeline> the pipelines
     */
    getHostPipelines(node: string) {
        this.checkHost(node);

        return Object.keys(this.pipelines[node]).map((id) => ({
            name: id,
            dct: this.pipelines[node][id].getDataCaptureThread(),
            instances: this.pipelines[node][id].getPluginInstances().length,
        }));
    }

    /**
     * Return a specific pipeline from a host.
     *
     * @param node
     * @param streamId
     * @return AiXpandPipeline the pipeline to return
     */
    getPipeline(node: string, streamId: string): AiXpandPipeline {
        this.checkHost(node);

        return this.pipelines[node][streamId] ?? null;
    }

    /**
     * Returns the DCTs open on a specific node from the fleet.
     *
     * @param node string, the node name.
     * @return Dictionary<AiXpandDataCaptureThread<any>> a dictionary of the data capture threads.
     */
    getHostDataCaptureThreads(node: string): Dictionary<AiXpandDataCaptureThread<any>> {
        this.checkHost(node);

        return this.dataCaptureThreads[node];
    }

    batchUpdateInstances(executionEngine: string, instancesUpdates: any[]) {
        const message = {
            PAYLOAD: instancesUpdates,
            ACTION: AiXpandCommandAction.BATCH_UPDATE_PIPELINE_INSTANCE,
        };

        return this.publish(executionEngine, message).then(
            (responses) => {
                instancesUpdates.forEach((instanceUpdate) => {
                    this.getPipeline(executionEngine, instanceUpdate['NAME'])
                        .getPluginInstance(instanceUpdate['INSTANCE_ID'])
                        .clearChangeset();
                });

                return responses;
            },
            (errs) => {
                return errs;
            },
        );
    }

    publish(executionEngine: string, message: any, extraWatches: string[][] = []) {
        if (!message) {
            return new Promise((resolve) => {
                resolve({
                    data: {
                        notification: 'Already closed.',
                    },
                });
            });
        }

        message['INITIATOR_ID'] = this.initiator;
        message['EE_ID'] = executionEngine;
        message['TIME'] = new Date();

        const watches = [];
        if (extraWatches.length > 0) {
            console.log('GOT EXTRA WATCHES, PUSHING!!!', extraWatches);


            extraWatches.forEach((watch) => {
                watches.push(watch);
            });
        }

        switch (message['ACTION']) {
            case AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE:
                watches.push([
                    executionEngine,
                    message['PAYLOAD']['NAME'],
                    message['PAYLOAD']['SIGNATURE'],
                    message['PAYLOAD']['INSTANCE_ID'],
                ]);
                break;
            case AiXpandCommandAction.UPDATE_CONFIG:
            case AiXpandCommandAction.PIPELINE_COMMAND:
                watches.push([executionEngine, message['PAYLOAD']['NAME'], null, null]);

                break;
            case AiXpandCommandAction.ARCHIVE_CONFIG:
                watches.push([executionEngine, message['PAYLOAD'], null, null]);

                break;
            case AiXpandCommandAction.BATCH_UPDATE_PIPELINE_INSTANCE:
                message['PAYLOAD'].forEach((updateInstanceCommand) => {
                    watches.push([
                        executionEngine,
                        updateInstanceCommand['NAME'],
                        updateInstanceCommand['SIGNATURE'],
                        updateInstanceCommand['INSTANCE_ID'],
                    ]);
                });

                break;
        }

        console.log('COMPLETE WATCHES: ', watches);

        return new Promise((resolve, reject) => {
            if (watches.length > 0) {
                // don't create pending requests if no response is expected
                const pendingRequest: NodeRequest = this.requestManager.create(message, resolve, reject);
                watches.forEach((watchPath) => {
                    pendingRequest.watch(watchPath);
                });
            }

            this.mqttClient.publish(
                `${this.aixpNamespace}/${executionEngine}/config`,
                // @ts-ignore
                this.blockchainEngine.sign(message),
            );

            if (watches.length === 0) {
                resolve({
                    data: {
                        notification: `${message['ACTION']} command sent.`,
                    },
                });
            }
        });
    }

    createPipeline(node: string, dataSource = null, name = null) {
        if (!dataSource) {
            // TODO:
        }

        const isDataCaptureThreadConfig = Reflect.hasMetadata('data-capture-thread-config', dataSource.constructor)
            ? Reflect.getMetadata('data-capture-thread-config', dataSource.constructor)
            : false;
        if (isDataCaptureThreadConfig) {
            let id = uuidv4().substring(0, 13);
            if (name) {
                id = name;
            }

            this.pipelines[node][`${id}`] = new AiXpandPipeline(
                new AiXpandDataCaptureThread<any>(id, dataSource, this.initiator),
                node,
                this,
            );

            return this.pipelines[node][id];
        }

        const isDataCaptureThread = Reflect.hasMetadata('data-capture-thread', dataSource.constructor)
            ? Reflect.getMetadata('data-capture-thread', dataSource.constructor)
            : false;
        if (isDataCaptureThread) {
            if (!this.pipelines[node][`${dataSource.id}`]) {
                this.pipelines[node][`${dataSource.id}`] = new AiXpandPipeline(dataSource, node, this);
            }

            return this.pipelines[node][`${dataSource.id}`];
        }

        const isPipeline = Reflect.hasMetadata('aixpand-pipeline', dataSource.constructor)
            ? Reflect.getMetadata('aixpand-pipeline', dataSource.constructor)
            : false;
        if (isPipeline) {
            const id = uuidv4().substring(0, 13);
            this.pipelines[node][`${id}`] = new AiXpandPipeline(
                new AiXpandDataCaptureThread<any>(
                    id,
                    MetaStream.make({ collectedStreams: [dataSource.getDataCaptureThread().id] }),
                    this.initiator,
                ),
                node,
                this,
            );

            return this.pipelines[node][id];
        }

        return null;
    }

    /**
     * This method removes a pipeline from the client.
     *
     * @param pipeline
     * @throws AiXpandException
     */
    removePipeline(pipeline: AiXpandPipeline) {
        if (
            !this.pipelines[pipeline.getNode()] ||
            !this.pipelines[pipeline.getNode()][pipeline.getDataCaptureThread().id]
        ) {
            throw new AiXpandException(`Pipeline with DCT #${pipeline.getDataCaptureThread().id} does not exist.`);
        }

        delete this.pipelines[pipeline.getNode()][pipeline.getDataCaptureThread().id];

        return this;
    }

    /**
     * This method will return the network status for a specific supervisor.
     * @param supervisor
     */
    getNetworkStatus(supervisor?: string): any {
        if (supervisor && this.networkStatus[supervisor]) {
            return this.networkStatus[supervisor];
        }

        const supervisors = [];
        const supervisorNames = Object.keys(this.networkStatus);
        for (const supervisor of supervisorNames) {
            supervisors.push(this.networkStatus[supervisor]);
        }

        if (!supervisors.length) {
            return null;
        }

        // Sort by length DESC
        supervisors.sort((a, b) => {
            const entriesA = Object.keys(a.status).length;
            const entriesB = Object.keys(b.status).length;

            return entriesB - entriesA;
        });

        let mostRecent = {
            timestamp: '2004-04-24 10:33:37.082124',
        };
        // Search for the most recent (less than 30s) data
        for (let i = 0; i < supervisors.length; i++) {
            if (Date.parse(mostRecent.timestamp) - Date.parse(supervisors[i].timestamp) < 0) {
                mostRecent = supervisors[i];
            }

            if ((new Date().getTime() - Date.parse(mostRecent.timestamp)) / 1000 < 30) {
                return mostRecent;
            }
        }

        // all are older than 30s, return the freshest
        return mostRecent;
    }

    getK8sClusterStatus() {
        if (this.clusterStatus.timestamp === null) {
            return null;
        }

        return this.clusterStatus;
    }

    /**
     * Internal method for connecting to the AiXpand MQTT network.
     *
     * @param options
     * @private
     */
    private connectToMqtt(options: MqttOptions) {
        this.mqttClient = mqtt.connect(`${options.protocol}://${options.host}:${options.port}`, {
            username: options.username,
            password: options.password,
            clean: options.session.clean,
            clientId: options.session.clientId,
        });

        this.mqttClient.on('connect', () => {
            this.emit(AiXpandClientEvent.AIXP_CLIENT_CONNECTED, {
                upstream: `${options.protocol}://${options.host}:${options.port}`,
            });

            this.subscribeToTopics(this.systemTopics);
        });

        this.mqttClient.on('error', (err) => {
            this.emit(AiXpandClientEvent.AIXP_CLIENT_CONNECTION_ERROR, {
                err: err,
            });
        });

        this.mqttClient.on('disconnect', (status) => {
            this.emit(AiXpandClientEvent.AIXP_CLIENT_DISCONNECTED, {
                status,
            });
        });
    }

    /**
     * Internal method that subscribes to the MQTT topics and emits the subscription success or failure internal events.
     *
     * @param topics
     * @private
     */
    private subscribeToTopics(topics: Dictionary<string>) {
        const topicSubscriptionStatus = {};
        for (const topic of Object.keys(topics)) {
            topicSubscriptionStatus[topic] = false;
        }

        const allTopicsSubscribed = (topicMap) => {
            return Object.keys(topicMap).reduce((status, key) => status && topicMap[key], true);
        };

        Object.keys(topics).forEach((eventType) => {
            let groupPrefix = '';
            if (this.sharedSubscription) {
                groupPrefix = `$share/${this.consumerGroupName}/`;
            }

            const topic = topics[eventType].replace(':namespace:', this.aixpNamespace).replace(':group:', groupPrefix);

            this.mqttClient.subscribe(topic, { qos: 2 }, (err) => {
                if (err) {
                    this.emit(AiXpandClientEvent.AIXP_CLIENT_SYS_TOPIC_SUBSCRIBE, {
                        topic: topic,
                        err: err,
                    });

                    return;
                }

                topicSubscriptionStatus[eventType] = true;

                this.emit(AiXpandClientEvent.AIXP_CLIENT_SYS_TOPIC_SUBSCRIBE, null, {
                    event: eventType,
                    topic: topic,
                });

                if (allTopicsSubscribed(topicSubscriptionStatus)) {
                    this.emit(AiXpandClientEvent.AIXP_CLIENT_BOOTED, null, true);
                    this.emit(AiXpandClientEvent.AIXP_BC_ADDRESS, {
                        address: this.blockchainEngine.getAddress(),
                    });
                }
            });
        });
    }

    /**
     * Internal method for splitting and filtering the MQTT input event stream.
     *
     * @private
     */
    private makeStreams() {
        const mainStream = fromEvent(this.mqttClient, 'message')
            .pipe(
                map((message) => {
                    let stringMessage = `{ EE_FORMATTER: 'ignore-this'}`;
                    try {
                        stringMessage = message[2].payload.toString('utf-8');
                    } catch (e) {
                        console.log(e);
                    }

                    return stringMessage;
                }),
            )
            .pipe(
                filter((message) => {
                    return !this.options.secure || this.blockchainEngine.verify(message);
                }),
            )
            .pipe(
                map((message) => {
                    let parsedMessage;

                    try {
                        parsedMessage = JSON.parse(message);
                    } catch (e) {
                        console.log(e);
                        return { EE_FORMATTER: 'ignore-this' };
                    }

                    return parsedMessage;
                }),
            )
            .pipe(
                filter((message: any) => {
                    // filter out messages not generated by AiXpand Edge Nodes
                    return !!message.EE_PAYLOAD_PATH; // TODO:
                }),
            )
            // TODO: decrypt
            .pipe(
                filter((message): boolean => {
                    // filter out messages of unknown formats
                    return (
                        message.EE_FORMATTER === '' ||
                        !message.EE_FORMATTER ||
                        !!this.registeredMessageDecoders[message.EE_FORMATTER.toLowerCase()]
                    );
                }),
            )
            .pipe(
                concatMap(async (message: any): Promise<any> => {
                    // decode message into native network format
                    if (message.EE_FORMATTER?.toLowerCase() === '' || !message.EE_FORMATTER) {
                        return message; // already in native format
                    }

                    return await this.registeredMessageDecoders[message.EE_FORMATTER.toLowerCase()](message);
                }),
            )
            .pipe(
                tap((message: any) => {
                    // read supervisor payloads and cache the network status
                    if (
                        message.EE_PAYLOAD_PATH !== undefined &&
                        message.EE_PAYLOAD_PATH[1]?.toLowerCase() === 'admin_pipeline' &&
                        message.EE_PAYLOAD_PATH[2]?.toLowerCase() === 'net_mon_01'
                    ) {
                        const keys = Object.keys(message.CURRENT_NETWORK ?? {});
                        if (keys.length > 0) {
                            const supervisorName = message.EE_PAYLOAD_PATH[0];
                            this.networkStatus[supervisorName] = {
                                name: supervisorName,
                                status: message.CURRENT_NETWORK,
                                timestamp: message.EE_TIMESTAMP,
                            };
                        }
                    }

                    if (
                        message.EE_PAYLOAD_PATH !== undefined &&
                        message.EE_PAYLOAD_PATH[1]?.toLowerCase() === 'admin_pipeline' &&
                        message.EE_PAYLOAD_PATH[2]?.toLowerCase() === 'k8s_monitor_01'
                    ) {
                        this.clusterStatus.supervisor = message.EE_PAYLOAD_PATH[0];
                        this.clusterStatus.status = message.K8S_NODES;
                        this.clusterStatus.timestamp = message.EE_TIMESTAMP;
                    }
                }),
            )
            .pipe(
                filter((message: any) => {
                    // filter out messages from hosts not in fleet
                    if (!this.fleet[message.EE_ID]) {
                        this.universe[message.EE_ID] = <AiXpandUniverseHost>{
                            host: message.EE_ID,
                            lastSeen: new Date(),
                        };

                        return false;
                    }

                    return true;
                }),
            )
            .pipe(
                tap((message: any) => {
                    if (this.options.debug) {
                        console.dir(message, { depth: null });
                    }
                }),
            )
            .pipe(
                concatMap(async (message: AiXpandInternalMessage): Promise<AiXPMessage<any>> => {
                    // transform message to AiXPMessage
                    return plainToInstance(
                        AiXPMessage,
                        await transformer(
                            await edgeNodeMessageParser(message),
                            this.registeredPlugins,
                            this.registeredDCTs,
                        ),
                    );
                }),
            )

            .pipe(
                tap((message: any) => {
                    if (this.options.debug) {
                        console.dir(message, { depth: null });
                    }
                }),
            );

        const [heartbeatsStream, eventsStream] = partition(
            mainStream,
            (message) => message.type === AiXPMessageType.HEARTBEAT,
        );
        const [notificationsStream, payloadsStream] = partition(
            eventsStream,
            (message) => message.type === AiXPMessageType.NOTIFICATION,
        );

        this.streams[AiXpandEventType.HEARTBEAT] = heartbeatsStream;
        this.streams[AiXpandEventType.NOTIFICATION] = notificationsStream.pipe(
            filter((message: AiXPMessage<AiXPNotificationData>) => {
                if (message.path[1] === ADMIN_PIPELINE_NAME) {
                    return true;
                }

                // filter out notifications for other initiators
                return !message.data.context.initiator || message.data.context.initiator === this.initiator;
            }),
        );
        this.streams[AiXpandEventType.PAYLOAD] = payloadsStream;
    }

    /**
     * Internal method for initializing the data for a host the first time it's encountered.
     *
     * @param host
     * @private
     */
    private initializeValuesForHost(host) {
        if (!this.dataCaptureThreads[host]) {
            this.dataCaptureThreads[host] = {};
        }

        if (!this.pipelines[host]) {
            this.pipelines[host] = {};
        }
    }

    /**
     * Private method for processing heartbeat information.
     *
     * @param message
     * @private
     */
    private heartbeatProcessor(message: AiXPMessage<AiXPHeartbeatData>) {
        this.initializeValuesForHost(message.host.id);

        const timeout = message.data.node.heartbeatInterval ?? this.options.offlineTimeout;

        this.markAsSeen(message.host.id, timeout * 2);
        this.hydrateDCTs(message);
        this.hydrateInstances(message);
        this.linkInstances(message);

        this.emit(AiXpandClientEvent.AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE, {
            executionEngine: message.host.id,
        });
    }

    /**
     * Private method for handing the deserialization and emission of plugin payload data.
     *
     * @param message
     * @private
     */
    private payloadsProcessor(message: AiXPMessage<AiXPPayloadData>) {
        if (this.fleet[message.path[0]].online === false) {
            this.bufferMessage(message);

            return;
        }

        let payload = message.data;
        let signature = message.path[2];
        if (message.metadata.identifiers.tags?.CUSTOM_SIGNATURE) {
            signature = message.metadata.identifiers.tags?.CUSTOM_SIGNATURE;
        }

        if (this.registeredPlugins[signature]?.payload) {
            payload = deserialize(message.data, this.registeredPlugins[signature].payload);
        }

        const context = this.buildContext(message);
        if (context.instance?.hasCallback()) {
            const callback = context.instance.getCallback();

            callback(context, null, payload);
        } else {
            this.emit(
                signature,
                context,
                null, // error object
                payload,
            );
        }
    }

    /**
     * Private method for processing the network notifications and closing of all the
     * relevant pending transactions. It also emits internal events for all the plugins
     * associated to the notification.
     *
     * @param message
     * @private
     */
    private notificationsProcessor(message: AiXPMessage<AiXPNotificationData>) {
        if (this.fleet[message.path[0]].online === false) {
            this.bufferMessage(message);

            return;
        }

        const pendingRequest = this.requestManager.find(message.path);
        if (pendingRequest !== null) {
            console.log(`[Transaction: ${pendingRequest.id}] Found for path: ${message.path.join(', ')} `);

            pendingRequest.process(message);

            if (pendingRequest.isClosed()) {
                console.log(`[Transaction: ${pendingRequest.id}] Is Closed: Destroying.} `);

                this.requestManager.destroy(message.path);
            }
        } else {
            this.pipelines[message.path[0]][message.path[1]]
                ?.getPluginInstances()
                .forEach((instance: AiXpandPluginInstance<any>) => {
                    if (message.data.type === AiXpNotificationType.NORMAL) {
                        return;
                    }

                    const context = this.buildContext(message);
                    if (context.instance?.hasCallback()) {
                        const callback = context.instance.getCallback();

                        callback(context, message, null);
                    } else {
                        this.emit(instance.signature, context, message, null);
                    }
                });

            this.emit(
                AiXpandClientEvent.AIXP_VERBOSE_DEBUG,
                `Intercepted notification without pending transaction: ${message.data.notification}`,
            );

            return;
        }
    }

    /**
     * Private method for hydrating the DCT information from a heartbeat message.
     *
     * @param message
     * @private
     */
    private hydrateDCTs(message: AiXPMessage<AiXPHeartbeatData>) {
        Object.keys(message.data.dataCaptureThreads).forEach((streamId) => {
            const hbDCTConfig = message.data.dataCaptureThreads[streamId];

            // Update the network DCT dictionary
            if (!this.dataCaptureThreads[message.host.id][`${streamId}`]) {
                this.dataCaptureThreads[message.host.id][`${streamId}`] = hbDCTConfig;
            } else {
                try {
                    this.dataCaptureThreads[message.host.id][`${streamId}`].update(hbDCTConfig);
                } catch (e) {
                    this.emit(AiXpandClientEvent.AIXP_EXCEPTION, e);
                }
            }

            // Update the network pipelines' DCTs
            const dct = this.dataCaptureThreads[message.host.id][`${streamId}`];
            if (!this.pipelines[message.host.id][`${streamId}`]) {
                this.pipelines[message.host.id][`${streamId}`] = new AiXpandPipeline(dct, message.host.id, this);
            } else {
                this.pipelines[message.host.id][`${streamId}`].getDataCaptureThread().update(dct);
            }
        });
    }

    /**
     * Private method for hydrating the instances from the heartbeat message.
     *
     * @param message
     * @private
     */
    private hydrateInstances(message: AiXPMessage<AiXPHeartbeatData>) {
        message.data.activePlugins.forEach((plugin: AiXpandPluginInstance<any>) => {
            if (!this.pipelines[message.host.id][`${plugin.getStreamId()}`]) {
                return;
            }

            this.pipelines[message.host.id][`${plugin.getStreamId()}`].attachPluginInstance(plugin, true);
        });
    }

    /**
     * Private method for linking existing instances based on heartbeat information.
     *
     * @param message
     * @private
     */
    private linkInstances(message: AiXPMessage<AiXPHeartbeatData>) {
        Object.keys(message.data.links).forEach((mainInstanceId) => {
            const linkInfo = message.data.links[mainInstanceId];
            const mainInstance =
                this.pipelines[message.host.id][linkInfo.ownPipeline].getPluginInstance(mainInstanceId);
            linkInfo.instances.forEach((linkedInstanceInfo) => {
                const linkedInstance = this.pipelines[message.host.id][linkedInstanceInfo[0]].getPluginInstance(
                    linkedInstanceInfo[1],
                );

                if (linkedInstance) {
                    mainInstance.link(linkedInstance);
                }
            });
        });
    }

    /**
     * Private method for building the message context.
     *
     * @param message
     * @private
     */
    private buildContext(message: AiXPMessage<AiXPPayloadData | AiXPNotificationData>) {
        return <AiXpandClientEventContext>{
            path: message.path,
            pipeline: this.pipelines[message.path[0]][message.path[1]],
            instance: this.pipelines[message.path[0]][message.path[1]]?.getPluginInstance(message.path[3]),
            metadata: message.metadata,
            sender: message.host,
            time: message.time,
            info: {
                id: message.id,
                type: message.type,
                category: message.metadata.category,
            },
        };
    }

    /**
     * Private method that stores the messages in the buffer if message buffering is enabled.
     *
     * @param message
     * @private
     */
    private bufferMessage(message: AiXPMessage<AiXPPayloadData | AiXPNotificationData>) {
        if (this.bufferMessages) {
            this.bufferService.store(message);
        }
    }

    /**
     * Private method for handling the offline timeouts for the execution engines
     * registered in the fleet.
     *
     * @param engine
     * @param timeout
     * @private
     */
    private markAsSeen(engine: string, timeout: number) {
        if (this.timeoutCallbacks[engine]?.timer) {
            clearTimeout(this.timeoutCallbacks[engine].timer);
        }

        this.timeoutCallbacks[engine] = {
            timer: setTimeout(
                () => {
                    this.emit(AiXpandClientEvent.AIXP_ENGINE_OFFLINE, {
                        executionEngine: engine,
                    });
                },
                (timeout + 1) * 1000,
            ), // adding one second to account for possible network delays
            timeout: timeout,
        };
    }

    private checkHost(host: string) {
        if (!Object.keys(this.fleet).includes(host)) {
            throw new AiXpandException(`Node ${host} is not registered in the working fleet.`);
        }

        if (!this.pipelines[host]) {
            throw new AiXpandException(`Node ${host} is either offline or no heartbeat has been witnessed yet.`);
        }
    }
}
