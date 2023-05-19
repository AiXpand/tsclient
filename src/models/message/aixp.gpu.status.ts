import { IsNotEmpty, IsNumber } from 'class-validator';

export class AiXPGPUStatus {
    @IsNotEmpty()
    @IsNumber()
    load: number;

    @IsNotEmpty()
    @IsNumber()
    temperature: number;

    @IsNotEmpty()
    @IsNumber()
    maxTemperature: number;
}
