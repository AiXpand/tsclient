import { NetMon01 } from './models/admin.instances/net.mon.01';
import { UpdateMonitor01 } from './models/admin.instances/update.monitor.01';
import { MinioMonit01 } from './models/admin.instances/minio.monit.01';

export const ANY_PLUGIN_SIGNATURE = '*';

export const ADMIN_UPDATE_MONITOR_SIGNATURE = 'UPDATE_MONITOR_01';
export const ADMIN_NETWORK_MONITOR_SIGNATURE = 'NET_MON_01';
export const ADMIN_MINIO_MONITOR_SIGNATURE = 'MINIO_MONIT_01';

export const ADMIN_PLUGIN_SIGNATURES = [
    ADMIN_NETWORK_MONITOR_SIGNATURE,
    ADMIN_MINIO_MONITOR_SIGNATURE,
    ADMIN_UPDATE_MONITOR_SIGNATURE,
];

export const ADMIN_PLUGIN_CLASSES = {
    [`${ADMIN_NETWORK_MONITOR_SIGNATURE}`]: NetMon01,
    [`${ADMIN_UPDATE_MONITOR_SIGNATURE}`]: UpdateMonitor01,
    [`${ADMIN_MINIO_MONITOR_SIGNATURE}`]: MinioMonit01,
};
