#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const createHtml = require('./createHtml.js');
const readline = require('readline');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer)));
}

function lerPDF(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', err => reject(err.parserError));
        pdfParser.on('pdfParser_dataReady', pdfData => resolve(pdfData));

        pdfParser.loadPDF(filePath);
    });
}

(async () => {

    const format = 'DD-MM-YYYY';
    const startDateInput = await ask("Digite a data inicial (DD-MM-YYYY): ");
    const endDateInput = await ask("Digite a data final (DD-MM-YYYY): ");
    rl.close();

    const startDate = dayjs(startDateInput, format);
    const endDate = dayjs(endDateInput, format);

    if (!startDate.isValid() || !endDate.isValid()) {
        console.error("Uma ou mais datas são inválidas. Use o formato DD-MM-YYYY.");
        process.exit(1);
    }

    const notas = [];
    const erros = [];

    const arquivos = fs.readdirSync(__dirname).filter(f => f.toLowerCase().endsWith('.pdf'));

    for (const arquivo of arquivos) {
        const caminho = path.join(__dirname, arquivo);
        const pdfData = await lerPDF(caminho);

        let cnpj = '';
        let numeroNota = '';
        let valorNota = '';
        let data = '';

        const page = pdfData.Pages[0];
        for (const item of page.Texts) {
            // Posição do numero da nota
            if (item.x >= 32 && item.x <= 33 && item.y >= 1 && item.y <= 2) {
                numeroNota = decodeURIComponent(item.R[0].T);
            }

            // Posição do CNPJ
            if (item.x >= 22 && item.x <= 23 && item.y >= 13 && item.y <= 14) {
                cnpj = decodeURIComponent(item.R[0].T);
            }

            // Posição da data da nota
            if (item.x >= 31 && item.x <= 32 && item.y >= 13 && item.y <= 14) {
                data = decodeURIComponent(item.R[0].T);
            }

            // Posição do valor total da nota
            if (item.x >= 34 && item.x <= 35 && item.y >= 21 && item.y <= 22.5) {
                valorNota = Number.parseFloat(decodeURIComponent(item.R[0].T));
            }

            // console.log(item.x, item.y, item.R)
        }

        const dataFormatada = data.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$1-$2-$3");
        const checkDate = dayjs(dataFormatada, format);
        const isBetween = checkDate.isSame(startDate) || checkDate.isSame(endDate) || (checkDate.isAfter(startDate) && checkDate.isBefore(endDate));

        if (!isBetween) continue;

        if (numeroNota && valorNota && data) {
            notas.push({
                cnpj,
                numeroNota,
                valorNota: valorNota || 0,
                data,
            });
        } else {
            erros.push({
                arquivo,
                cnpj,
                numeroNota,
                valorNota,
                data
            });
        }
    }

    const relatorios = [];
    notas.forEach(nota => {
        const relatorioExistente = relatorios.find(rel => rel.cnpj == nota.cnpj);
        if (relatorioExistente) {
            relatorioExistente.notas.push(nota);
        } else {
            relatorios.push({
                cnpj: nota.cnpj,
                notas: [nota],
                total: 0,
            })
        }
    });

    erros.forEach(erro => {
        const relatorioExistente = relatorios.find(rel => rel.cnpj == erro.cnpj);
        if (relatorioExistente) {
            relatorioExistente.erros.push(erro);
        } else {
            relatorios.push({
                cnpj: erro.cnpj,
                erros: [erro],
                total: 0,
            })
        }
    });

    relatorios.forEach(relatorio => {
        relatorio.total = relatorio.notas.reduce((prev, curr) => prev + curr.valorNota, 0);
    })

    const pastaDestino = path.join(__dirname, 'relatorios');

    if (!fs.existsSync(pastaDestino)) {
      fs.mkdirSync(pastaDestino, { recursive: true });
    }

    const currDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dateFormat = currDate.split(/[/,:\s]+/).join('-');

    fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.json`), JSON.stringify(relatorios), 'utf-8');
    fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.html`), createHtml(relatorios), 'utf-8');
    console.log("Relatorios criados com sucesso!");

    // Aguarda o usuário apertar Enter para fechar
    const pause = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    pause.question('\nPressione Enter para sair...', () => {
        pause.close();
    });
})();
