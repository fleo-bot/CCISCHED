// ─────────────────────────────────────────────
//  Shared helper: print a jsPDF document directly.
//  Prints the exact same document object that "Export PDF" saves.
// ─────────────────────────────────────────────
function printPdfDoc(doc) {
  const url = doc.output('bloburl');

  // Remove any leftover frame from a previous print
  document.getElementById('pdfPrintFrame')?.remove();

  const frame = document.createElement('iframe');
  frame.id = 'pdfPrintFrame';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.src = url;

  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      // Some browsers block printing a PDF inside an iframe —
      // fall back to opening the PDF in a tab (its viewer has a print button).
      window.open(url, '_blank');
    }
  };

  document.body.appendChild(frame);
}
