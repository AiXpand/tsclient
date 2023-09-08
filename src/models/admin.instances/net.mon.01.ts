import { AiXpandPlugin } from '../pipeline';
import { Bind, PluginInstance } from '../../decorators';
import { ADMIN_NETWORK_MONITOR_SIGNATURE } from '../../constants';

@PluginInstance(ADMIN_NETWORK_MONITOR_SIGNATURE)
export class NetMon01 extends AiXpandPlugin {
    @Bind('SUPERVISOR')
    supervisor: boolean;

    @Bind('PROCESS_DELAY')
    processDelay: string;
}
