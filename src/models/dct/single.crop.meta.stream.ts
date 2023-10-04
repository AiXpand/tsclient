import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';
import { convertKeysToAiXpFormat } from '../../utils/aixp.helper.functions';

@DataCaptureThreadConfig()
export class SingleCropMetaStream {
    @Bind('COLLECTED_STREAMS')
    collectedStreams: string[] = [];

    @Bind('CROP_BOTTOM')
    cropBottom: number;

    @Bind('CROP_LEFT')
    cropLeft: number;

    @Bind('CROP_RIGHT')
    cropRight: number;

    @Bind('CROP_TOP')
    cropTop: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.SINGLE_CROP_META_STREAM;

    @Bind('STREAM_CONFIG_METADATA', { nullable: true })
    metadata: any;

    static make(config: any) {
        const schema = SingleCropMetaStream.getSchema();
        const instance = new SingleCropMetaStream();

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
            name: 'Single Crop Meta Stream',
            description: 'A DCT designed to consume a crop of other video streams.',
            type: DataCaptureThreadType.SINGLE_CROP_META_STREAM,
            fields: [
                {
                    key: 'collectedStreams',
                    type: 'array(string)',
                    label: 'Collected Pipelines',
                    description: 'The pipelines to collect.',
                    default: null,
                    required: true,
                },
                {
                    key: 'cropBottom',
                    type: 'integer',
                    label: 'Crop Bottom',
                    description: 'Bottom coordinate when cropping the original stream.',
                    default: null,
                    required: true,
                },
                {
                    key: 'cropLeft',
                    type: 'integer',
                    label: 'Crop Left',
                    description: 'Left coordinate when cropping the original stream.',
                    default: null,
                    required: true,
                },
                {
                    key: 'cropRight',
                    type: 'integer',
                    label: 'Crop Right',
                    description: 'Right coordinate when cropping the original stream.',
                    default: null,
                    required: true,
                },
                {
                    key: 'cropTop',
                    type: 'integer',
                    label: 'Crop Top',
                    description: 'Top coordinate when cropping the original stream.',
                    default: null,
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
