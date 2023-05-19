import { Bind, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@DataCaptureThreadConfig()
export class VideoStream {
    @Bind('CAP_RESOLUTION')
    fps: number;

    @Bind('DEFAULT_PLUGIN')
    isDefault: boolean;

    @Bind('URL')
    url: string;

    @Bind('LIVE_FEED')
    isLive: boolean;

    @Bind('RECONNECTABLE')
    reconnectable: boolean | string;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_STREAM;

    constructor(url: string, isLive = true) {
        this.fps = 25;
        this.isDefault = true;
        this.url = url;
        this.isLive = isLive;
        this.reconnectable = 'YES';
    }
}
