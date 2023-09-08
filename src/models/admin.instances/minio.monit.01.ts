import { AiXpandPlugin } from '../pipeline';
import { Bind, PluginInstance } from '../../decorators';
import { ADMIN_MINIO_MONITOR_SIGNATURE } from '../../constants';

@PluginInstance(ADMIN_MINIO_MONITOR_SIGNATURE)
export class MinioMonit01 extends AiXpandPlugin {
    @Bind('MINIO_ACCESS_KEY')
    minioAccessKey: number;

    @Bind('MINIO_HOST')
    minioHost: string;

    @Bind('MINIO_SECURE')
    minioSecure: string;
}
