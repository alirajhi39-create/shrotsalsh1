declare module "pdfmake-rtl/js/index.js" {
  const pdfmake: {
    virtualfs: { writeFileSync(filename: string, content: Buffer): void };
    addFonts(fonts: Record<string, unknown>): void;
    createPdf(document: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
  };
  export default pdfmake;
}
