import 'reflect-metadata';
import { EventEmitter2 } from 'eventemitter2';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { filter, fromEvent, map, Observable, partition } from 'rxjs';
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

export enum DataCaptureThreadType {
    DUMMY_STREAM = 'ADummyStructStream',
    VIDEO_STREAM = 'VideoStream',
    VIDEO_FILE_MAP_REDUCE = 'video_file_map_reduce',
    META_STREAM = 'MetaStream',
    VOID_STREAM = 'Void',
}

export type EngineStatus = {
    online: boolean;
    lastSeen: Date | null;
};

export type ClientOptions = {
    offlineTimeout: number;
}

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

    private pendingTransactions: Dictionary<AiXpandPendingTransaction[]> = {};

    private sharedSubscription = false;

    private consumerGroupName: string = null;

    private bufferMessages = false;

    private bufferService: BufferServiceInterface;

    private options: ClientOptions = {
        offlineTimeout: 60,
    };

    private timeoutCallbacks: Dictionary<{timer: any, timeout: number}> = {};

    private registeredPlugins: Dictionary<PluginRegistration> = {
        [`${REST_CUSTOM_EXEC_SIGNATURE}`]: {
            instanceConfig: null,
        },
    };

    private registeredDCTs: Dictionary<any> = {
        [`${DataCaptureThreadType.VIDEO_STREAM}`]: VideoStream,
        [`${DataCaptureThreadType.META_STREAM}`]: MetaStream,
        [`${DataCaptureThreadType.DUMMY_STREAM}`]: DummyStream,
        [`${DataCaptureThreadType.VIDEO_FILE_MAP_REDUCE}`]: VideoFileMultiNode,
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

        if (options.options.offlineTimeout) {
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

        this.connectToMqtt(options);
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
    getHostPipelines(node: string): Dictionary<AiXpandPipeline> {
        return this.pipelines[node];
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
            );

            return this.pipelines[node][id];
        }

        const isDataCaptureThread = Reflect.hasMetadata('data-capture-thread', dataSource.constructor)
            ? Reflect.getMetadata('data-capture-thread', dataSource.constructor)
            : false;
        if (isDataCaptureThread) {
            if (!this.pipelines[node][`${dataSource.id}`]) {
                this.pipelines[node][`${dataSource.id}`] = new AiXpandPipeline(dataSource, node);
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
                    new MetaStream(dataSource.getDataCaptureThread().id),
                    this.initiator,
                ),
                node,
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
    private connectToMqtt(options) {
        this.mqttClient = mqtt.connect(`${options.mqtt.protocol}://${options.mqtt.host}:${options.mqtt.port}`, {
            username: options.mqtt.username,
            password: options.mqtt.password,
            clean: options.mqtt.session.clean,
            clientId: options.mqtt.session.clientId,
        });

        this.mqttClient.on('connect', () => {
            this.emit(AiXpandClientEvent.AIXP_CLIENT_CONNECTED, {
                upstream: `${options.mqtt.protocol}://${options.mqtt.host}:${options.mqtt.port}`,
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
     * @private
     */
    private makeStreams() {
        const mainStream = fromEvent(this.mqttClient, 'message')
            .pipe(
                map((message) => {
                    // parse JSON
                    return JSON.parse(message[2].payload.toString('utf-8').replace(/\bNaN\b/g, 'null'));
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
                map((message): AiXPMessage<any> => {
                    // transform message to AiXPMessage
                    return plainToInstance(
                        AiXPMessage,
                        transformer(message, this.registeredPlugins, this.registeredDCTs),
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

    private heartbeatProcessor(message: AiXPMessage<AiXPHeartbeatData>) {
        this.initializeValuesForHost(message.sender.host);

        this.markAsSeen(message.sender.host, this.options.offlineTimeout);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        Object.keys(message.data.ee.dataCaptureThreads).forEach((streamId) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
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
                this.pipelines[message.sender.host][`${streamId}`] = new AiXpandPipeline(dct, message.sender.host);
            } else {
                this.pipelines[message.sender.host][`${streamId}`].getDataCaptureThread().update(dct);
            }
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        message.data.ee.activePlugins.forEach((plugin: AiXpandPluginInstance<any>) => {
            if (!this.pipelines[message.sender.host][`${plugin.getStreamId()}`]) {
                console.log(`Attempted to attach plugin on non-existing stream: ${plugin.getStreamId()}`);
                return;
            }

            this.pipelines[message.sender.host][`${plugin.getStreamId()}`].attachPluginInstance(plugin);
        });

        this.emit(AiXpandClientEvent.AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE, {
            executionEngine: message.sender.host,
        });
    }

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

        this.emit(
            signature,
            <AiXpandClientEventContext>{
                path: message.path,
                pipeline: this.pipelines[message.path[0]][message.path[1]],
                instance: this.pipelines[message.path[0]][message.path[1]]?.getPluginInstance(message.path[3]),
                metadata: message.metadata,
                sender: message.sender,
                time: message.time,
            },
            null, // error object
            payload,
        );
    }

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

                    this.emit(
                        instance.signature,
                        <AiXpandClientEventContext>{
                            path: message.path,
                            pipeline: this.pipelines[message.path[0]][message.path[1]],
                            instance: this.pipelines[message.path[0]][message.path[1]].getPluginInstance(
                                message.path[3],
                            ),
                            metadata: message.metadata,
                            sender: message.sender,
                            time: message.time,
                        },
                        message,
                        null,
                    );
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

    private bufferMessage(message: AiXPMessage<AiXPPayloadData | AiXPNotificationData>) {
        if (this.bufferMessages) {
            this.bufferService.store(message);
        }
    }

    private markAsSeen(engine: string, timeout: number) {
        if (this.timeoutCallbacks[engine]?.timer) {
            clearTimeout(this.timeoutCallbacks[engine].timer);
        }

        this.timeoutCallbacks[engine] = {
            timer: setTimeout(() => {
                this.emit(AiXpandClientEvent.AIXP_ENGINE_OFFLINE, {
                    executionEngine: engine
                });
            }, timeout * 1000),
            timeout: timeout,
        }
    }
}
