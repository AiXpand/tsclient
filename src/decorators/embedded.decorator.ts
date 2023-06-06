import 'reflect-metadata';
import { AiXpandDecoratorOptions } from './aixpand.decorator.options';
import { reservedPropertyNames } from './bind.decorator';

const defaultOptions: AiXpandDecoratorOptions = {
    isArray: false,
    nullable: false,
};

export const Embedded = (
    type: { new (...any): any },
    propertyName: string = null,
    options: AiXpandDecoratorOptions = {},
): PropertyDecorator => {
    if (reservedPropertyNames.includes(propertyName)) {
        throw new Error(`"${propertyName}" is reserved and handled separately by the serializer.`);
    }

    options = { ...defaultOptions, ...options };

    return function (target: any, propertyKey?: string | symbol) {
        const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: AiXpandDecoratorOptions }> =
            Reflect.getMetadata('embeddedProperties', target.constructor) || new Map();
        embeddedProperties.set(propertyKey.toString(), { embeddedType: type, options });
        Reflect.defineMetadata('embeddedProperties', embeddedProperties, target.constructor);

        const propertyMappings: Map<string, { propertyName: string; options: AiXpandDecoratorOptions }> =
            Reflect.getMetadata('propertyMappings', target.constructor) || new Map();
        propertyMappings.set(propertyKey.toString(), { propertyName, options });
        Reflect.defineMetadata('propertyMappings', propertyMappings, target.constructor);
    };
};
