import { IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPMessageTime } from './aixp.message.time';
import { AiXPMessageMetadata } from './aixp.message.metadata';

export class AiXPMessageHost {
    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    sender: string;

    @IsNotEmpty()
    @IsNumber()
    totalMessages: number;

    @IsNotEmpty()
    @IsString()
    version: string;
}

export class AiXPMessage<T> {
    @IsNotEmpty()
    id: string;

    @ValidateNested()
    @Type(() => AiXPMessageHost)
    host: AiXPMessageHost;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    path: string[];

    @ValidateNested()
    @Type(() => AiXPMessageTime)
    time: AiXPMessageTime;

    @ValidateNested()
    @Type(() => AiXPMessageMetadata)
    metadata: AiXPMessageMetadata;

    @ValidateNested()
    data: T;
}
