import { IsNotEmpty, IsString } from 'class-validator';

export class AiXPMessageSender {
    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    instance: string;

    @IsNotEmpty()
    @IsString()
    host: string;
}
