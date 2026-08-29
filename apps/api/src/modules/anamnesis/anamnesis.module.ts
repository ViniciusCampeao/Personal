import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { FieldEncryptionModule } from '../../common/crypto/field-encryption.module';
import { ConsentModule } from '../../common/legal/consent.module';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { AnamnesisController } from './anamnesis.controller';
import { AnamnesisService } from './anamnesis.service';

@Module({
  imports: [StudentAccessModule, FieldEncryptionModule, ConsentModule, AuditModule],
  controllers: [AnamnesisController],
  providers: [AnamnesisService],
})
export class AnamnesisModule {}
