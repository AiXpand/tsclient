import { describe, expect, test } from '@jest/globals';
import { PluginPayload } from './plugin.payload.decorator';

describe('Plugin Payload Decorator Tests', () => {
    test('@PluginPayload() basic config', () => {
        @PluginPayload('MOCK_SIGNATURE')
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isPluginInstancePayload = Reflect.getMetadata('plugin-instance-payload', mockObj.constructor);
        const pluginSignature = Reflect.getMetadata('signature', mockObj.constructor);

        expect(isPluginInstancePayload).toEqual(true);
        expect(pluginSignature).toEqual('MOCK_SIGNATURE');
    });
});
