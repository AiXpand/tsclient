import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@DataCaptureThreadConfig()
export class Void {
    @Bind('TYPE')
    type: string = DataCaptureThreadType.VOID_STREAM;

    @Bind('_CUSTOM_METADATA', { nullable: true })
    metadata: string;

    static make(config: any = {}) {
        const schema = Void.getSchema();
        const instance = new Void();

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
            name: 'Void',
            description: 'A DCT to be used when no acquisition is necessary.',
            type: DataCaptureThreadType.VOID_STREAM,
            fields: [
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
