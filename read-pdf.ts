import fs from 'fs';
import pdf from 'pdf-parse';

const fileBuffer = fs.readFileSync('Web Dev - Question Paper.pdf');

pdf(fileBuffer).then(function (data) {
    fs.writeFileSync('pdf-text.txt', data.text);
    console.log('Successfully wrote PDF to pdf-text.txt');
}).catch(e => {
    console.error('Error reading PDF:', e);
});
