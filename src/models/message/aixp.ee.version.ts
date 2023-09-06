import { IsNotEmpty, IsString } from 'class-validator';

export class AiXPEEVersion {
    @IsString()
    @IsNotEmpty()
    full: string;

    @IsString()
    @IsNotEmpty()
    python: string;

    @IsString()
    @IsNotEmpty()
    logger: string;
}
