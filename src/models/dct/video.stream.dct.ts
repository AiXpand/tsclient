import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@DataCaptureThreadConfig()
export class VideoStream {
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
    type: string = DataCaptureThreadType.VIDEO_STREAM;

    @Bind('_CUSTOM_METADATA', { nullable: true })
    metadata: string;

    static make(config: any) {
        const schema = VideoStream.getSchema();
        const instance = new VideoStream();

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

        return instance;
    }

    static getSchema() {
        return {
            name: 'Video Stream',
            description: 'A DCT designed to consume real-time video streams.',
            type: DataCaptureThreadType.VIDEO_STREAM,
            fields: [
                {
                    key: 'capResolution',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 20,
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
