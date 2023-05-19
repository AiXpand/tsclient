import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPMessageStats } from './aixp.message.stats';

export class AiXPMessageMetadata {
    @IsString()
    event: string;

    @ValidateNested()
    @Type(() => AiXPMessageStats)
    messages: AiXPMessageStats;
}
