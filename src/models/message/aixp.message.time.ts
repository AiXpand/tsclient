import { IsDate, IsOptional } from 'class-validator';

export class AiXPMessageTime {
    @IsOptional()
    @IsDate()
    date?: Date;

    @IsOptional()
    timezone?: {
        utc: string | null;
        name: string | null;
    };
}
