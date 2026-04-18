import fs from 'node:fs';
import pdf from 'pdf-parse';

async function extract() {
    try {
        const fileBuffer = fs.readFileSync('Web Dev - Question Paper.pdf');
        const data = await pdf(fileBuffer);
        fs.writeFileSync('pdf-text.txt', data.text);
        console.log('Successfully wrote PDF to pdf-text.txt');
    } catch (e) {
        console.error('Error reading PDF:', e);
    }
}

extract();
