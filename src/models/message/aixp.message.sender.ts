import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AiXPMessageSender {
    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    version: string;

    @IsNotEmpty()
    @IsString()
    sender: string;

    @IsNotEmpty()
    @IsNumber()
    totalMessages: number;
}
