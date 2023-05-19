import { IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AiXPGPUMemoryStats {
    @IsNotEmpty()
    @IsNumber()
    total: number;

    @IsNotEmpty()
    @IsNumber()
    allocated: number;

    @IsNotEmpty()
    @IsNumber()
    free: number;

    @IsNotEmpty()
    @IsString()
    @IsIn(['TB', 'GB', 'MB', 'KB'])
    unit: string;
}
