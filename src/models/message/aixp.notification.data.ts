import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPData } from './aixp.data';
import { AiXPNotificationContext } from './aixp.notification.context';
import { AiXPNotificationPlugin } from './aixp.notification.plugin';

export class AiXPNotificationData extends AiXPData {
    @IsString()
    module: string;

    @IsString()
    version: string;

    @IsString()
    type: string;

    @IsString()
    notification: string;

    @ValidateNested()
    @Type(() => AiXPNotificationContext)
    context: AiXPNotificationContext;

    @ValidateNested()
    @Type(() => AiXPNotificationPlugin)
    plugin: AiXPNotificationPlugin | null;
}
