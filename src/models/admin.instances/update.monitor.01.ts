import { AiXpandPlugin } from '../pipeline';
import { Bind, PluginInstance } from '../../decorators';
import { ADMIN_UPDATE_MONITOR_SIGNATURE } from '../../constants';

@PluginInstance(ADMIN_UPDATE_MONITOR_SIGNATURE)
export class UpdateMonitor01  extends AiXpandPlugin {
    @Bind('PROCESS_DELAY')
    processDelay: number;

    @Bind('VERSION_TOKEN')
    versionToken: string;

    @Bind('VERSION_URL')
    versionUrl: string;
}
