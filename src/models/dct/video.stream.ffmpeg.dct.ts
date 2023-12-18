import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';
import { convertKeysToAiXpFormat } from '../../utils/aixp.helper.functions';

@DataCaptureThreadConfig()
export class VideoStreamFFMPEG {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('DEFAULT_PLUGIN', { nullable: true })
    defaultPlugin: boolean;

    @Bind('URL')
    url: string;

    @Bind('LIVE_FEED', { nullable: true })
    isLive: boolean;

    @Bind('MAX_NULL_READS', { nullable: true })
    maxNullReads: number;

    @Bind('STATS_PERIOD', { nullable: true })
    statsPeriod: number;

    @Bind('MAX_RETRIES', { nullable: true })
    maxRetries: number;

    @Bind('FRAME_H', { nullable: true })
    frameH: number;

    @Bind('FRAME_W', { nullable: true })
    frameW: number;

    @Bind('RECONNECTABLE', { nullable: true })
    reconnectable: string;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_STREAM_FFMPEG;

    @Bind('STREAM_CONFIG_METADATA', { nullable: true })
    metadata: any;

    static make(config: any) {
        const schema = VideoStreamFFMPEG.getSchema();
        const instance = new VideoStreamFFMPEG();

        if (!IsObject(config)) {
            config = {};
        }

        schema.fields.forEach((field) => {
            const key = field.key;

            if (key !== 'metadata') {
                instance[`${key}`] = config[`${key}`] ?? field.default;
            } else {
                instance[`${key}`] = config[`${key}`] ? convertKeysToAiXpFormat(config[`${key}`]) : null;
            }

            if ((instance[`${key}`] === null || instance[`${key}`] === undefined) && field.required) {
                throw new Error(`Cannot properly instantiate DCT of type ${schema.type}: ${field.key} is missing.`);
            }
        });

        return instance;
    }

    static getSchema() {
        return {
            name: 'Video Stream via FFMPEG',
            description: 'A DCT designed to consume real-time video streams with FFMPEG under the hood.',
            type: DataCaptureThreadType.VIDEO_STREAM_FFMPEG,
            fields: [
                {
                    key: 'capResolution',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 100,
                    required: true,
                },
                {
                    key: 'defaultPlugin',
                    type: 'boolean',
                    label: 'Default Plugin',
                    description: '',
                    default: false,
                    required: false,
                },
                {
                    key: 'url',
                    type: 'string',
                    label: 'URL',
                    description: 'The URL of the video stream source.',
                    default: null,
                    required: true,
                },
                {
                    key: 'isLive',
                    type: 'boolean',
                    label: 'Is Live Feed',
                    description: 'Flag to signal that the URL provided is of a live feed.',
                    default: true,
                    required: false,
                },
                {
                    key: 'maxNullReads',
                    type: 'number',
                    label: 'Max Null Reads',
                    description: 'Max Null Reads.',
                    default: 1000,
                    required: false,
                },
                {
                    key: 'statsPeriod',
                    type: 'number',
                    label: 'Stats Period',
                    description: 'Stats period.',
                    default: 2,
                    required: false,
                },
                {
                    key: 'maxRetries',
                    type: 'number',
                    label: 'Max Retries',
                    description: 'Max Retries.',
                    default: 2,
                    required: false,
                },
                {
                    key: 'frameH',
                    type: 'number',
                    label: 'Frame Height',
                    description: 'Frame Height.',
                    default: 1080,
                    required: false,
                },
                {
                    key: 'frameW',
                    type: 'number',
                    label: 'Frame Width',
                    description: 'Frame Width.',
                    default: 1920,
                    required: false,
                },
                {
                    key: 'reconnectable',
                    type: 'string',
                    label: 'Reconnectable',
                    description:
                        'Describes the behavior when the feed disconnects. Allowed values are YES, NO and KEEPALIVE',
                    default: 'YES',
                    required: false,
                },
                {
                    key: 'metadata',
                    type: 'string',
                    label: 'Metadata',
                    description: 'Key-value pairs to be encoded as JSON and attached to the DCT.',
                    default: null,
                    required: false,
                },
            ],
        };
    }
}
