import { IsNotEmpty, IsNumber } from 'class-validator';

export class AiXPMessageStats {
    @IsNotEmpty()
    @IsNumber()
    total: number;

    @IsNotEmpty()
    @IsNumber()
    current: number;
}
