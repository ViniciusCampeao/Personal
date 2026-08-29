import { Module } from '@nestjs/common';
import { AuthCommonModule } from '../../common/auth/auth-common.module';
import { FieldEncryptionModule } from '../../common/crypto/field-encryption.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AuthCommonModule, FieldEncryptionModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
