/**
 * The definition of the expected MQTT configuration options.
 */
export interface MqttOptions {
    protocol: string;
    host: string;
    port: number;
    username: string;
    password: string;
    session: {
        clean: boolean;
        clientId: string;
    };
}
