export enum AiXpandClientEvent {
    AIXP_CLIENT_CONNECTED = 'AIXPCCONNSUCCESS',
    AIXP_CLIENT_DISCONNECTED = 'AIXPCDISCONN',
    AIXP_CLIENT_CONNECTION_ERROR = 'AIXPCCONNERR',
    AIXP_CLIENT_SYS_TOPIC_SUBSCRIBE = 'AIXPCSTS',
    AIXP_CLIENT_FLEET_CONNECTED = 'AIXPFLCONN',
    AIXP_CLIENT_BOOTED = 'AIXPBOOT',
    AIXP_EXCEPTION = 'AIXPEX',
    AIXP_VERBOSE_DEBUG = 'AIXPVDB',
    AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE = 'AIXPCONEE',
    AIXP_ENGINE_OFFLINE = 'AIXPEEOFF',
}
