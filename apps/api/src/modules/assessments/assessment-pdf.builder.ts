import PDFDocument from 'pdfkit';
import { type AssessmentDetailDto } from '@pt/shared';

export interface AssessmentPdfPhoto {
  pose: string;
  buffer: Buffer;
}

export interface AssessmentPdfInput {
  studentName: string;
  trainerName: string;
  assessment: AssessmentDetailDto;
  photos: AssessmentPdfPhoto[];
}

/** Simple one-page report — spec §11 only asks that the PDF exist, not a design. */
export function buildAssessmentPdf(input: AssessmentPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { assessment } = input;

    doc.fontSize(18).text('Relatório de avaliação física', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Aluno: ${input.studentName}`);
    doc.text(`Trainer: ${input.trainerName}`);
    doc.text(`Data: ${new Date(assessment.assessedAt).toLocaleDateString('pt-BR')}`);
    doc.text(`Protocolo: ${assessment.protocol}`);
    doc.moveDown();

    doc.fontSize(13).text('Métricas');
    doc.fontSize(11);
    const metric = (label: string, value: number | null, suffix = '') =>
      doc.text(`${label}: ${value != null ? `${value.toFixed(1)}${suffix}` : '—'}`);
    metric('Peso', assessment.weightKg, ' kg');
    metric('% de gordura', assessment.bodyFatPct, ' %');
    metric('Massa magra', assessment.leanMassKg, ' kg');
    metric('Massa gorda', assessment.fatMassKg, ' kg');
    metric('IMC', assessment.bmi);
    doc.moveDown();

    if (assessment.measurements.length > 0) {
      doc.fontSize(13).text('Medidas (cm)');
      doc.fontSize(11);
      for (const measurement of assessment.measurements) {
        doc.text(`${measurement.site}: ${measurement.valueCm}`);
      }
      doc.moveDown();
    }

    if (assessment.skinfolds.length > 0) {
      doc.fontSize(13).text('Dobras cutâneas (mm)');
      doc.fontSize(11);
      for (const skinfold of assessment.skinfolds) {
        doc.text(`${skinfold.site}: ${skinfold.valueMm}`);
      }
      doc.moveDown();
    }

    if (input.photos.length > 0) {
      doc.fontSize(13).text('Fotos');
      for (const photo of input.photos) {
        doc.moveDown(0.5);
        doc.fontSize(10).text(photo.pose);
        try {
          doc.image(photo.buffer, { fit: [200, 200] });
        } catch {
          doc.text('(não foi possível carregar a imagem)');
        }
      }
    }

    doc.end();
  });
}
