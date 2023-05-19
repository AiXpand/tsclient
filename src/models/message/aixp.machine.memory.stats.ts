import { IsNotEmpty, IsNumber } from 'class-validator';

export class AiXPMachineMemoryStats {
    @IsNotEmpty()
    @IsNumber()
    machine: number;

    @IsNotEmpty()
    @IsNumber()
    available: number;

    @IsNotEmpty()
    @IsNumber()
    process: number;
}
