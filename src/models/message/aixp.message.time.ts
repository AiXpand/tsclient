import { IsOptional, IsString } from 'class-validator';

export class AiXPMessageTime {
    @IsString()
    @IsOptional()
    device: string;

    @IsOptional()
    @IsString()
    host: string;

    @IsOptional()
    @IsString()
    internet: string;
}
