import { Bind, Embedable, Embedded, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@Embedable()
export class VideoFileStreamConfigMetadata {
    @Bind('NOTIFY_DOWNLOAD_DOWNSTREAM')
    notifyDownload: boolean;

    constructor(notifyDownload = true) {
        this.notifyDownload = notifyDownload;
    }
}

@DataCaptureThreadConfig()
export class VideoFile {
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

    @Bind('STREAM_WINDOW')
    streamWindow: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_FILE;

    @Embedded(VideoFileStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    streamConfigMetadata: VideoFileStreamConfigMetadata;

    static make(config: any) {
        const schema = VideoFile.getSchema();
        const instance = new VideoFile();

        if (!IsObject(config)) {
            config = {};
        }

        schema.fields.forEach((field) => {
            this[field.key] = field.default;
            if (config[field.key]) {
                // TODO: validate data type
                instance[field.key] = config[field.key];
            }

            if (!instance[field.key] && !field.optional) {
                throw new Error(`Cannot properly instantiate DCT of type ${schema.type}: ${field.key} is missing.`);
            }
        });

        instance.streamConfigMetadata = new VideoFileStreamConfigMetadata();

        return instance;
    }

    static getSchema() {
        return {
            name: 'Video File',
            description: 'A DCT dedicated to consuming video files accessible at an URL.',
            type: DataCaptureThreadType.VIDEO_FILE,
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
                    description: 'Describes the behavior when the feed disconnects. Allowed values are true, false and KEEPALIVE',
                    default: 'KEEPALIVE',
                    optional: false,
                },
                {
                    key: 'streamWindow',
                    type: 'integer',
                    label: 'Stream Window',
                    description: '',
                    default: 1,
                    optional: false,
                },
            ],
        };
    }
}
