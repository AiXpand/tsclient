import 'reflect-metadata';
import { EventEmitter2 } from 'eventemitter2';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { concatMap, filter, fromEvent, map, Observable, partition } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import {
    AiXpandClientEvent,
    AiXpandClientEventContext,
    AiXpandClientOptions,
    AiXpandCommandAction,
    AiXpandDataCaptureThread,
    AiXpandEventType,
    AiXpandPendingTransaction,
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
    DummyStream,
    MetaStream,
    MqttOptions,
    PluginRegistration,
    VideoFileMultiNode,
    VideoStream,
    Void,
} from './models';
import { AiXpandException } from './aixpand.exception';
import { deserialize, transformer } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { REST_CUSTOM_EXEC_SIGNATURE } from './abstract.rest.custom.exec.plugin';
import { BufferServiceInterface } from './models/buffer.service.interface';
import { AiXpandMemoryBufferService } from './aixpand.memory.buffer.service';
import { VideoFile } from './models/dct/video.file.dct';

export enum DataCaptureThreadType {
    DUMMY_STREAM = 'ADummyStructStream',
    VIDEO_STREAM = 'VideoStream',
    VIDEO_FILE_MAP_REDUCE = 'video_file_map_reduce',
    VIDEO_FILE = 'VideoFile',
    META_STREAM = 'MetaStream',
    VOID_STREAM = 'VOID',
}

export type EngineStatus = {
    online: boolean;
    lastSeen: Date | null;
};

