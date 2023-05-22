import { AiXPMessage, AiXPNotificationData, AiXPPayloadData, Dictionary } from './models';
import { BufferServiceInterface } from './models/buffer.service.interface';

export class AiXpandMemoryBufferService implements BufferServiceInterface {
    private messages: Dictionary<AiXPMessage<AiXPPayloadData | AiXPNotificationData>[]> = {};

    store(message: AiXPMessage<AiXPPayloadData | AiXPNotificationData>) {
        if (!this.messages[message.sender.host]) {
            this.messages[message.sender.host] = [];
        }

        this.messages[message.sender.host].push(message);
    }

    get(node: string): AiXPMessage<AiXPPayloadData | AiXPNotificationData> | null {
        if (!this.messages[node] || this.messages[node].length == 0) {
            return null;
        }

        return this.messages[node].shift();
    }

    nodeHasMessages(node: string): boolean {
        return !(!this.messages[node] || this.messages[node].length === 0);
    }
}
