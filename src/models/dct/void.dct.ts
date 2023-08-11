import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@DataCaptureThreadConfig()
export class Void {
    @Bind('TYPE')
    type: string = DataCaptureThreadType.VOID_STREAM;

    static make() {
        return new Void();
    }

    static getSchema() {
        return {
            name: 'Void',
            description: 'A DCT to be used when no acquisition is necessary.',
            type: DataCaptureThreadType.VOID_STREAM,
            fields: [],
        };
    }
}