export type ClientOptions = {
    offlineTimeout: number;
};

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
     * A dictionary for keeping references to pending promises that wrap EE plugin updates.
     *
     * @private
     */
    private pendingTransactions: Dictionary<AiXpandPendingTransaction[]> = {};

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
        [`${DataCaptureThreadType.META_STREAM}`]: MetaStream,
        [`${DataCaptureThreadType.DUMMY_STREAM}`]: DummyStream,
        [`${DataCaptureThreadType.VIDEO_FILE_MAP_REDUCE}`]: VideoFileMultiNode,
        [`${DataCaptureThreadType.VIDEO_FILE}`]: VideoFile,
        [`${DataCaptureThreadType.VOID_STREAM}`]: Void,
    };

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
    }

    /**
     * This method returns the initiator name used for the connection.
     *
     * @return initiator name
     */
    getName(): string {
        return this.initiator;
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

                    this.mqttClient.unsubscribe(topic, {}, () => {
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

            clearTimeout(this.timeoutCallbacks[engine].timer);

            delete this.timeoutCallbacks[engine];

            this.emit(AiXpandClientEvent.AIXP_ENGINE_DEREGISTERED, {
                executionEngine: engine,
            });
        }

        return;
    }

    restartExecutionEngine(engine: string) {
        if (!this.fleet[engine]) {
            this.emit(AiXpandClientEvent.AIXP_EXCEPTION, {
                error: true,
                message: `Cannot restart an Execution Engine not in your fleet: "${engine}"`,
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
        }

        const message = {
            ACTION: 'STOP',
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

    getDCTSchema(dct: string) {
        return this.registeredDCTs[dct].getSchema();
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
        return this.pipelines[node][streamId] ?? null;
    }

    /**
     * Returns the DCTs open on a specific node from the fleet.
     *
     * @param node string, the node name.
     * @return Dictionary<AiXpandDataCaptureThread<any>> a dictionary of the data capture threads.
     */
    getHostDataCaptureThreads(node: string): Dictionary<AiXpandDataCaptureThread<any>> {
        return this.dataCaptureThreads[node];
    }

    publish(executionEngine: string, message: any) {
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

        const context = [executionEngine, null, null, null];
        switch (message['ACTION']) {
            case AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE:
                context[1] = message['PAYLOAD']['NAME'];
                context[2] = message['PAYLOAD']['SIGNATURE'];
                context[3] = message['PAYLOAD']['INSTANCE_ID'];

                break;
            case AiXpandCommandAction.UPDATE_CONFIG:
                context[1] = message['PAYLOAD']['NAME'];
                break;
            case AiXpandCommandAction.ARCHIVE_CONFIG:
                context[1] = message['PAYLOAD'];
                break;
        }

        return new Promise((resolve, reject) => {
            const key = context.join(':');
            if (!this.pendingTransactions[key]) {
                this.pendingTransactions[key] = [];
            }

            this.pendingTransactions[key].push(<AiXpandPendingTransaction>{
                onSuccess: resolve,
                onFail: reject,
            });

            this.mqttClient.publish(`${this.aixpNamespace}/${executionEngine}/config`, JSON.stringify(message));
        });
    }

    createPipeline(node: string, dataSource = null) {
        if (!dataSource) {
            // TODO:
        }

        const isDataCaptureThreadConfig = Reflect.hasMetadata('data-capture-thread-config', dataSource.constructor)
            ? Reflect.getMetadata('data-capture-thread-config', dataSource.constructor)
            : false;
        if (isDataCaptureThreadConfig) {
            const id = uuidv4().substring(0, 13);
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
                    MetaStream.make({ collectedStreams: [ dataSource.getDataCaptureThread().id ] }),
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
                    // parse JSON
                    let parsedMessage;
                    try {
                        parsedMessage = JSON.parse(message[2].payload.toString('utf-8').replace(/\bNaN\b/g, 'null'));
                    } catch (e) {
                        console.log('Received non utf-8 compliant message. Ignoring.');

                        return {
                            EE_FORMATTER: 'ignore-this',
                        };
                    }

                    return parsedMessage;
                }),
            )
            .pipe(
                filter((message) => {
                    // filter out messages of unknown formats
                    return message.EE_FORMATTER === 'cavi2';
                }),
            )
            .pipe(
                filter((message) => {
                    // filter out messages from hosts not in fleet
                    if (!this.fleet[message.sender.hostId]) {
                        this.universe[message.sender.hostId] = <AiXpandUniverseHost>{
                            host: message.sender.hostId,
                            lastSeen: new Date(),
                        };

                        return false;
                    }

                    return true;
                }),
            )
            .pipe(
                concatMap(async (message): Promise<AiXPMessage<any>> => {
                    // transform message to AiXPMessage
                    return plainToInstance(
                        AiXPMessage,
                        await transformer(message, this.registeredPlugins, this.registeredDCTs),
                    );
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
            filter((message) => {
                // filter out notifications for other initiators
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return !message.data.context.initiator || message.data.context.initiator === this.initiator;
            }),
        );
        this.streams[AiXpandEventType.PAYLOAD] = payloadsStream.pipe(
            filter((message) => {
                // filter out messages for other initiators
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return message.data.identifiers ? message.data.identifiers.initiatorId === this.initiator : false;
            }),
        );
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
        this.initializeValuesForHost(message.sender.host);

        const timeout = message.data.ee.heartbeatInterval ?? this.options.offlineTimeout;

        this.markAsSeen(message.sender.host, timeout);
        this.hydrateDCTs(message);
        this.hydrateInstances(message);
        this.linkInstances(message);

        this.emit(AiXpandClientEvent.AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE, {
            executionEngine: message.sender.host,
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

        const rawPayload = message.data;
        let payload = JSON.parse(JSON.stringify(rawPayload)); // deep copy hack...
        let signature = message.path[2];
        if (rawPayload.id_tags?.CUSTOM_SIGNATURE) {
            signature = rawPayload.id_tags?.CUSTOM_SIGNATURE;
        }

        if (this.registeredPlugins[signature]?.payload) {
            payload = deserialize(payload, this.registeredPlugins[signature].payload);
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

        const pending = !this.pendingTransactions[message.path.join(':')]
            ? null
            : this.pendingTransactions[message.path.join(':')].shift();
        if (!pending) {
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

        switch (message.data.type) {
            case AiXpNotificationType.NORMAL:
                pending.onSuccess(message);
                break;
            case AiXpNotificationType.ABNORMAL:
            case AiXpNotificationType.EXCEPTION:
                console.dir(message, { depth: null });

                pending.onFail(message);
                break;
        }
    }

    /**
     * Private method for hydrating the DCT information from a heartbeat message.
     *
     * @param message
     * @private
     */
    private hydrateDCTs(message: AiXPMessage<AiXPHeartbeatData>) {
        Object.keys(message.data.ee.dataCaptureThreads).forEach((streamId) => {
            const hbDCTConfig = message.data.ee.dataCaptureThreads[streamId];
            if (hbDCTConfig.getInitiator() !== this.initiator) {
                return;
            }

            // Update the network DCT dictionary
            if (!this.dataCaptureThreads[message.sender.host][`${streamId}`]) {
                this.dataCaptureThreads[message.sender.host][`${streamId}`] = hbDCTConfig;
            } else {
                try {
                    this.dataCaptureThreads[message.sender.host][`${streamId}`].update(hbDCTConfig);
                } catch (e) {
                    this.emit(AiXpandClientEvent.AIXP_EXCEPTION, e);
                }
            }

            // Update the network pipelines' DCTs
            const dct = this.dataCaptureThreads[message.sender.host][`${streamId}`];
            if (!this.pipelines[message.sender.host][`${streamId}`]) {
                this.pipelines[message.sender.host][`${streamId}`] = new AiXpandPipeline(
                    dct,
                    message.sender.host,
                    this,
                );
            } else {
                this.pipelines[message.sender.host][`${streamId}`].getDataCaptureThread().update(dct);
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
        message.data.ee.activePlugins.forEach((plugin: AiXpandPluginInstance<any>) => {
            if (!this.pipelines[message.sender.host][`${plugin.getStreamId()}`]) {
                console.log(`Attempted to attach plugin on non-existing stream: ${plugin.getStreamId()}`);
                return;
            }

            this.pipelines[message.sender.host][`${plugin.getStreamId()}`].attachPluginInstance(plugin);
        });
    }

    /**
     * Private method for linking existing instances based on heartbeat information.
     *
     * @param message
     * @private
     */
    private linkInstances(message: AiXPMessage<AiXPHeartbeatData>) {
        Object.keys(message.data.ee.links).forEach((mainInstanceId) => {
            const linkInfo = message.data.ee.links[mainInstanceId];
            const mainInstance =
                this.pipelines[message.sender.host][linkInfo.ownPipeline].getPluginInstance(mainInstanceId);
            linkInfo.instances.forEach((linkedInstanceInfo) => {
                const linkedInstance = this.pipelines[message.sender.host][linkedInstanceInfo[0]].getPluginInstance(
                    linkedInstanceInfo[1],
                );
                mainInstance.link(linkedInstance);
            });
        });
    }

    /**
     * Private method for building the message context.
     *
     * @param message
     * @private
     */
    private buildContext(message) {
        return <AiXpandClientEventContext>{
            path: message.path,
            pipeline: this.pipelines[message.path[0]][message.path[1]],
            instance: this.pipelines[message.path[0]][message.path[1]]?.getPluginInstance(message.path[3]),
            metadata: message.metadata,
            sender: message.sender,
            time: message.time,
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
            timer: setTimeout(() => {
                this.emit(AiXpandClientEvent.AIXP_ENGINE_OFFLINE, {
                    executionEngine: engine,
                });
            }, (timeout + 1) * 1000), // adding one second to account for possible network delays
            timeout: timeout,
        };
    }
}
