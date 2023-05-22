import { AiXPMessage, AiXPNotificationData, AiXPPayloadData } from './message';

/**
 * This is the blueprint for any service providing temporary storage for AiXpand messages.
 */
export abstract class BufferServiceInterface {
    abstract store(message: AiXPMessage<AiXPPayloadData | AiXPNotificationData>);
    abstract get(node: string): AiXPMessage<AiXPPayloadData | AiXPNotificationData> | null;
    abstract nodeHasMessages(node: string): boolean;
}
