import { AiXpandPluginInstance, AiXpandPipeline } from '../pipeline';
import { AiXPMessageSender, AiXPMessageTime } from '../message';

export type AiXpandClientEventContext = {
    path: string[];
    pipeline: AiXpandPipeline;
    instance: AiXpandPluginInstance<any>;
    metadata: any;
    sender: AiXPMessageSender;
    time: AiXPMessageTime;
};
