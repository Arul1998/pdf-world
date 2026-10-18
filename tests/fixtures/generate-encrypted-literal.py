"""Regenerate the test fixture using pypdf 6.10.0 (not required by CI)."""
import base64
import io
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import ByteStringObject


def literal_ciphertext(self, stream, encryption_key=None):
    # Escape every cipher byte as octal so PDF delimiters are always legal.
    stream.write(b'(' + b''.join(b'\\' + format(c, '03o').encode() for c in self) + b')')


ByteStringObject.write_to_stream = literal_ciphertext
writer = PdfWriter()
writer.pdf_header = '%PDF-1.7'
writer.add_blank_page(width=100, height=100)
writer.add_metadata({'/Title': r'Customer \name (private) / close )'})
writer.encrypt('Correct-123!', algorithm='AES-128')
output = io.BytesIO()
writer.write(output)
Path(__file__).with_name('encrypted-literal.b64').write_text(base64.b64encode(output.getvalue()).decode() + '\n')
