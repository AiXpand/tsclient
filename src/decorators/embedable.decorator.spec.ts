import { describe, expect, test } from '@jest/globals';
import { Embedable } from './embedable.decorator';

describe('Embedable Decorator Tests', () => {
    test('@Embedable() single signature string as argument', () => {
        @Embedable('MOCK_SIGNATURE')
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const partSignatures = Reflect.getMetadata('signatures', mockObj.constructor);
        const isPluginInstancePart = Reflect.hasMetadata('plugin-instance-part', mockObj.constructor);
        const isPluginInstancePayloadPart = Reflect.hasMetadata('plugin-instance-payload-part', mockObj.constructor);

        expect(partSignatures).toEqual(['MOCK_SIGNATURE']);
        expect(isPluginInstancePart).toEqual(true);
        expect(isPluginInstancePayloadPart).toEqual(true);
    });

    test('@Embedable() multiple signature strings as argument', () => {
        @Embedable(['MOCK_SIGNATURE_1', 'MOCK_SIGNATURE_2'])
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const partSignatures = Reflect.getMetadata('signatures', mockObj.constructor);
        const isPluginInstancePart = Reflect.hasMetadata('plugin-instance-part', mockObj.constructor);
        const isPluginInstancePayloadPart = Reflect.hasMetadata('plugin-instance-payload-part', mockObj.constructor);

        expect(partSignatures).toEqual(['MOCK_SIGNATURE_1', 'MOCK_SIGNATURE_2']);
        expect(isPluginInstancePart).toEqual(true);
        expect(isPluginInstancePayloadPart).toEqual(true);
    });
});
