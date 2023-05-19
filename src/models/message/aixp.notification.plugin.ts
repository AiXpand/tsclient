import { IsString } from 'class-validator';

export class AiXPNotificationPlugin {
    @IsString()
    instance: string;

    @IsString()
    signature: string;
}
