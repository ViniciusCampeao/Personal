import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { type LegalDocumentDto, legalDocumentTypes } from '@pt/shared';
import { Public } from '../../common/auth/public.decorator';
import { LEGAL_DOCUMENTS } from './legal.content';

/**
 * Public on purpose: the invite screen has to show the Terms and the Privacy Policy
 * *before* the visitor has an account, and a consent checkbox over text nobody can read
 * is legally worthless.
 */
@Public()
@Controller('legal')
export class LegalController {
  @Get()
  list(): LegalDocumentDto[] {
    return legalDocumentTypes.map((type) => LEGAL_DOCUMENTS[type]);
  }

  @Get(':type')
  findOne(@Param('type') type: string): LegalDocumentDto {
    const document = LEGAL_DOCUMENTS[type as LegalDocumentDto['type']];
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }
}
