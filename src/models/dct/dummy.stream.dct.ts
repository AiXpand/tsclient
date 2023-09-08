import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@DataCaptureThreadConfig()
export class DummyStream {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.DUMMY_STREAM;

    @Bind('_CUSTOM_METADATA', { nullable: true })
    metadata: string;

    static make(config: any = {}) {
        const schema = DummyStream.getSchema();
        const instance = new DummyStream();

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

            if ((instance[`${key}`] === null || instance[`${key}`] === undefined) && field.required) {
                throw new Error(`Cannot properly instantiate DCT of type ${schema.type}: ${field.key} is missing.`);
            }
        });

        return instance;
    }

    static getSchema() {
        return {
            name: 'Dummy Stream',
            description: 'A dummy acquisition stream.',
            type: DataCaptureThreadType.DUMMY_STREAM,
            fields: [
                {
                    key: 'capResolution',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 1,
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
