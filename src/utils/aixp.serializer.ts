import 'reflect-metadata';
import { REST_CUSTOM_EXEC_SIGNATURE } from '../abstract.rest.custom.exec.plugin';
import { AiXpandDecoratorOptions } from '../decorators';

export const serialize = <T>(
    instance: T,
    signature = null,
    tags: Map<string, string> = new Map<string, string>(),
): any => {
    if (
        !(
            Reflect.hasMetadata('plugin-instance', instance.constructor) ||
            Reflect.hasMetadata('plugin-instance-part', instance.constructor) ||
            Reflect.hasMetadata('data-capture-thread-config', instance.constructor)
        )
    ) {
        console.log('Only Plugin Instances, Embedded Configs or Data Capture Threads can be serialized.');
        return;
    }

    const serializedObject: any = {};
    const isDataCaptureThread = Reflect.getMetadata('data-capture-thread-config', instance.constructor);
    const isPluginInstance = Reflect.getMetadata('plugin-instance', instance.constructor);
    if (isPluginInstance) {
        signature = Reflect.getMetadata('signature', instance.constructor);

        if (Reflect.hasMetadata('is-rest-custom-exec', instance.constructor)) {
            tags.set('CUSTOM_SIGNATURE', signature);
        }

        if (tags.size) {
            serializedObject['ID_TAGS'] = {};
            tags.forEach((value, key) => {
                serializedObject['ID_TAGS'][`${key}`] = value;
            });
        }
    } else if (!isDataCaptureThread) {
        const partSignatures = Reflect.getMetadata('signatures', instance.constructor);
        if (!partSignatures.includes(signature) && !partSignatures.includes(REST_CUSTOM_EXEC_SIGNATURE)) {
            console.log(
                `Cannot serialize "${signature}"; Found EmbeddedConfig without "${signature}" registered signature.`,
            );
            return;
        }
    }

    const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: AiXpandDecoratorOptions }> =
        Reflect.getMetadata('embeddedProperties', instance.constructor) || new Map();
    const propertyMappings: Map<string, { propertyName: string; options: AiXpandDecoratorOptions }> =
        Reflect.getMetadata('propertyMappings', instance.constructor) || new Map();

    propertyMappings.forEach((property, key) => {
        if (instance.hasOwnProperty(key)) {
            if (!instance[key] && property.options.nullable) {
                return;
            }

            const embeddedConfig = embeddedProperties.get(key);
            if (embeddedConfig?.options.isArray) {
                serializedObject[property.propertyName] = instance[key].map((item: any) => serialize(item, signature));
            } else if (embeddedConfig) {
                serializedObject[property.propertyName] = serialize(instance[key], signature);
            } else {
                serializedObject[property.propertyName] = instance[key];
            }
        }
    });

    return serializedObject;
};
