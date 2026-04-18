import pypdf

try:
    reader = pypdf.PdfReader('Web Dev - Question Paper.pdf')
    text = '\n'.join(page.extract_text() for page in reader.pages)
    with open('pdf-text.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print("PDF extraction complete.")
except Exception as e:
    print(f"Error: {e}")
