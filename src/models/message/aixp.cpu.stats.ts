import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AiXPCPUStats {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsNumber()
    used: number;
}
