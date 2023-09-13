import { describe, expect, test } from '@jest/globals';
import { PluginInstance, PluginInstanceOptions } from './plugin.instance.decorator';

describe('Plugin Instance Decorator Tests', () => {
    test('@PluginInstance() basic config', () => {
        @PluginInstance('MOCK_SIGNATURE')
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isPluginInstance = Reflect.getMetadata('plugin-instance', mockObj.constructor);
        const pluginSignature = Reflect.getMetadata('signature', mockObj.constructor);
        const options = <PluginInstanceOptions>Reflect.getMetadata('plugin-instance-options', mockObj.constructor);

        expect(isPluginInstance).toEqual(true);
        expect(pluginSignature).toEqual('MOCK_SIGNATURE');
        expect(options).toEqual({ linkable: false });
    });

    test('@PluginInstance() linked instance config', () => {
        @PluginInstance('MOCK_SIGNATURE', { linkable: true })
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isPluginInstance = Reflect.getMetadata('plugin-instance', mockObj.constructor);
        const pluginSignature = Reflect.getMetadata('signature', mockObj.constructor);
        const options = <PluginInstanceOptions>Reflect.getMetadata('plugin-instance-options', mockObj.constructor);

        expect(isPluginInstance).toEqual(true);
        expect(pluginSignature).toEqual('MOCK_SIGNATURE');
        expect(options).toEqual({ linkable: true });
    });
});
