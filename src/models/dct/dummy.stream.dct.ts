import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@DataCaptureThreadConfig()
export class DummyStream {
    @Bind('CAP_RESOLUTION')
    fps: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.DUMMY_STREAM;

    constructor() {
        this.fps = 1;
    }
}
