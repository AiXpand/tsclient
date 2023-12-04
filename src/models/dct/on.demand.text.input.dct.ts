import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';
import { IsObject } from 'class-validator';
import { convertKeysToAiXpFormat } from '../../utils/aixp.helper.functions';

@DataCaptureThreadConfig()
export class OnDemandTextInput {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.ON_DEMAND_TEXT_INPUT;

    @Bind('STREAM_CONFIG_METADATA', { nullable: true })
    metadata: any;

    static make(config: any = {}) {
        const schema = OnDemandTextInput.getSchema();
        const instance = new OnDemandTextInput();

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
            name: 'On Demand Text Input',
            description: 'A DCT designed to wrap on-demand text input models.',
            type: DataCaptureThreadType.ON_DEMAND_TEXT_INPUT,
            fields: [
                {
                    key: 'capResolution',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 20,
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
