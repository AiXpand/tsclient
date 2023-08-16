import { Bind, Embedable, Embedded, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@Embedable()
export class WorkerStreamConfigMetadata {
    @Bind('DELETE_PATH')
    deletePath = false;
}

@Embedable()
export class WorkerStreamConfig {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('STREAM_WINDOW')
    streamWindow: number;

    @Embedded(WorkerStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    configMetadata: WorkerStreamConfigMetadata;

    constructor(capResolution = 100, streamWindow = 20) {
        this.capResolution = capResolution;
        this.streamWindow = streamWindow;
        this.configMetadata = new WorkerStreamConfigMetadata();
    }
}

@Embedable()
export class VideoFileMultiNodeStreamConfigMetadata {
    @Bind('NOTIFY_DOWNLOAD_DOWNSTREAM')
    notifyDownload: boolean;

    @Bind('USE_LOCAL_SYSTEM_TO_SAVE')
    saveLocal: boolean;

    @Bind('VIDEO_FILE_EXTENSION')
    fileExtension: string;

    @Bind('WORKERS')
    workers: string[];

    @Embedded(WorkerStreamConfig, 'WORKER_STREAM_CONFIG')
    workerConfig: WorkerStreamConfig;

    constructor(fileExtension, workers, saveLocal = false, notifyDownload = true) {
        this.saveLocal = saveLocal;
        this.notifyDownload = notifyDownload;
        this.fileExtension = fileExtension;
        this.workers = workers;
        this.workerConfig = new WorkerStreamConfig();
    }
}

@DataCaptureThreadConfig()
export class VideoFileMultiNode {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('DEFAULT_PLUGIN')
    defaultPlugin: boolean;

    @Bind('URL')
    url: string;

    @Bind('LIVE_FEED')
    isLive: boolean;

    @Bind('RECONNECTABLE')
    reconnectable: boolean | string;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_FILE_MAP_REDUCE;

    @Embedded(VideoFileMultiNodeStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    streamConfigMetadata: VideoFileMultiNodeStreamConfigMetadata;

    @Bind('_CUSTOM_METADATA', { nullable: true })
    metadata: string;

    static make(config: any) {
        const schema = VideoFileMultiNode.getSchema();
        const instance = new VideoFileMultiNode();

        if (!IsObject(config)) {
            config = {};
        }

        schema.fields.forEach((field) => {
            const key = field.key;

            if (key !== 'metadata') {
                instance[`${key}`] = config[`${key}`] ?? field.default;
            } else {
                instance[`${key}`] = config[`${key}`] ? JSON.stringify(config[`${key}`]) : null;
            }

            if ((instance[`${key}`] === null || instance[`${key}`] === undefined) && !field.optional) {
                throw new Error(`Cannot properly instantiate DCT of type ${schema.type}: ${field.key} is missing.`);
            }
        });

        // TODO: implement instantiation of DCT parts
        instance.streamConfigMetadata = new VideoFileMultiNodeStreamConfigMetadata(config.extension, config.workers);

        return instance;
    }

    static getSchema() {
        return {
            name: 'Video File (Multi Worker)',
            description: 'A DCT that enables consuming video files in a multi-worker strategy.',
            type: DataCaptureThreadType.VIDEO_FILE_MAP_REDUCE,
            fields: [
                {
                    key: 'capResolution',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 50,
                    optional: false,
                },
                {
                    key: 'defaultPlugin',
                    type: 'boolean',
                    label: 'Default Plugin',
                    description: '',
                    default: false,
                    optional: false,
                },
                {
                    key: 'url',
                    type: 'string',
                    label: 'URL',
                    description: 'The URL of the video stream source.',
                    default: null,
                    optional: false,
                },
                {
                    key: 'isLive',
                    type: 'boolean',
                    label: 'Is Live Feed',
                    description: 'Flag to signal that the URL provided is of a live feed.',
                    default: true,
                    optional: false,
                },
                {
                    key: 'reconnectable',
                    type: ['boolean', 'string'],
                    label: 'Reconnectable',
                    description:
                        'Describes the behavior when the feed disconnects. Allowed values are true, false and KEEPALIVE',
                    default: 'KEEPALIVE',
                    optional: false,
                },
                {
                    key: 'metadata',
                    type: 'string',
                    label: 'Metadata',
                    description: 'Key-value pairs to be encoded as JSON and attached to the DCT.',
                    default: null,
                    optional: true,
                },
            ],
        };
    }
}
