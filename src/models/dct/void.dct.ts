import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@DataCaptureThreadConfig()
export class Void {
    @Bind('TYPE')
    type: string = DataCaptureThreadType.VOID_STREAM;
}
