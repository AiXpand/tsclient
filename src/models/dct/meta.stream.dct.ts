import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';
import { convertKeysToAiXpFormat } from '../../utils/aixp.helper.functions';

@DataCaptureThreadConfig()
export class MetaStream {
    @Bind('COLLECTED_STREAMS')
    collectedStreams: string[] = [];

    @Bind('TYPE')
    type: string = DataCaptureThreadType.META_STREAM;

    @Bind('STREAM_CONFIG_METADATA', { nullable: true })
    metadata: any;

    static make(config: any) {
        const schema = MetaStream.getSchema();
        const instance = new MetaStream();

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
            name: 'Meta Stream',
            description: 'A DCT designed to consume other pipelines.',
            type: DataCaptureThreadType.META_STREAM,
            fields: [
                {
                    key: 'collectedStreams',
                    type: 'array(string)',
                    label: 'Collected Pipelines',
                    description: 'The pipelines to collect.',
                    default: [],
                    required: true,
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
