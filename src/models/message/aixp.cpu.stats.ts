import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AiXPCPUStats {
    @IsNotEmpty()
    @IsString()
    name: number;

    @IsNotEmpty()
    @IsNumber()
    used: number;
}
