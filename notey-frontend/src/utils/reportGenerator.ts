import jsPDF from 'jspdf';

export interface ReportEvent {
  id: string;
  title: string;
  started_at: string;
  transcript: string;
  photos: {
    id: string;
    url: string;
    offset_seconds: number;
  }[];
}

export interface ReportData {
  concept: string;
  summary: string;
  events: ReportEvent[];
}

export class ReportGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private yPosition: number;
  private pageNumber: number;

  constructor() {
    this.pdf = new jsPDF();
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.margin = 20;
    this.yPosition = this.margin;
    this.pageNumber = 1;
  }

  private checkPageBreak(requiredHeight: number = 20) {
    if (this.yPosition + requiredHeight > this.pageHeight - this.margin) {
      this.pdf.addPage();
      this.yPosition = this.margin;
      this.pageNumber++;
      this.addPageNumber();
    }
  }

  private addPageNumber() {
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.text(
      `Page ${this.pageNumber}`,
      this.pageWidth - this.margin,
      this.pageHeight - 10,
      { align: 'right' }
    );
  }

  private addTitle(title: string) {
    this.pdf.setFontSize(24);
    this.pdf.setTextColor(242, 140, 56); // Notey orange
    this.pdf.setFont('helvetica', 'bold');
    
    const lines = this.pdf.splitTextToSize(title, this.pageWidth - 2 * this.margin);
    this.pdf.text(lines, this.margin, this.yPosition);
    this.yPosition += lines.length * 12 + 20;
  }

  private addSectionHeader(header: string, fontSize: number = 16) {
    this.checkPageBreak(25);
    this.pdf.setFontSize(fontSize);
    this.pdf.setTextColor(74, 44, 24); // Notey brown
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(header, this.margin, this.yPosition);
    this.yPosition += fontSize * 0.8 + 10;
  }

  private addParagraph(text: string, fontSize: number = 12) {
    this.pdf.setFontSize(fontSize);
    this.pdf.setTextColor(74, 44, 24); // Notey brown
    this.pdf.setFont('helvetica', 'normal');
    
    const lines = this.pdf.splitTextToSize(text, this.pageWidth - 2 * this.margin);
    
    // Check if we need a page break for this paragraph
    this.checkPageBreak(lines.length * (fontSize * 0.6) + 10);
    
    lines.forEach((line: string) => {
      this.pdf.text(line, this.margin, this.yPosition);
      this.yPosition += fontSize * 0.6;
    });
    
    this.yPosition += 10; // Add space after paragraph
  }

  private addDivider() {
    this.checkPageBreak(15);
    this.pdf.setDrawColor(242, 140, 56); // Notey orange
    this.pdf.setLineWidth(0.5);
    this.pdf.line(this.margin, this.yPosition, this.pageWidth - this.margin, this.yPosition);
    this.yPosition += 15;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private async addPhotos(photos: { id: string; url: string; offset_seconds: number }[]) {
    if (photos.length === 0) {
      this.checkPageBreak(20);
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(128, 128, 128);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.text('No photos captured during this event', this.margin, this.yPosition);
      this.yPosition += 15;
      return;
    }

    // Add photos section header
    this.checkPageBreak(20);
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.setFont('helvetica', 'italic');
    const photoText = photos.length === 1 ? '1 photo captured' : `${photos.length} photos captured`;
    this.pdf.text(`${photoText} during this event:`, this.margin, this.yPosition);
    this.yPosition += 15;

    // Embed each photo
    for (const photo of photos) {
      try {
        await this.embedPhoto(photo);
      } catch (error) {
        console.error('Failed to embed photo:', error);
        // Fallback to text placeholder
        this.checkPageBreak(15);
        this.pdf.setFontSize(10);
        this.pdf.setTextColor(128, 128, 128);
        this.pdf.setFont('helvetica', 'italic');
        this.pdf.text(`[PHOTO ERROR] Photo at ${Math.floor(photo.offset_seconds)}s (failed to load)`, this.margin, this.yPosition);
        this.yPosition += 15;
      }
    }
  }

  private async embedPhoto(photo: { id: string; url: string; offset_seconds: number }) {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Calculate image dimensions to fit on page
          const maxWidth = this.pageWidth - 2 * this.margin;
          const maxHeight = 100; // Max height for each photo
          
          let width = img.width;
          let height = img.height;
          
          // Scale down if too large
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          // Check if we need a page break for the photo
          this.checkPageBreak(height + 20);

          // Add photo timestamp
          this.pdf.setFontSize(8);
          this.pdf.setTextColor(128, 128, 128);
          this.pdf.setFont('helvetica', 'normal');
          const timeText = `Photo at ${Math.floor(photo.offset_seconds)}s`;
          this.pdf.text(timeText, this.margin, this.yPosition);
          this.yPosition += 10;

          // Add the image
          this.pdf.addImage(img, 'JPEG', this.margin, this.yPosition, width, height);
          this.yPosition += height + 10;
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = photo.url;
    });
  }

  async generateReport(data: ReportData): Promise<Blob> {
    // Header with Notey branding
    this.pdf.setFillColor(252, 238, 217); // Notey cream background
    this.pdf.rect(0, 0, this.pageWidth, 40, 'F');
    
    // Add title
    this.addTitle(`Event Report: ${data.concept}`);
    this.addPageNumber();
    
    // Add generation date
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(
      `Generated on ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`,
      this.pageWidth - this.margin,
      this.yPosition - 10,
      { align: 'right' }
    );

    this.addDivider();

    // Summary section
    this.addSectionHeader('Summary of Topic');
    this.addParagraph(data.summary);

    this.addDivider();

    // Events list
    this.addSectionHeader('List of Events');
    this.addParagraph(`This report covers ${data.events.length} event${data.events.length !== 1 ? 's' : ''} related to "${data.concept}".`);

    // Add each event
    for (let index = 0; index < data.events.length; index++) {
      const event = data.events[index];
      this.yPosition += 10;
      
      // Event header
      this.addSectionHeader(`Event ${index + 1}: ${event.title}`, 14);
      
      // Event metadata
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(128, 128, 128);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(`Recorded: ${this.formatDate(event.started_at)}`, this.margin, this.yPosition);
      this.yPosition += 15;

      // Transcript section
      this.pdf.setFontSize(12);
      this.pdf.setTextColor(74, 44, 24);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Transcript:', this.margin, this.yPosition);
      this.yPosition += 15;

      // Transcript content
      if (event.transcript && event.transcript.trim()) {
        this.addParagraph(event.transcript, 11);
      } else {
        this.addParagraph('No transcript available for this event.', 11);
      }

      // Photos section
      this.pdf.setFontSize(12);
      this.pdf.setTextColor(74, 44, 24);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Photos:', this.margin, this.yPosition);
      this.yPosition += 15;

      await this.addPhotos(event.photos);

      // Add separator between events (except for the last one)
      if (index < data.events.length - 1) {
        this.yPosition += 10;
        this.addDivider();
      }
    }

    // Footer
    this.yPosition = this.pageHeight - 30;
    this.pdf.setFillColor(252, 238, 217); // Notey cream
    this.pdf.rect(0, this.pageHeight - 25, this.pageWidth, 25, 'F');
    
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(
      'Generated by Notey - Your AI-powered note-taking companion',
      this.pageWidth / 2,
      this.pageHeight - 10,
      { align: 'center' }
    );

    return this.pdf.output('blob');
  }

  async downloadReport(data: ReportData, filename?: string) {
    const blob = await this.generateReport(data);
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `notey-report-${data.concept.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

// Helper function to create a report generator instance
export const createReportGenerator = () => new ReportGenerator();