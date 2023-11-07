import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPData } from './aixp.data';
import { AiXPNotificationContext } from './aixp.notification.context';

export class AiXPNotificationData extends AiXPData {
    @IsString()
    module: string;

    @IsString()
    version: string;

    @IsString()
    type: string;

    @IsNumber()
    @IsOptional()
    code: number | null;

    @IsString()
    @IsOptional()
    tag: string | null;

    @IsString()
    notification: string;

    @ValidateNested()
    @Type(() => AiXPNotificationContext)
    context: AiXPNotificationContext;

    @IsString()
    @IsOptional()
    trace: string;
}
