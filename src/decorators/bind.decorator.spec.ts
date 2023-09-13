import { describe, expect, test } from '@jest/globals';
import { Bind } from './bind.decorator';
import { BindingOptions } from './binding.options';

describe('Bind Decorator Tests', () => {
    test('@Bind() basic config', () => {
        class MockClass {
            @Bind('MOCK_PROP')
            mockProp: string;
        }

        const mockObj = new MockClass();

        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', mockObj.constructor) || new Map();

        expect(propertyMappings.has('mockProp')).toEqual(true);
        expect(propertyMappings.get('mockProp')).toEqual({
            propertyName: 'MOCK_PROP',
            options: { isArray: false, nullable: false, alwaysSerialize: false },
        });
    });

    test('@Bind() advanced config', () => {
        class MockClass {
            @Bind('MOCK_PROP', { nullable: true, isArray: true, alwaysSerialize: true })
            mockProp: string;
        }

        const mockObj = new MockClass();

        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', mockObj.constructor) || new Map();

        expect(propertyMappings.has('mockProp')).toEqual(true);
        expect(propertyMappings.get('mockProp')).toEqual({
            propertyName: 'MOCK_PROP',
            options: { isArray: true, nullable: true, alwaysSerialize: true },
        });
    });
});
