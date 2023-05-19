import { IsNotEmpty, IsNumber } from 'class-validator';

export class AiXPGPUProcessStats {
    @IsNotEmpty()
    @IsNumber()
    pid: number;

    @IsNotEmpty()
    @IsNumber()
    gpuInstance: number;

    @IsNotEmpty()
    @IsNumber()
    computeInstance: number;

    @IsNotEmpty()
    @IsNumber()
    memory: number;
}
