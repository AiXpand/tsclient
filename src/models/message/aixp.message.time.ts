import { IsDate, IsOptional } from 'class-validator';

export class AiXPMessageTime {
    @IsOptional()
    @IsDate()
    device?: Date;

    @IsOptional()
    @IsDate()
    host?: Date;

    @IsOptional()
    @IsDate()
    internet?: Date;

    @IsOptional()
    timezone?: {
        utc: string | null;
        name: string | null;
    };
}
