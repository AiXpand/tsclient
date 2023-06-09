import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPMessageSender } from './aixp.message.sender';
import { AiXPMessageTime } from './aixp.message.time';
import { AiXPMessageMetadata } from './aixp.message.metadata';

export class AiXPMessage<T> {
    @IsNotEmpty()
    path: string[];

    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsNotEmpty()
    @IsString()
    version: string;

    @ValidateNested()
    @Type(() => AiXPMessageSender)
    sender: AiXPMessageSender;

    @ValidateNested()
    @Type(() => AiXPMessageTime)
    time: AiXPMessageTime;

    @IsBoolean()
    demoMode: boolean;

    @IsString()
    @IsOptional()
    format: string;

    @ValidateNested()
    @Type(() => AiXPMessageMetadata)
    metadata: AiXPMessageMetadata;

    @ValidateNested()
    data: T;
}
