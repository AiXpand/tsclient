import 'reflect-metadata';
import { AiXpandDecoratorOptions } from './aixpand.decorator.options';

const defaultOptions: AiXpandDecoratorOptions = {
    isArray: false,
    nullable: false,
};

export const reservedPropertyNames = ['ID_TAGS', 'LINKED_INSTANCES'];

export const Bind = (configPropertyName: string, options: AiXpandDecoratorOptions = {}): PropertyDecorator => {
    options = { ...defaultOptions, ...options };

    if (reservedPropertyNames.includes(configPropertyName)) {
        throw new Error(`"${configPropertyName}" is reserved and handled separately by the serializer.`);
    }

    return function (target: any, propertyKey: string | symbol) {
        const propertyMappings: Map<string, { propertyName: string; options: AiXpandDecoratorOptions }> =
            Reflect.getMetadata('propertyMappings', target.constructor) || new Map();
        propertyMappings.set(propertyKey.toString(), { propertyName: configPropertyName, options });
        Reflect.defineMetadata('propertyMappings', propertyMappings, target.constructor);
    };
};
