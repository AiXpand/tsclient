import { describe, expect, test } from '@jest/globals';
import { BindingOptions } from './binding.options';
import { Embedded } from './embedded.decorator';

describe('Embedded Decorator Tests', () => {
    class MockPart {}

    test('@Embedded() basic config', () => {
        class MockClass {
            @Embedded(MockPart, 'MOCK_PROP')
            mockProp: string;
        }

        const mockObj = new MockClass();

        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', mockObj.constructor) || new Map();
        const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: BindingOptions }> =
            Reflect.getMetadata('embeddedProperties', mockObj.constructor) || new Map();

        expect(propertyMappings.has('mockProp')).toEqual(true);
        expect(propertyMappings.get('mockProp')).toEqual({
            propertyName: 'MOCK_PROP',
            options: { isArray: false, nullable: false, alwaysSerialize: false },
        });
        expect(embeddedProperties.has('mockProp')).toEqual(true);
        expect(embeddedProperties.get('mockProp')).toEqual({
            embeddedType: MockPart,
            options: { isArray: false, nullable: false, alwaysSerialize: false },
        });
    });

    test('@Embedded() advanced config', () => {
        class MockClass {
            @Embedded(MockPart, 'MOCK_PROP', { nullable: true, isArray: true, alwaysSerialize: true })
            mockProp: string;
        }

        const mockObj = new MockClass();

        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', mockObj.constructor) || new Map();
        const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: BindingOptions }> =
            Reflect.getMetadata('embeddedProperties', mockObj.constructor) || new Map();

        expect(propertyMappings.has('mockProp')).toEqual(true);
        expect(propertyMappings.get('mockProp')).toEqual({
            propertyName: 'MOCK_PROP',
            options: { isArray: true, nullable: true, alwaysSerialize: true },
        });
        expect(embeddedProperties.has('mockProp')).toEqual(true);
        expect(embeddedProperties.get('mockProp')).toEqual({
            embeddedType: MockPart,
            options: { isArray: true, nullable: true, alwaysSerialize: true },
        });
    });
});
