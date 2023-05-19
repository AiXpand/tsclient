import { Bind, Embedded, Embedable, DataCaptureThreadConfig } from '../../decorators';
import { DataCaptureThreadType } from '../../aixpand.client';

@Embedable()
export class StreamConfigMetadata {}

@DataCaptureThreadConfig()
export class MetaStream {
    @Embedded(StreamConfigMetadata, 'STREAM_CONFIG_METADATA')
    streamConfigMetadata: StreamConfigMetadata;

    @Bind('COLLECTED_STREAMS')
    collectedStreams: string[] = [];

    @Bind('TYPE')
    type: string = DataCaptureThreadType.META_STREAM;

    constructor(collectedStreams: string[] | string) {
        if (!Array.isArray(collectedStreams)) {
            this.collectedStreams = [collectedStreams];
        } else {
            this.collectedStreams = collectedStreams;
        }
    }
}
