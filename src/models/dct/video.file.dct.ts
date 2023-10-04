import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';
import { convertKeysToAiXpFormat } from '../../utils/aixp.helper.functions';

@DataCaptureThreadConfig()
export class VideoFile {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('DEFAULT_PLUGIN', { nullable: true })
    defaultPlugin: boolean;

    @Bind('URL')
    url: string;

    @Bind('LIVE_FEED', { nullable: true })
    isLive: boolean;

    @Bind('RECONNECTABLE', { nullable: true })
    reconnectable: string;

    @Bind('STREAM_WINDOW', { nullable: true })
    streamWindow: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_FILE;

    @Bind('STREAM_CONFIG_METADATA', { nullable: true })
    metadata: any;

    static make(config: any) {
        const schema = VideoFile.getSchema();
        const instance = new VideoFile();

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
                    key: 'reconnectable',
                    type: 'string',
                    label: 'Reconnectable',
                    description:
                        'Describes the behavior when the feed disconnects. Allowed values are YES, NO and KEEPALIVE',
                    default: 'YES',
                    required: false,
                },
                {
                    key: 'streamWindow',
                    type: 'integer',
                    label: 'Stream Window',
                    description: '',
                    default: 1,
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
