# Noto Sans Myanmar receipt-prototype font

`NotoSansMyanmar-Regular.ttf` is the single local Myanmar-capable font used by
the development-only PDF receipt prototype. It is bundled so generated PDFs do
not depend on a live Google Fonts request.

- Font: Noto Sans Myanmar Regular, hinted TTF
- Version: 2.107 (28 July 2022 release)
- Source: <https://github.com/notofonts/myanmar/releases/tag/NotoSansMyanmar-v2.107>
- Source archive path: `NotoSansMyanmar/hinted/ttf/NotoSansMyanmar-Regular.ttf`
- SHA-256: `fafce4db400bc0b214907ccdbfb0ad2f18a57bfefd08c8a571830b84088cf2fc`
- License: SIL Open Font License, Version 1.1; full required license text is in
  [`OFL.txt`](./OFL.txt).

This asset is intentionally limited to one font file. English-only receipt
labels use PDFKit's built-in Helvetica so Latin glyphs are not substituted with
missing-glyph boxes by this Myanmar-only font file.
