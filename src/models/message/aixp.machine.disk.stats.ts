import { IsNotEmpty, IsNumber } from 'class-validator';

export class AiXPMachineDiskStats {
    @IsNotEmpty()
    @IsNumber()
    available: number;

    @IsNotEmpty()
    @IsNumber()
    total: number;
}
