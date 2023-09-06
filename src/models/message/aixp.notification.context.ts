import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AiXPNotificationContext {
    @IsString()
    @IsOptional()
    timestamp?: string | null;

    @IsString()
    @IsOptional()
    initiator?: string | null;

    @IsString()
    @IsOptional()
    session?: string | null;

    @IsString()
    @IsOptional()
    stream?: string | null;

    @IsString()
    @IsOptional()
    instance?: string | null;

    @IsString()
    @IsOptional()
    signature?: string | null;

    @IsBoolean()
    @IsOptional()
    displayed?: boolean;
}
