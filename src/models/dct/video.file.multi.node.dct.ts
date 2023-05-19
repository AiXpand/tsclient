import { Bind, Embedable, Embedded, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@Embedable()
export class WorkerStreamConfigMetadata {
    @Bind('DELETE_PATH')
    deletePath = false;
}

@Embedable()
export class WorkerStreamConfig {
    @Bind('CAP_RESOLUTION')
    capResolution: number;

    @Bind('STREAM_WINDOW')
    streamWindow: number;

    @Embedded(WorkerStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    configMetadata: WorkerStreamConfigMetadata;

    constructor(capResolution = 100, streamWindow = 20) {
        this.capResolution = capResolution;
        this.streamWindow = streamWindow;
        this.configMetadata = new WorkerStreamConfigMetadata();
    }
}

@Embedable()
export class VideoFileMultiNodeStreamConfigMetadata {
    @Bind('NOTIFY_DOWNLOAD_DOWNSTREAM')
    notifyDownload: boolean;

    @Bind('USE_LOCAL_SYSTEM_TO_SAVE')
    saveLocal: boolean;

    @Bind('VIDEO_FILE_EXTENSION')
    fileExtension: string;

    @Bind('WORKERS')
    workers: string[];

    @Embedded(WorkerStreamConfig, 'WORKER_STREAM_CONFIG')
    workerConfig: WorkerStreamConfig;

    constructor(fileExtension, workers, saveLocal = false, notifyDownload = true) {
        this.saveLocal = saveLocal;
        this.notifyDownload = notifyDownload;
        this.fileExtension = fileExtension;
        this.workers = workers;
        this.workerConfig = new WorkerStreamConfig();
    }
}

@DataCaptureThreadConfig()
export class VideoFileMultiNode {
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

    @Bind('TYPE')
    type: string = DataCaptureThreadType.VIDEO_FILE_MAP_REDUCE;

    @Embedded(VideoFileMultiNodeStreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    streamConfigMetadata: VideoFileMultiNodeStreamConfigMetadata;

    constructor(url: string, extension: string, workers: string[]) {
        this.capResolution = 50;
        this.isDefault = true;
        this.url = url;
        this.isLive = false;
        this.reconnectable = 'KEEPALIVE';
        this.streamConfigMetadata = new VideoFileMultiNodeStreamConfigMetadata(extension, workers);
    }
}
