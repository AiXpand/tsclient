import { AiXpandPluginInstance, AiXpandPipeline } from '../pipeline';
import { AiXPMessageSender, AiXPMessageTime } from '../message';

export type AiXPContextInfo = {
    id: string;
    type: string;
    category: string;
    version: string;
    demoMode: boolean;
};

export type AiXpandClientEventContext = {
    path: string[];
    pipeline: AiXpandPipeline;
    instance: AiXpandPluginInstance<any>;
    metadata: any;
    sender: AiXPMessageSender;
    time: AiXPMessageTime;
    info: AiXPContextInfo;
};
