import 'reflect-metadata';
import { AiXpandDecoratorOptions } from '../decorators';

export const deserialize = <T>(object: any, targetType: { new (): T }): T => {
    const instance = new targetType();

    const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: AiXpandDecoratorOptions }> =
        Reflect.getMetadata('embeddedProperties', targetType) || new Map();
    const propertyMappings: Map<string, { propertyName: string; options: AiXpandDecoratorOptions }> =
        Reflect.getMetadata('propertyMappings', targetType) || new Map();

    propertyMappings.forEach((property, key) => {
        if (object.hasOwnProperty(property.propertyName)) {
            const embeddedConfig = embeddedProperties.get(key);
            if (embeddedConfig?.options.isArray) {
                const embeddedType = embeddedConfig.embeddedType;
                instance[key] = object[property.propertyName].map((item: any) => deserialize(item, embeddedType));
            } else if (embeddedConfig) {
                const embeddedType = embeddedConfig.embeddedType;
                instance[key] = deserialize(object[property.propertyName], embeddedType);
            } else {
                instance[key] = object[property.propertyName];
            }
        }
    });

    return instance;
};
