import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';

@DataCaptureThreadConfig()
export class DummyStream {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.DUMMY_STREAM;

    static make(config: any = {}) {
        const schema = DummyStream.getSchema();
        const instance = new DummyStream();

        if (!IsObject(config)) {
            config = {};
        }

        schema.fields.forEach((field) => {
            instance[field.key] = field.default;
            if (config[field.key]) {
                // TODO: validate data type
                instance[field.key] = config[field.key];
            }

            if (!instance[field.key] && !field.optional) {
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
                    optional: false,
                },
            ],
        }
    }
}
