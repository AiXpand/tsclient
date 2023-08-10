import { Bind, Embedable, Embedded, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@Embedable()
export class VideoFileStreamConfigMetadata {
    @Bind('NOTIFY_DOWNLOAD_DOWNSTREAM')
    notifyDownload: boolean;

    constructor(notifyDownload = true) {
        this.notifyDownload = notifyDownload;
    }
}

@DataCaptureThreadConfig()
export class VideoFile {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('DEFAULT_PLUGIN')
    isDefault: boolean;

    @Bind('URL')
    url: string;

    @Bind('LIVE_FEED')
    isLive: boolean;

    @Bind('RECONNECTABLE')
    reconnectable: boolean | string;

    @Bind('STREAM_WINDOW')
    streamWindow: number;

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_FILE;

    @Embedded(VideoFileStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    streamConfigMetadata: VideoFileStreamConfigMetadata;

    constructor(url: string) {
        this.capResolution = 50;
        this.isDefault = false;
        this.url = url;
        this.isLive = false;
        this.reconnectable = 'KEEPALIVE';
        this.streamWindow = 1;
        this.streamConfigMetadata = new VideoFileStreamConfigMetadata();
    }
}
